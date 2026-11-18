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

While online, a BHW can open **Child records**, choose **Enable offline access**, and save an encrypted copy of their assigned child records using a separate offline passphrase. Open **Offline records** from the top navigation and unlock that copy with the BHW username and offline passphrase. If the connection drops on a records page, the app automatically opens the offline workspace unless a child form has unsaved entries; in that case it keeps the form open to prevent losing those entries. BHWs can view, add, and edit cached records; queued changes sync automatically after connectivity returns. If a record was changed online by someone else, the offline workspace asks which version to keep.

Offline copies are stored only in that browser on that device. Keep the passphrase safe: it is not stored or recoverable, and unsynced edits cannot be recovered if it is forgotten. **Admin tools and formatted Excel export still require internet.**

## Deployment

The Vercel project root is the repository root. Set `RENDER_API_URL` to the Render API HTTPS origin in Vercel. Create the API service from `render.yaml` and set its Atlas connection string, frontend origin, and one-time Admin setup token. Import the D1 snapshot into an empty Atlas database before opening the new frontend to users.

The former Cloudflare deployment is not changed by local code edits. Do not switch traffic away from it until the Render API and Vercel frontend are configured and the imported accounts and records are verified.

## Privacy

The system stores identifying information about children and guardians. Restrict Atlas and deployment access to authorized staff. The temporary D1 migration snapshot includes password hashes, is written under the ignored `outputs/` directory by default, and should be deleted after import.
