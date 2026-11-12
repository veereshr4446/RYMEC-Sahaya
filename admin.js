import { CONFIG } from './config.js';
import * as db from './db.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s).toLowerCase().replace(/\s+/g, '-');
const cat = (id) => CONFIG.CATEGORIES.find((c) => c.id === id) || { label: id, icon: '📌' };
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const safePhoto = (p) => (typeof p === 'string' && p.startsWith('data:image/') ? p : '');

let tt;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2400); }

$('#collegeName').textContent = CONFIG.COLLEGE.name;
if (db.mode === 'demo') $('#demoBanner').hidden = false;
else { $('#pinBox').hidden = true; $('#mailBox').hidden = false; }
$('#fStatus').insertAdjacentHTML('beforeend', CONFIG.STATUSES.map((s) => `<option>${esc(s)}</option>`).join(''));
$('#fCat').insertAdjacentHTML('beforeend', CONFIG.CATEGORIES.map((c) => `<option value="${esc(c.id)}">${c.icon} ${esc(c.label)}</option>`).join(''));

let all = [];

async function enter() {
  $('#login').hidden = true;
  $('#panel').hidden = false;
  $('#logout').hidden = false;
  await refresh();
}

async function refresh() {
  $('#list').innerHTML = '<p class="empty">Loading…</p>';
  try { all = await db.adminList(); render(); }
  catch (err) { $('#list').innerHTML = `<p class="empty">Could not load: ${esc(err.message)}</p>`; }
}

function render() {
  const count = (s) => all.filter((r) => r.status === s).length;
  $('#stats').innerHTML = [['Total', all.length], ['Open', count('Open')], ['In progress', count('In Progress')], ['Resolved', count('Resolved')]]
    .map(([l, n]) => `<div class="stat"><b>${n}</b><small>${l}</small></div>`).join('');

  const q = $('#q').value.trim().toLowerCase(), fs = $('#fStatus').value, fc = $('#fCat').value;
  const list = all.filter((r) =>
    (!fs || r.status === fs) && (!fc || r.category === fc) &&
    (!q || `${r.ticket} ${r.title} ${r.description} ${r.location}`.toLowerCase().includes(q)));

  $('#list').innerHTML = list.length ? list.map((r) => {
    const c = cat(r.category);
    const photo = safePhoto(r.photo);
    const who = r.anonymous ? 'Anonymous' : `${esc(r.name || 'No name')} · ${esc(r.contact || 'no contact')}`;
    return `<article class="card" data-t="${esc(r.ticket)}">
      <div class="meta"><span>${c.icon} ${esc(c.label)} · ${esc(r.ticket)}</span><span class="pill s-${slug(r.status)}">${esc(r.status)}</span></div>
      <h3>${esc(r.title)} ${r.isPrivate ? '<span class="tag">PRIVATE</span>' : ''}</h3>
      <p>${esc(r.description)}</p>
      ${photo ? `<img src="${esc(photo)}" alt="Photo attached to this report" loading="lazy">` : ''}
      <p class="who"><b>From:</b> ${who}<br><b>Where:</b> ${esc(r.location || '-')} · ${esc(r.department || '-')}<br><b>Reported:</b> ${fmt(r.createdAt)} · 👍 ${r.upvotes}</p>
      <div class="edit">
        <select class="st" aria-label="Status">${CONFIG.STATUSES.map((s) => `<option ${s === r.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <textarea class="nt" rows="2" maxlength="1000" placeholder="Reply shown to the student (optional)">${esc(r.adminNote)}</textarea>
        <button class="primary save" type="button">Save</button>
      </div>
    </article>`;
  }).join('') : '<p class="empty">Nothing matches.</p>';
}

$('#list').addEventListener('click', async (e) => {
  const btn = e.target.closest('.save');
  if (!btn) return;
  const card = btn.closest('.card');
  const ticket = card.dataset.t;
  btn.disabled = true;
  try {
    await db.adminUpdate(ticket, { status: card.querySelector('.st').value, adminNote: card.querySelector('.nt').value.trim() });
    toast('Saved');
    await refresh();
  } catch (err) { toast('Failed: ' + err.message); btn.disabled = false; }
});

['#q', '#fStatus', '#fCat'].forEach((s) => $(s).addEventListener('input', render));
$('#refresh').addEventListener('click', refresh);

// CSV: quote every cell and neutralise spreadsheet formulas.
function cell(v) {
  let s = String(v ?? '').replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
$('#csv').addEventListener('click', () => {
  const head = ['Ticket', 'Date', 'Status', 'Category', 'Department', 'Location', 'Title', 'Details', 'Anonymous', 'Name', 'Contact', 'Private', 'Upvotes', 'Reply'];
  const rows = all.map((r) => [r.ticket, r.createdAt, r.status, cat(r.category).label, r.department, r.location, r.title, r.description, r.anonymous ? 'Yes' : 'No', r.name, r.contact, r.isPrivate ? 'Yes' : 'No', r.upvotes, r.adminNote]);
  const csv = [head, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `rymec-reports-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#loginErr');
  err.hidden = true;
  try {
    await db.adminLogin({ pin: $('#pin').value, email: $('#email').value.trim(), password: $('#password').value });
    if (!(await db.isAdmin())) throw new Error('This account is not on the staff list');
    await enter();
  } catch (ex) { err.textContent = ex.message; err.hidden = false; }
});

$('#logout').addEventListener('click', async () => { await db.adminLogout(); location.reload(); });

(async () => { try { if (await db.isAdmin()) await enter(); } catch {} })();
