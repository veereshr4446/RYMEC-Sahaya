# RYMEC Sahaya: campus problem reporter

A free, installable (PWA) website where students report campus problems, upvote existing ones and track progress by ticket ID. Staff manage everything from `admin.html`.

No build step. It is plain HTML, CSS and JavaScript.

## Try it right now (demo mode)

Serve the folder and open it (service workers and ES modules need http, not a double-click):

```
python3 -m http.server 8000
```

Open http://localhost:8000. Reports are stored only in your browser. Staff page: `admin.html`, demo PIN `1234` (set in `config.js`).

## Go live for everyone (free)

### 1. Database: Supabase free tier
1. Create a project at supabase.com.
2. SQL Editor -> New query -> paste all of `supabase.sql` -> Run.
3. Authentication -> Users -> Add user (your staff email + password).
4. Authentication -> Providers/Settings -> turn **off** "Allow new users to sign up".
5. SQL Editor, run (with your real email): `insert into public.admins (email) values ('you@example.com');`
6. Project Settings -> API: copy the **Project URL** and the **anon public key** into `config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). The anon key is meant to be public. Never put the `service_role` key anywhere in this project.

### 2. Hosting: GitHub Pages
Push these files to a repo, then Settings -> Pages -> deploy from `main`. In Supabase, Authentication -> URL Configuration, add your Pages URL as the Site URL.

## How privacy works
- Harassment/ragging reports are always private; any report can be marked private. Private reports never appear on the public list.
- Anonymous reports store no name or contact. Named reports show name/contact only to staff.
- The public list reads from a view that leaves out names, contacts and private reports. Students can look up one report only if they know its ticket ID.
- Only emails in the `admins` table can read all reports or change status.

## Things to edit
- `config.js`: college details, department list (check it against your real branches), categories, statuses.
- Photos are resized in the browser to about 900px and stored with the report, which is fine for one college on the free tier. If you get heavy use, move photos to Supabase Storage.
- Upvotes are limited once per device (not per person). That is fine for ranking, not for voting.

## Files
`index.html` + `app.js` student site · `admin.html` + `admin.js` staff dashboard · `db.js` data layer (demo/Supabase) · `config.js` settings · `supabase.sql` database setup · `sw.js` + `manifest.webmanifest` + icons for the PWA
