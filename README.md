# BHW Child Records

A shared child registry for Barangay Health Workers. Workers can add and correct children in their assigned barangays, see male and female totals, and export a filtered CSV. An administrator manages accounts, passwords, and barangay assignments.

## Local development

Requires Node.js 22.13 or newer. Install dependencies with `npm ci`, then generate the D1 migration with `npm run db:generate`. Build once with `npm run build` to create `dist/server/wrangler.json`, then apply `drizzle/0000_keen_the_hood.sql` locally:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_keen_the_hood.sql
```

Run `npm run dev` for local preview. `node --test tests/bhw.test.mjs` runs the date and CSV checks.

The first hosted deployment must remain owner-only. The site owner visits `/setup` through ChatGPT sign-in and chooses the seeded **Admin** account's password. That action creates the example Tulay/Joy and Tipay/Jan assignments. Joy and Jan have no usable passwords until Admin sets temporary passwords and activates them. Once setup is complete, the hosting access mode can be changed to public so staff can reach the app's own login page.

## Security model

Every record read, edit, and CSV export is scoped on the server to the signed-in worker's assigned barangays. Admin can see all records. Passwords are salted PBKDF2-HMAC-SHA256 hashes; sessions are stored as hashes in D1 and carried in secure, HTTP-only cookies in production. Deactivating an account or resetting its password revokes its sessions. CSV values are quoted and spreadsheet formula prefixes are neutralized.

The application stores identifiable information about children. Keep the hosting deployment and D1 database access restricted to authorized staff, and handle downloaded CSV files accordingly.
