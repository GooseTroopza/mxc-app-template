/**
 * MXC App Template — Server Entry Point
 *
 * This file demonstrates ALL MXC platform capabilities:
 * - App manifest with permissions, events, workflows, settings, menu
 * - setup() wiring: auth, tenant, appDb, events, workflows, client bundle
 * - Hono API routes with auth middleware
 * - Event emission and subscription
 * - Workflow trigger/action registration
 *
 * To customise: rename 'tracker' throughout, modify routes/schema/manifest.
 */

import { Hono } from 'hono';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createItemRoutes } from './routes/items.js';
import { createSettingsRoutes } from './routes/settings.js';
import { createBatchRoutes } from './routes/batch.js';
import { initDatabase } from './db/schema.js';
import { setupEventHandlers } from './events/handlers.js';
import { WORKFLOW_TRIGGERS, WORKFLOW_ACTIONS, createActionHandlers } from './workflows/actions.js';

// ---------------------------------------------------------------------------
// __dirname for ESM — used for client bundle serving
// ---------------------------------------------------------------------------
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ---------------------------------------------------------------------------
// Read MXC client bundle once at startup (Docker-safe — anchored to __dirname)
// ---------------------------------------------------------------------------
let clientBundle: string;
try {
  clientBundle = readFileSync(resolve(__dirname, 'mxc-client/index.js'), 'utf-8');
} catch {
  clientBundle = '// MXC client bundle not found';
  console.warn('[tracker] dist/mxc-client/index.js not found — frontend will not load');
}

// ---------------------------------------------------------------------------
// App Manifest — declares ALL platform capabilities
// ---------------------------------------------------------------------------
export const TRACKER_MANIFEST = {
  id: 'tracker',
  name: 'Tracker',
  version: '1.0.0',
  description: 'MXC App Template — reference implementation for all platform capabilities',
  tier: 'free' as const,

  // ── Permissions ──────────────────────────────────────────────────────────
  // Registered in MXC's permission system on install. Admin role gets all.
  permissions: [
    'tracker:view',    // Read items, dashboard
    'tracker:edit',    // Create/update items and comments
    'tracker:admin',   // Settings, batch jobs, delete
  ],

  // ── Routes ───────────────────────────────────────────────────────────────
  routes: {
    api: '/api/tracker',
    pages: '/tracker',
  },

  // ── Frontend bundle path ─────────────────────────────────────────────────
  // Shell dynamically imports this URL and mounts the React app
  pageEntry: '/api/tracker/client/index.js',

  // ── Sidebar icon (Lucide icon name — shell resolves to actual SVG) ───────
  icon: 'ClipboardList',

  // ── 3-Layer Navigation Menu ──────────────────────────────────────────────
  menu: {
    main: {
      label: 'Tracker',
      icon: 'ClipboardList',
      items: {
        dashboard: { label: 'Dashboard', icon: 'LayoutDashboard', route: '/tracker/dashboard' },
        items: { label: 'Items', icon: 'ListTodo', route: '/tracker/items' },
      },
    },
    settings: {
      label: 'Settings',
      icon: 'Settings',
      route: '/tracker/settings',
    },
  },

  // ── Events — what this app emits and subscribes to ───────────────────────
  events: {
    emits: [
      'tracker:item-created',
      'tracker:item-updated',
      'tracker:item-status-changed',
      'tracker:item-deleted',
      'tracker:comment-added',
      'tracker:batch-digest-completed',
    ],
    subscribes: [
      'data:sync-completed',  // Platform event: data sync finished
    ],
  },

  // ── Workflow Triggers — events that can start workflows ──────────────────
  triggers: WORKFLOW_TRIGGERS,

  // ── Workflow Actions — things workflows can invoke on this app ────────────
  actions: WORKFLOW_ACTIONS,

  // ── App Settings — shown in MXC admin UI, stored per-tenant ──────────────
  settings: [
    {
      key: 'default_priority',
      label: 'Default Priority',
      type: 'select' as const,
      description: 'Priority assigned to new items when not specified',
      default: 'medium',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' },
      ],
    },
    {
      key: 'notification_email',
      label: 'Notification Email',
      type: 'text' as const,
      description: 'Email address for daily digest and critical alerts',
      required: false,
    },
    {
      key: 'auto_close_days',
      label: 'Auto-close after (days)',
      type: 'number' as const,
      description: 'Automatically close resolved items after this many days (0 = disabled)',
      default: 14,
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Types — minimal for template (expand as needed)
// ---------------------------------------------------------------------------

/** Database client interface (better-sqlite3 compatible) */
interface DatabaseClient {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number };
  };
}

