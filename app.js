import { CONFIG } from './config.js';
import * as db from './db.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s).toLowerCase().replace(/\s+/g, '-');
const cat = (id) => CONFIG.CATEGORIES.find((c) => c.id === id) || { label: id, icon: '📌' };
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const safePhoto = (p) => (typeof p === 'string' && p.startsWith('data:image/') ? p : '');

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- header / setup ----------
$('#collegeName').textContent = `${CONFIG.COLLEGE.name}, Ballari`;
$('#siteLink').textContent = CONFIG.COLLEGE.short + ' website';
$('#siteLink').href = CONFIG.COLLEGE.website;
if (db.mode === 'demo') $('#demoBanner').hidden = false;

$('#cats').innerHTML = CONFIG.CATEGORIES.map((c) =>
  `<label><input type="radio" name="cat" value="${esc(c.id)}"><span>${c.icon} ${esc(c.label)}</span></label>`).join('');
$('#dept').innerHTML = CONFIG.DEPARTMENTS.map((d) => `<option>${esc(d)}</option>`).join('');
$('#fCat').insertAdjacentHTML('beforeend', CONFIG.CATEGORIES.filter((c) => !c.private).map((c) => `<option value="${esc(c.id)}">${c.icon} ${esc(c.label)}</option>`).join(''));
$('#fStatus').insertAdjacentHTML('beforeend', CONFIG.STATUSES.map((s) => `<option>${esc(s)}</option>`).join(''));

// ---------- tabs ----------
function show(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  if (view === 'issues') loadIssues();
  if (view === 'track') renderMine();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));

// ---------- report form ----------
const form = $('#reportForm');
function syncForm() {
  const picked = form.querySelector('input[name=cat]:checked');
  const forcedPrivate = picked && cat(picked.value).private;
  $('#priv').checked = forcedPrivate ? true : $('#priv').checked;
  $('#priv').disabled = !!forcedPrivate;
  $('#privHint').hidden = !forcedPrivate;
  $('#identity').hidden = $('#anon').checked;
}
form.addEventListener('change', syncForm);
syncForm();

function compress(file, max = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

let photoData = '';
$('#photo').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  const prev = $('#photoPreview');
  photoData = '';
  prev.hidden = true;
  if (!f) return;
  try {
    photoData = await compress(f);
    prev.src = photoData;
    prev.hidden = false;
  } catch (err) {
    e.target.value = '';
    toast(err.message);
  }
});

function showError(msg) {
  const el = $('#formError');
  el.textContent = msg;
  el.hidden = !msg;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  const picked = form.querySelector('input[name=cat]:checked');
  const title = $('#title').value.trim();
  const desc = $('#desc').value.trim();
  if (!picked) return showError('Pick a category.');
  if (title.length < 5) return showError('Title needs at least 5 characters.');
  if (desc.length < 15) return showError('Please describe the problem in at least 15 characters.');
  if (!$('#anon').checked && !$('#contact').value.trim()) return showError('Add a phone or email, or switch on anonymous.');

  const btn = $('#submitBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting…';
  try {
    const ticket = await db.createReport({
      title, description: desc, category: picked.value,
      department: $('#dept').value, location: $('#loc').value, photo: photoData,
      anonymous: $('#anon').checked, name: $('#name').value, contact: $('#contact').value,
      isPrivate: $('#priv').checked || !!cat(picked.value).private,
    });
    const mine = store.get('raise_it_mine', []);
    mine.unshift({ ticket, title, at: Date.now() });
    store.set('raise_it_mine', mine.slice(0, 50));
    $('#ticketOut').textContent = ticket;
    form.hidden = true;
    $('#done').hidden = false;
  } catch (err) {
    showError('Could not submit: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit report';
  }
});

$('#copyTicket').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#ticketOut').textContent); toast('Ticket ID copied'); }
  catch { toast('Long-press the ID to copy it'); }
});
$('#another').addEventListener('click', () => {
  form.reset();
  photoData = '';
  $('#photoPreview').hidden = true;
  syncForm();
  form.hidden = false;
  $('#done').hidden = true;
});

