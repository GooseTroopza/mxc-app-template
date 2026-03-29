# MXC App Template — Tracker

A **fully integrated reference implementation** for building MXC platform apps. This isn't a minimal starter — it demonstrates every platform capability: auth, permissions, data, events, workflows, webhooks, settings, frontend pages, and batch jobs.

Clone it, rename `tracker` to your app, and build on it.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/GooseTroopza/mxc-app-template.git my-app
cd my-app

# 2. Find-replace 'tracker' with your app id
#    (lowercase, no spaces — used in table names, routes, permissions)

# 3. Install + build
npm install
npm run build

# 4. Install in MXC
#    Push to GitHub, tag a release, then from MXC admin:
#    POST /api/apps/install {"source": "github:your-org/my-app"}
```

## What's Inside

### Server (`src/server/`)

| File | What it demonstrates |
|------|---------------------|
| `index.ts` | App manifest, `setup()`, ctx.auth wiring, client bundle serving, event + workflow registration |
| `routes/items.ts` | Full CRUD with auth middleware (`tracker:view`, `tracker:edit`, `tracker:admin`) |
| `routes/settings.ts` | Per-tenant app settings (GET/PUT) |
| `routes/batch.ts` | Scheduled job endpoints: daily digest + auto-close stale items |
| `db/schema.ts` | App tables (`app_tracker_*`), migrations, idempotent init |
| `events/emitters.ts` | Typed event emission helpers (tracker:item-created, etc.) |
| `events/handlers.ts` | Platform event subscription (data:sync-completed) |
| `workflows/actions.ts` | Workflow triggers + action handlers (assign, change_status, add_comment) |

### Client (`src/client/`)

| File | What it demonstrates |
|------|---------------------|
| `mxc-entry.tsx` | Shell entry: process polyfill, ReactDOM export, MemoryRouter with prefix strip |
| `hooks/useApi.ts` | Authenticated fetch helpers (`credentials: 'include'`) |
| `pages/DashboardPage.tsx` | Stats cards + recent items list |
| `pages/ItemsPage.tsx` | Full CRUD: create form, status filters, cache invalidation |
| `pages/ItemDetailPage.tsx` | Detail view, status transitions, comments (nested resource) |
| `pages/SettingsPage.tsx` | Settings form with save/load pattern |
| `components/Card.tsx` | Minimal card component |
| `components/Badge.tsx` | Status/priority badge with colour variants |

## Platform Capabilities Used

| Capability | Where | How |
|------------|-------|-----|
| **Auth** | `routes/*.ts` | `ctx.auth.requirePermission('tracker:edit')` |
| **Permissions** | `index.ts` manifest | 3 levels: `tracker:view`, `tracker:edit`, `tracker:admin` |
| **App DB** | `db/schema.ts` | `app_tracker_items`, `app_tracker_comments`, `app_tracker_settings` tables |
| **Migrations** | `db/schema.ts` | Tracked migration system with version numbers |
| **Tenant ID** | All routes/queries | `ctx.tenantId` — no hardcoded "default" |
| **Events** | `events/*.ts` | Emits 6 event types, subscribes to `data:sync-completed` |
| **Workflows** | `workflows/actions.ts` | 2 triggers (`item.created`, `item.status_changed`), 3 actions (`assign`, `change_status`, `add_comment`) |
| **Settings** | `index.ts` manifest + `routes/settings.ts` | 3 settings fields shown in MXC admin UI |
| **Sidebar menu** | `index.ts` manifest | 3-layer menu with Lucide icon names |
| **Frontend** | `mxc-entry.tsx` + pages | 4 React pages in isolated root |
| **Client bundle** | `vite.config.mxc.ts` | ESM lib build, process polyfill, no externals |
| **Batch jobs** | `routes/batch.ts` | Daily digest + auto-close endpoints for MXC cron |
| **CI/CD** | `.github/workflows/release.yml` | Dual build (server + client), BusyBox-safe tarball |

## Key Patterns

### Auth — use ctx.auth, not dynamic imports
```ts
// ✅ Correct — works in all environments
const view = ctx.auth.requirePermission('tracker:view') as MiddlewareHandler;
app.get('/items', view, handler);

// ❌ Wrong — silently fails in containers
const { requirePermission } = await import('@mxc/auth');
```

### Client bundle — readFileSync, not serveStatic
```ts
// ✅ Correct — anchored to __dirname, works in Docker
const bundle = readFileSync(resolve(__dirname, 'mxc-client/index.js'), 'utf-8');
app.get('/client/index.js', (c) => c.text(bundle, 200, { 'Content-Type': 'application/javascript' }));

// ❌ Wrong — process.cwd() is /app in Docker, not your install dir
app.use('/client/*', serveStatic({ root: 'dist/mxc-client' }));
```

### MemoryRouter — strip the app prefix
```tsx
// ✅ Correct — /tracker/dashboard becomes /dashboard
const initialPath = window.location.pathname.replace(/^\/tracker/, '') || '/';
<MemoryRouter initialEntries={[initialPath]}>

// ❌ Wrong — /tracker/dashboard doesn't match any routes
<MemoryRouter initialEntries={[window.location.pathname]}>
```

### API calls — always include credentials
```ts
// ✅ Correct — sends MXC session cookie
fetch('/api/tracker/items', { credentials: 'include' });

// ❌ Wrong — 401 on every request
fetch('/api/tracker/items');
```

### CI tarball — named directory for BusyBox tar
```yaml
# ✅ Correct — works with both GNU tar and BusyBox tar
run: mkdir -p _release/app && cp -r dist package.json manifest.json _release/app/ && tar -czf app.tar.gz -C _release app

# ❌ Wrong — BusyBox tar handles ./ differently
run: tar -czf app.tar.gz -C . .
```

## Customising

1. **Rename:** Find-replace `tracker` with your app id in all files
2. **Permissions:** Change `tracker:view`/`tracker:edit`/`tracker:admin` to your own
3. **Tables:** Modify `db/schema.ts` — add your own tables, rename existing ones
4. **Routes:** Replace `routes/items.ts` with your own CRUD resources
5. **Events:** Update `events/emitters.ts` with your domain events
6. **Workflows:** Define your own triggers and actions in `workflows/actions.ts`
7. **Frontend:** Replace the pages with your own React components
8. **Settings:** Update the settings schema in the manifest and `routes/settings.ts`
9. **Menu:** Update the `menu` field in the manifest with your navigation structure

## Building

```bash
npm run build:server      # TypeScript → dist/
npm run build:mxc-client  # Vite → dist/mxc-client/index.js
npm run build             # Both
```

## Deploying

1. Push to GitHub
2. Tag: `git tag v1.0.0 && git push --tags`
3. CI builds and creates a release with `app.tar.gz`
4. In MXC: `POST /api/apps/install {"source": "github:your-org/my-app"}`
5. Updates: `POST /api/apps/my-app/update`

## Architecture Notes

- **Isolated React root:** Shell uses React 19, this template bundles React 18. They can't share. The shell mounts your app in its own `createRoot()` using your bundled ReactDOM.
- **MemoryRouter:** The shell owns `window.history`. Your app uses `MemoryRouter` for internal navigation, initialized to the stripped sub-path.
- **readFileSync:** Docker containers have `process.cwd() = /app` regardless of where your app is installed. Anchoring to `__dirname` (from `import.meta.url`) is the only reliable path.
- **BusyBox tar:** Alpine Linux uses BusyBox tar which handles `./` prefixed paths differently with `--strip-components=1`. Use a named directory in your tarball.
