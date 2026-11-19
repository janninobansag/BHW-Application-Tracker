# Security behavior

## Accounts and server access

Passwords use Argon2id. Session cookies are HttpOnly, SameSite=Strict, and use the `__Host-` prefix and Secure flag in production. Server sessions expire after 12 hours. Password changes, administrator password resets, and deactivation revoke server sessions.

Workers must change temporary passwords before accessing either registry, location lists, or exports. The API enforces this independently of page redirects. Administrator routes require the administrator role, and record requests enforce current Purok assignments, including offline sync.

## Request protections

API writes accept JSON objects only, with a 32 KB limit. MongoDB operator keys, prototype keys, nested payload abuse, invalid IDs, and non-string text fields are rejected before database queries. Foreign, malformed, opaque, and downgraded browser origins are rejected. Vercel server actions can send originless JSON; browsers use the same-origin `/api/backend/` proxy. CORS is intentionally not enabled for direct cross-origin browser access to Render.

Authentication uses MongoDB counters that survive API restarts and apply across instances. Login allows 120 requests per minute across the service and 20 per account per 15 minutes. Five failed attempts lock an account name for 15 minutes. Password verification allows 10 requests per signed-in account per 15 minutes; setup allows 10 requests per 15 minutes. Throttled responses include Retry-After. Temporary counters and login attempts expire using TTL indexes.

Private API responses, including errors, use no-store. API errors return generic messages and log only the error class, excluding database queries and connection details.

## Browser protection

Next.js HTML uses a fresh random CSP nonce for each response. Production permits trusted framework scripts and their dependencies without unsafe-inline or unsafe-eval for scripts. Development permits eval for the framework debugger. Static offline HTML loads local external scripts only. Inline styles remain permitted because the UI component library positions popovers with styles.

Headers prevent framing, restrict resource access, suppress referrer URLs, and disable unused camera, microphone, and geolocation access. Production HSTS starts with a five-minute lifetime. CSP violation reports are bounded in size and rate, and log only allowlisted directive counts, excluding URLs, samples, and user data. Trusted Types enforcement is not enabled: it requires a separate compatibility review of framework DOM sinks.

## Deployment

Set Render's FRONTEND_ORIGIN to the exact HTTPS production frontend origin, with no path or wildcard. Production startup rejects missing or placeholder SESSION_SECRET values and requires at least 32 characters. ADMIN_SETUP_TOKEN also requires at least 32 characters when present; remove it after setup. Generate independent random secrets, keep them in the deployment environment, and never commit them. Changing SESSION_SECRET signs out existing sessions.

## Offline access boundary

Worker copies are encrypted in IndexedDB using a non-exportable key stored by the same browser. This supports automatic offline access without a passphrase. Someone with access to an unlocked browser profile can use its offline records; this is not protection against a compromised device or malicious code running in that origin. Sign-out closes active offline access, while pending changes remain stored for that worker. A worker's server deactivation or assignment change is enforced on reconnect and cannot remotely erase a device while it is offline.

Admin pages and exports require the network. Sync verifies the current worker session and server permissions. Clearing browser storage deletes unsynced records.

## Verification

Frontend tests cover CSP construction and redacted reporting. Backend tests cover origin checks, malformed requests, production configuration, temporary-password enforcement, concurrent throttling, assignment boundaries, session revocation, and both registry workflows. Integration tests use a randomly named temporary database and delete that database after the run.
