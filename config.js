// Everything college-specific lives here. Edit freely.
export const CONFIG = {
  COLLEGE: {
    name: 'Rao Bahadur Y. Mahabaleshwarappa Engineering College',
    short: 'RYMEC',
    city: 'Cantonment, Ballari, Karnataka 583104',
    website: 'https://rymec.edu.in/',
    contactEmail: 'principalrymec@gmail.com',
  },

  // Check these against your real department list and edit.
  DEPARTMENTS: [
    'First Year (Common)',
    'Civil Engineering',
    'Mechanical Engineering',
    'Electrical & Electronics (EEE)',
    'Electronics & Communication (ECE)',
    'Computer Science (CSE)',
    'Information Science (ISE)',
    'AI & Machine Learning',
    'MBA',
    'M.Tech / PG',
    'Not department specific',
  ],

  // private: true = never shown on the public list, only admins see it.
  CATEGORIES: [
    { id: 'infrastructure', label: 'Classrooms & Buildings', icon: '🏫' },
    { id: 'water', label: 'Water & Washrooms', icon: '🚰' },
    { id: 'power-net', label: 'Power & Wi-Fi', icon: '📶' },
    { id: 'labs', label: 'Labs & Equipment', icon: '🔬' },
    { id: 'library', label: 'Library', icon: '📚' },
    { id: 'hostel', label: 'Hostel', icon: '🛏️' },
    { id: 'canteen', label: 'Canteen & Food', icon: '🍽️' },
    { id: 'transport', label: 'Transport', icon: '🚌' },
    { id: 'academics', label: 'Academics & Exams', icon: '📝' },
    { id: 'safety', label: 'Safety & Security', icon: '🛡️' },
    { id: 'harassment', label: 'Harassment / Ragging', icon: '🔒', private: true },
    { id: 'other', label: 'Other', icon: '📌' },
  ],

  STATUSES: ['Open', 'In Progress', 'Resolved', 'Rejected'],

  // Leave both empty to run in demo mode (data stays on this device only).
  // Fill both after following README.md to go live for everyone.
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // Demo mode only. This is NOT secure, it is just to try the admin page.
  DEMO_ADMIN_PIN: '1234',
};