// ---------- issues list ----------
let issues = [];
function card(r) {
  const c = cat(r.category);
  const voted = store.get('raise_it_voted', []).includes(r.ticket);
  const photo = safePhoto(r.photo);
  return `<article class="card">
    <div class="meta"><span>${c.icon} ${esc(c.label)}</span><span class="pill s-${slug(r.status)}">${esc(r.status)}</span></div>
    <h3>${esc(r.title)}</h3>
    <p>${esc(r.description)}</p>
    ${photo ? `<img src="${esc(photo)}" alt="Photo attached to this report" loading="lazy">` : ''}
    ${r.adminNote ? `<div class="note"><b>College reply:</b> ${esc(r.adminNote)}</div>` : ''}
    <div class="foot"><small>${esc(r.location || r.department || '')} · ${fmt(r.createdAt)}</small>
      <button class="up ${voted ? 'done' : ''}" data-t="${esc(r.ticket)}" aria-label="Upvote, I have this problem too">▲ <b>${r.upvotes}</b></button></div>
  </article>`;
}
function renderIssues() {
  const fc = $('#fCat').value, fs = $('#fStatus').value, sort = $('#fSort').value;
  let list = issues.filter((r) => (!fc || r.category === fc) && (!fs || r.status === fs));
  list.sort(sort === 'votes' ? (a, b) => b.upvotes - a.upvotes || new Date(b.createdAt) - new Date(a.createdAt) : (a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  $('#issueList').innerHTML = list.length ? list.map(card).join('') : '<p class="empty">No reports match yet.</p>';
}
async function loadIssues() {
  $('#issueList').innerHTML = '<p class="empty">Loading…</p>';
  try { issues = await db.listPublic(); renderIssues(); }
  catch (err) { $('#issueList').innerHTML = `<p class="empty">Could not load: ${esc(err.message)}</p>`; }
}
['#fCat', '#fStatus', '#fSort'].forEach((s) => $(s).addEventListener('change', renderIssues));
$('#issueList').addEventListener('click', async (e) => {
  const btn = e.target.closest('.up');
  if (!btn) return;
  const t = btn.dataset.t;
  const voted = store.get('raise_it_voted', []);
  if (voted.includes(t)) return toast('You already upvoted this');
  try {
    await db.upvote(t);
    voted.push(t);
    store.set('raise_it_voted', voted);
    const r = issues.find((x) => x.ticket === t);
    if (r) r.upvotes += 1;
    renderIssues();
  } catch (err) { toast('Could not upvote: ' + err.message); }
});

// ---------- track ----------
function trackCard(r) {
  const idx = Math.max(0, ['Open', 'In Progress', 'Resolved'].indexOf(r.status));
  const bars = r.status === 'Rejected' ? '' : `<div class="steps">${[0, 1, 2].map((i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('')}</div>`;
  return `<article class="card">
    <div class="meta"><span>${esc(r.ticket)}</span><span class="pill s-${slug(r.status)}">${esc(r.status)}</span></div>
    <h3>${esc(r.title)}</h3>${bars}
    <div class="foot"><small>Reported ${fmt(r.createdAt)} · Updated ${fmt(r.updatedAt)}</small></div>
    ${r.adminNote ? `<div class="note"><b>College reply:</b> ${esc(r.adminNote)}</div>` : ''}
  </article>`;
}
async function doTrack(id) {
  const out = $('#trackOut');
  if (!id.trim()) return;
  out.innerHTML = '<p class="empty">Checking…</p>';
  try {
    const r = await db.track(id);
    out.innerHTML = r ? trackCard(r) : '<p class="empty">No report found with that ID.</p>';
  } catch (err) { out.innerHTML = `<p class="empty">Could not check: ${esc(err.message)}</p>`; }
}
$('#trackForm').addEventListener('submit', (e) => { e.preventDefault(); doTrack($('#trackId').value); });
function renderMine() {
  const mine = store.get('raise_it_mine', []);
  $('#mine').innerHTML = mine.length
    ? mine.map((m) => `<button class="card" data-t="${esc(m.ticket)}" style="text-align:left;color:inherit;width:100%"><b>${esc(m.ticket)}</b><br><small>${esc(m.title)}</small></button>`).join('')
    : '<p class="empty">Reports you submit here will be listed for quick access.</p>';
}
$('#mine').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-t]');
  if (!b) return;
  $('#trackId').value = b.dataset.t;
  doTrack(b.dataset.t);
});

// ---------- PWA ----------
let deferred;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
$('#installBtn').addEventListener('click', async () => {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  $('#installBtn').hidden = true;
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
