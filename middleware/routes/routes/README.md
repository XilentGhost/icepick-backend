# Ice Pick — backend

A small Express + SQLite API for the Ice Pick neighborhood watch app: usernames with
passwords, reports, photo uploads, and comments.

This runs on your own machine or hosting — it isn't connected to the app or landing
page you already have. See "Connecting the front end" below for how to wire them together.

## Setup

1. Install [Node.js](https://nodejs.org) 18 or newer.
2. In this folder, install dependencies:
   ```
   npm install
   ```
3. Copy the environment file and set a real secret:
   ```
   cp .env.example .env
   ```
   Open `.env` and replace `JWT_SECRET` with a long random string (this is what signs
   login sessions — treat it like a password).
4. Start the server:
   ```
   npm start
   ```
   You should see `Ice Pick API running on http://localhost:3000`.

A SQLite database file (`icepick.db`) is created automatically on first run. Uploaded
photos are saved to the `uploads/` folder and served back at `/uploads/<filename>`.

## API reference

All request/response bodies are JSON, except photo upload which is `multipart/form-data`.

| Method | Path                       | Auth | Description                          |
|--------|----------------------------|------|---------------------------------------|
| POST   | `/api/auth/signup`         | —    | `{ username, password }` → `{ token, user }` |
| POST   | `/api/auth/login`          | —    | `{ username, password }` → `{ token, user }` |
| GET    | `/api/auth/me`             | ✓    | Returns the signed-in user             |
| GET    | `/api/reports`             | —    | List all reports, newest first         |
| GET    | `/api/reports/:id`         | —    | One report with its comments           |
| POST   | `/api/reports`             | ✓    | Create a report (see fields below)     |
| POST   | `/api/reports/:id/comments`| ✓    | `{ text }` → adds a comment            |

Routes marked **Auth** require a header: `Authorization: Bearer <token>` — the token
you get back from signup or login.

### Creating a report

`POST /api/reports` as `multipart/form-data` with fields:

- `cat` — one of `caution`, `active`, `suspicious`, `police`, `safe`
- `title` — short title
- `desc` — details
- `loc` — location text
- `sev` — one of `low`, `medium`, `high`
- `x`, `y` — position on the map, 0–100 (percent)
- `photo` — optional image file

## Connecting the front end

The `icepick.html` app currently saves reports to Claude's built-in artifact storage
(`window.storage`), which only works inside a Claude conversation/artifact — it has no
connection to this API. To make the app use this backend instead, you'd replace the
`loadReports`, `saveReports`, `loadUsername`, and `saveUsername` functions with `fetch`
calls to these endpoints, and store the returned `token` (e.g. in a cookie or, if you
add a proper build step, in memory) instead of writing it to `window.storage`.

That rewiring is a real (if fairly mechanical) chunk of work — let me know if you'd
like help doing it once you've got this server running somewhere.

## Deploying

For a live URL instead of `localhost`, this server runs as-is on most Node hosts —
Render, Railway, and Fly.io all have free or cheap tiers and support persistent disks
(needed for the SQLite file and `uploads/` folder to survive restarts). Set the same
environment variables from `.env` in your host's dashboard, and set `CORS_ORIGIN` to
the URL where your app/landing page will actually be hosted.

## Security notes for a real launch

This covers the basics (hashed passwords, signed sessions, file-type/size limits on
uploads) but skips things you'd want before real neighbors' data lands here:

- **Rate limiting** on login/signup to slow down brute-force attempts
- **Content moderation** — nothing here stops abusive or false reports
- **HTTPS** in production (most hosts handle this for you automatically)
- **Backups** of the SQLite database
- **Terms of service / privacy policy**, especially since reports include locations
  and photos
