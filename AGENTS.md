# Repository Guidelines

## Project Structure & Module Organization

`app/` contains thin Next.js route entries; page UI and shared components live in `Client/`. Put frontend business rules in `Services/` and API adapters and types in `Data/`. The Express and MongoDB API is in `backend/src/`; its integration and report tests are in `backend/ci-tests/`. Root `tests/` and `Services/tests/` cover frontend logic. Static images, PWA files, and offline scripts live in `public/`. Keep deployment configuration in `render.yaml` and `.github/workflows/ci.yml`.

## Build, Test, and Development Commands

Use Node.js 22.13.0 or newer. From the repository root, run `npm ci` and `npm run dev` for Next.js at `http://localhost:3000`. In a second terminal, run `cd backend`, `npm ci`, and `npm run dev` for the API at `http://localhost:10000`. Set the local variables shown in `.env.example` and `backend/.env.example` first.

Run `npm test`, `npm run lint`, and `npm run build` at the root. Run `npm test` and `npm run build` in `backend/` after API changes. CI runs these checks with MongoDB 7.0.

## Coding Style & Naming Conventions

Follow surrounding TypeScript, TSX, and JavaScript style: two-space indentation, semicolons, and double-quoted strings. Use kebab-case file names, PascalCase React components, and camelCase functions and variables. Keep route files small and reuse `Client/`, `Services/`, and `Data/` modules. ESLint uses Next.js Core Web Vitals and TypeScript rules; no separate formatter is configured.

## Testing Guidelines

Name root behavior tests `*.test.mjs`; place backend API and output tests in `backend/ci-tests/`. Add tests for changed validation, authorization, offline sync, or exports. Backend API integration tests need `MONGODB_URI`; they create and remove a uniquely named test database. Use a development MongoDB connection, never one containing production BHW records. No numeric coverage threshold is configured.

## Commit & Pull Request Guidelines

Recent commits use concise imperative subjects, often with `feat:` or `fix:`. Create focused feature branches from `develop`; review and merge there before promoting `develop` to `main`. PR descriptions should explain behavior, validation, compatibility, and data or security boundaries. Include screenshots for UI changes and link an issue when one exists. Do not push or deploy without an explicit request.

## Security & Configuration

Keep `.env.local`, `backend/.env`, database exports, and credentials out of Git. The frontend uses `RENDER_API_URL`; the API requires MongoDB, session secrets, and `FRONTEND_ORIGIN`. Review `SECURITY.md` before changing authentication, worker assignments, or encrypted offline storage.
