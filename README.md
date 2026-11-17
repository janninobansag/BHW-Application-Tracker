# BHW Child Records

A shared child registry for Barangay Health Workers. Workers can add and correct children in their assigned barangays, see male and female totals, and export a filtered CSV. An administrator manages accounts, passwords, and barangay assignments.

## Project structure

- `Data/` holds the D1 context, schema, entities, repositories, and database commands. D1 is the live site's EF Core equivalent.
- `Services/` holds child age and CSV rules, password hashing, authentication workflows, and staff validation.
- `Resources/` holds shared labels and messages.
- `Client/` holds server action controllers, page views, authentication integration, Tailwind styling, and asset sources.

Vinext requires `app/` route entry points, `public/` assets, and `drizzle/` migrations at the repository root. The route files are thin adapters into `Client/`; `public/favicon.svg` is the deployable copy of `Client/assets/favicon.svg`.

## Local development

Requires Node.js 22.13 or newer. Install dependencies with `npm ci`, then generate the D1 migration with `npm run db:generate`. Build once with `npm run build` to create `dist/server/wrangler.json`, then apply `drizzle/0000_keen_the_hood.sql` locally:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_keen_the_hood.sql
```

Run `npm run dev` for local preview. `node --test tests/bhw.test.mjs tests/password.test.mjs` runs the date, CSV, and password checks.

On a new deployment, the site owner first visits `/setup` through ChatGPT sign-in and chooses the seeded **Admin** account's password. That action creates the example Tulay/Joy and Tipay/Jan assignments. Joy and Jan have no usable passwords until Admin sets temporary passwords and activates them. The current hosted site has completed setup and uses a public login page; child records still require an active account.

## Security model

Every record read, edit, and CSV export is scoped on the server to the signed-in worker's assigned barangays. Admin can see all records. Passwords are salted Argon2id hashes; sessions are stored as hashes in D1 and carried in secure, HTTP-only cookies in production. Deactivating an account or resetting its password revokes its sessions. CSV values are quoted and spreadsheet formula prefixes are neutralized.

The application stores identifiable information about children. Keep the hosting deployment and D1 database access restricted to authorized staff, and handle downloaded CSV files accordingly.
