# BHW Child Records

A child registry for Barangay Health Workers. BHWs can maintain child and guardian records, filter by barangay, and download the formatted Vitamin A and Deworming workbook. Admin manages accounts, passwords, barangay/Purok coverage, and worker assignments.

## Project structure

- `Client/` contains the Next.js page views, server actions, authentication UI, styles, and shared components.
- `Data/` contains frontend entities and repository adapters that call the API. `Data/migrations/` and `Data/schema.ts` preserve the former D1 schema for the one-time export only; the running app no longer connects to D1.
- `Services/` contains frontend authentication and child-record rules.
- `Resources/` contains shared copy and vendor assets.
- `app/` contains thin Next.js route entry points, and `public/` contains deployable static assets.
- `backend/` is the Express API deployed to Render. It connects to MongoDB Atlas and contains the D1 export/import utility.
- `render.yaml` describes the Render API service. `next.config.ts` proxies formatted workbook downloads to the API.

## Local development

Use Node.js 22.13 or newer. Edit the local environment files first: root `.env.local` sets the frontend API URL, and `backend/.env` sets MongoDB and API secrets. Example templates are `.env.example` and `backend/.env.example`.

```powershell
cd backend
npm ci
npm run dev
```

In another terminal, start Next.js from the repository root:

```powershell
npm ci
npm run dev
```

For the exact deployment variables and D1 migration procedure, see [backend/README.md](backend/README.md).

## Dashboards

Normal sign-in opens `/dashboard` for both roles; accounts with a temporary password must change it first. Workers see only their assigned records and communities. The online-only Admin dashboard shows active workers, community totals, separate registry counts, and coverage by Barangay. Its review list highlights active workers without a valid Purok assignment, Puroks without an active worker, and incomplete Timbang measurements. The unassigned-worker link opens Administration with that account filter selected.

## Offline use

Sign in as a worker while online once on each device and allow preparation to finish. Any worker page now prepares both the **Vitamin A & Deworming** and **Operation Timbang** registries, including assigned communities; there is no separate passphrase. If connectivity drops, the cached workspace keeps Dashboard, both registries, Notifications, and the portfolio placeholder reachable through desktop and mobile navigation. Workers can view, add, edit, and delete records in either registry and keep unfinished forms when switching pages. Queues remain separate by worker and program. Saved changes in both queues sync on reconnect and retry every 30 seconds while the app is open. Interrupted requests retry using the same record ID. Conflicts require a choice before overwriting an online edit. The registry can return online after sync when no form or dialog is in use.

Copies and pending changes are encrypted in IndexedDB with a non-exportable key stored by that browser. Device access follows the last worker sign-in and closes on sign-out or an Admin sign-in. Pending changes are kept separately for each worker, and sync verifies the current server session and worker identity. An expired session requires normal online sign-in before sync can resume. Browser storage clearing removes unsynced records, so use a trusted device and keep the app open when reconnecting. **Admin pages, account settings, sign-in, and formatted Excel export require internet.** Legacy passphrase-protected copies are left untouched; they are not imported into the new automatic store.

## Deployment

The Vercel project root is the repository root. Set `RENDER_API_URL` to the Render API HTTPS origin in Vercel. Create the API service from `render.yaml` and set its Atlas connection string, frontend origin, and one-time Admin setup token. Import the D1 snapshot into an empty Atlas database before opening the new frontend to users.

The former Cloudflare deployment is not changed by local code edits. Do not switch traffic away from it until the Render API and Vercel frontend are configured and the imported accounts and records are verified.

## Privacy

See [SECURITY.md](SECURITY.md) for account protections, deployment requirements, request validation, and the limits of automatic offline access.

The system stores identifying information about children and guardians. Restrict Atlas and deployment access to authorized staff. The temporary D1 migration snapshot includes password hashes, is written under the ignored `outputs/` directory by default, and should be deleted after import.
