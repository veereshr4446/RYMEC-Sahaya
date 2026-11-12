import { CONFIG } from './config.js';

export const mode = CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY ? 'supabase' : 'demo';

let sb = null;
async function client() {
  if (!sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return sb;
}

// ---------- helpers ----------
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newTicket() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return 'RY-' + Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join('');
}

function fromRow(r) {
  return {
    ticket: r.ticket,
    title: r.title,
    description: r.description,
    category: r.category,
    department: r.department,
    location: r.location,
    photo: r.photo,
    status: r.status,
    upvotes: r.upvotes ?? 0,
    adminNote: r.admin_note ?? r.adminNote ?? '',
    createdAt: r.created_at ?? r.createdAt,
    updatedAt: r.updated_at ?? r.updatedAt,
    anonymous: r.anonymous,
    name: r.reporter_name ?? r.name,
    contact: r.reporter_contact ?? r.contact,
    isPrivate: r.is_private ?? r.isPrivate,
  };
}

// ---------- demo (localStorage) store ----------
const KEY = 'raise_it_reports_v1';
function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(v)) return v;
  } catch {}
  const now = Date.now();
  const seed = [
    ['RY-DEMO01', 'Fan not working in Room 204', 'Two ceiling fans in the CSE second-year classroom have stopped working. Very hot in the afternoon session.', 'infrastructure', 'Computer Science (CSE)', 'Block B, Room 204', 14, 'In Progress', 'Electrician has been informed. Repair expected this week.', 3],
    ['RY-DEMO02', 'Wi-Fi drops in library', 'Wi-Fi disconnects every few minutes near the reading hall, which makes it hard to use e-resources.', 'power-net', 'Not department specific', 'Library reading hall', 6, 'Open', '', 1],
    ['RY-DEMO03', 'Water cooler leaking near canteen', 'The water cooler outside the canteen leaks and the floor stays wet.', 'water', 'Not department specific', 'Canteen entrance', 2, 'Resolved', 'Fixed and mopped. Thanks for reporting.', 0],
  ].map(([ticket, title, description, category, department, location, up, status, adminNote, days]) => ({
    ticket, title, description, category, department, location, photo: '', anonymous: true, name: '', contact: '',
    isPrivate: false, status, upvotes: up, adminNote,
    createdAt: new Date(now - (days + 1) * 864e5).toISOString(), updatedAt: new Date(now - days * 864e5).toISOString(),
  }));
  save(seed);
  return seed;
}
function save(a) {
  localStorage.setItem(KEY, JSON.stringify(a));
}

// ---------- student API ----------
export async function createReport(r) {
  const ticket = newTicket();
  const row = {
    ticket,
    title: r.title.trim(),
    description: r.description.trim(),
    category: r.category,
    department: r.department || '',
    location: (r.location || '').trim(),
    photo: r.photo || '',
    anonymous: !!r.anonymous,
    name: r.anonymous ? '' : (r.name || '').trim(),
    contact: r.anonymous ? '' : (r.contact || '').trim(),
    isPrivate: !!r.isPrivate,
    status: 'Open',
    upvotes: 0,
    adminNote: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (mode === 'demo') {
    const all = load();
    all.unshift(row);
    save(all);
  } else {
    const c = await client();
    const { error } = await c.from('reports').insert({
      ticket: row.ticket, title: row.title, description: row.description, category: row.category,
      department: row.department, location: row.location, photo: row.photo, anonymous: row.anonymous,
      reporter_name: row.name, reporter_contact: row.contact, is_private: row.isPrivate,
    });
    if (error) throw new Error(error.message);
  }
  return ticket;
}

export async function listPublic() {
  if (mode === 'demo') {
    return load().filter((r) => !r.isPrivate).map((r) => fromRow({ ...r, name: '', contact: '' }));
  }
  const c = await client();
  const { data, error } = await c.from('public_reports').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return data.map(fromRow);
}

export async function track(ticket) {
  const t = ticket.trim().toUpperCase();
  if (mode === 'demo') {
    const r = load().find((x) => x.ticket === t);
    return r ? fromRow({ ...r, name: '', contact: '' }) : null;
  }
  const c = await client();
  const { data, error } = await c.rpc('track_report', { t });
  if (error) throw new Error(error.message);
  return data && data.length ? fromRow(data[0]) : null;
}

export async function upvote(ticket) {
  if (mode === 'demo') {
    const all = load();
    const r = all.find((x) => x.ticket === ticket);
    if (r) { r.upvotes = (r.upvotes || 0) + 1; save(all); }
    return;
  }
  const c = await client();
  const { error } = await c.rpc('upvote_report', { t: ticket });
  if (error) throw new Error(error.message);
}

// ---------- admin API ----------
export async function adminLogin({ pin, email, password }) {
  if (mode === 'demo') {
    if (pin !== CONFIG.DEMO_ADMIN_PIN) throw new Error('Wrong PIN');
    sessionStorage.setItem('raise_it_admin', '1');
    return;
  }
  const c = await client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function isAdmin() {
  if (mode === 'demo') return sessionStorage.getItem('raise_it_admin') === '1';
  const c = await client();
  const { data } = await c.auth.getSession();
  if (!data.session) return false;
  const { data: ok } = await c.rpc('is_admin');
  return ok === true;
}

export async function adminLogout() {
  if (mode === 'demo') return sessionStorage.removeItem('raise_it_admin');
  const c = await client();
  await c.auth.signOut();
}

export async function adminList() {
  if (mode === 'demo') return load().map(fromRow);
  const c = await client();
  const { data, error } = await c.from('reports').select('*').order('created_at', { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return data.map(fromRow);
}

export async function adminUpdate(ticket, { status, adminNote }) {
  if (mode === 'demo') {
    const all = load();
    const r = all.find((x) => x.ticket === ticket);
    if (r) { r.status = status; r.adminNote = adminNote; r.updatedAt = new Date().toISOString(); save(all); }
    return;
  }
  const c = await client();
  const { error } = await c.from('reports').update({ status, admin_note: adminNote }).eq('ticket', ticket);
  if (error) throw new Error(error.message);
}