/** MXC App Context — injected by the platform into setup() */
interface AppContext {
  events: {
    on(eventType: string, handler: (event: unknown) => void): void;
    off(eventType: string, handler: (event: unknown) => void): void;
    emit(event: unknown): Promise<void>;
  };
  logger: {
    log(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
  };
  appDb: {
    raw: DatabaseClient;
  };
  tenantId: string;
  auth: {
    requireAuth(): unknown;
    requirePermission(permission: string): unknown;
    requireRole(role: string): unknown;
  };
  settings?: Record<string, unknown>;
}

interface AppSetupResult {
  api: Hono;
  eventHandlers: Record<string, (event: unknown) => Promise<void> | void>;
  actionHandlers: Record<string, (input: Record<string, unknown>, ctx: AppContext) => Promise<unknown>>;
  teardown: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// createTrackerApp — builds the Hono API router
// ---------------------------------------------------------------------------
export function createTrackerApp(
  db: DatabaseClient,
  tenantId: string,
  auth: AppContext['auth'],
): Hono {
  const app = new Hono();

  // ── Client bundle serving (must be before wildcard middleware) ──────────
  app.get('/client/index.js', (c) =>
    c.text(clientBundle, 200, { 'Content-Type': 'application/javascript' })
  );

  // ── Health check (no auth) ─────────────────────────────────────────────
  app.get('/health', (c) =>
    c.json({
      ok: true,
      app: 'tracker',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    })
  );

  // ── Debug route (REMOVE IN PRODUCTION) ─────────────────────────────────
  app.get('/debug/auth', async (c) => {
    const cookie = c.req.header('cookie') ?? 'NO COOKIE HEADER';
    const hasMxcAccess = cookie.includes('mxc_access');

    // Try running requireAuth manually to see what happens
    let authResult = 'not tested';
    let sessionData: unknown = null;
    try {
      const authMiddleware = auth.requireAuth() as (c: unknown, next: () => Promise<void>) => Promise<unknown>;
      let nextCalled = false;
      await authMiddleware(c, async () => { nextCalled = true; });
      authResult = nextCalled ? 'PASSED' : 'BLOCKED (next not called)';
      try { sessionData = c.get('session'); } catch { sessionData = 'no session'; }
    } catch (err) {
      authResult = 'THREW: ' + (err instanceof Error ? err.message : String(err));
    }

    return c.json({
      ok: true,
      debug: {
        hasMxcAccessCookie: hasMxcAccess,
        cookieLength: cookie.length,
        authResult,
        session: sessionData,
        url: c.req.url,
      },
    });
  });

  // ── Global auth — all routes below require authentication ──────────────
  // requireAuth() sets c.get('session') from the MXC cookie/Bearer token.
  // Individual routes then check permissions via requirePermission().
  app.use('/items/*', auth.requireAuth() as import('hono').MiddlewareHandler);
  app.use('/settings/*', auth.requireAuth() as import('hono').MiddlewareHandler);
  app.use('/batch/*', auth.requireAuth() as import('hono').MiddlewareHandler);

  // ── API routes ─────────────────────────────────────────────────────────
  app.route('/items', createItemRoutes(db, tenantId, auth));
  app.route('/settings', createSettingsRoutes(db, tenantId, auth));
  app.route('/batch', createBatchRoutes(db, tenantId, auth));

  return app;
}

// ---------------------------------------------------------------------------
// setup() — MXC platform entry point
// ---------------------------------------------------------------------------
export async function setup(ctx: AppContext): Promise<AppSetupResult> {
  const db = ctx.appDb.raw;

  // 1. Initialise database schema
  initDatabase(db);
  ctx.logger.log('[tracker] Database schema ready');

  // 2. Create Hono API router
  const api = createTrackerApp(db, ctx.tenantId, ctx.auth);
  ctx.logger.log('[tracker] API routes mounted');

  // 3. Wire event handlers
  const unsubscribe = setupEventHandlers({
    events: ctx.events,
    logger: ctx.logger,
    db,
    tenantId: ctx.tenantId,
  });
  ctx.logger.log('[tracker] Event handlers wired');

  // 4. Create workflow action handlers
  const actionHandlers = createActionHandlers(db, ctx.tenantId, ctx.events, ctx.logger);
  ctx.logger.log('[tracker] Workflow actions registered');

  // 5. Platform event subscriptions
  const eventHandlers: Record<string, (event: unknown) => Promise<void> | void> = {
    'data:sync-completed': async (event) => {
      ctx.logger.log('[tracker] data:sync-completed received', event);
      // Example: refresh cached data, update dashboards, etc.
    },
  };

  return {
    api,
    eventHandlers,
    actionHandlers,
    teardown: async () => {
      unsubscribe();
      ctx.logger.log('[tracker] Teardown complete');
    },
  };
}

// ---------------------------------------------------------------------------
// Default export — MXC app loader convention
// ---------------------------------------------------------------------------
export default { manifest: TRACKER_MANIFEST, setup };
