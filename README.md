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

## Offline use

Sign in as a worker and open **Child records** while online once on each device. The app automatically prepares assigned records for offline use without a separate passphrase or an offline navigation button. When connectivity drops, it opens a cached registry with the same shared styles, filters, eight-record pages, forms, and Edit/Delete menus, and preserves an unfinished child form. Workers can view, add, edit, and delete assigned records. Changes are saved locally before sync; an interrupted request retries with the same record ID. The open app syncs on reconnect and retries every 30 seconds. If someone changed the same record online, the workspace asks which version to keep before an edit or deletion. Once sync succeeds, the app returns to the online registry when no form or dialog is in use.

Copies and pending changes are encrypted in IndexedDB with a non-exportable key stored by that browser. Device access follows the last worker sign-in and closes on sign-out or an Admin sign-in. Pending changes are kept separately for each worker, and sync verifies the current server session and worker identity. An expired session requires normal online sign-in before sync can resume. Browser storage clearing removes unsynced records, so use a trusted device and keep the app open when reconnecting. **Admin pages, account settings, sign-in, and formatted Excel export require internet.** Legacy passphrase-protected copies are left untouched; they are not imported into the new automatic store.

## Deployment

The Vercel project root is the repository root. Set `RENDER_API_URL` to the Render API HTTPS origin in Vercel. Create the API service from `render.yaml` and set its Atlas connection string, frontend origin, and one-time Admin setup token. Import the D1 snapshot into an empty Atlas database before opening the new frontend to users.

The former Cloudflare deployment is not changed by local code edits. Do not switch traffic away from it until the Render API and Vercel frontend are configured and the imported accounts and records are verified.

## Privacy

The system stores identifying information about children and guardians. Restrict Atlas and deployment access to authorized staff. The temporary D1 migration snapshot includes password hashes, is written under the ignored `outputs/` directory by default, and should be deleted after import.
