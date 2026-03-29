/**
 * Settings Routes — app-level configuration per tenant
 *
 * GET /settings — read current settings (tracker:view)
 * PUT /settings — update settings (tracker:admin)
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';

interface DatabaseClient {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number };
  };
}

export function createSettingsRoutes(
  db: DatabaseClient,
  tenantId: string,
  auth: { requirePermission(p: string): unknown },
): Hono {
  const app = new Hono();

  const view = auth.requirePermission('tracker:view') as MiddlewareHandler;
  const admin = auth.requirePermission('tracker:admin') as MiddlewareHandler;

  app.get('/', view, (c) => {
    let settings = db.prepare(
      'SELECT * FROM app_tracker_settings WHERE tenant_id = ?'
    ).get(tenantId) as Record<string, unknown> | undefined;

    if (!settings) {
      // Return defaults
      settings = {
        tenant_id: tenantId,
        default_priority: 'medium',
        notification_email: null,
        auto_close_days: 14,
      };
    }

    return c.json({ ok: true, data: settings });
  });

  app.put('/', admin, async (c) => {
    const body = await c.req.json<{
      default_priority?: string;
      notification_email?: string;
      auto_close_days?: number;
    }>();

    // Upsert
    db.prepare(`
      INSERT INTO app_tracker_settings (tenant_id, default_priority, notification_email, auto_close_days)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET
        default_priority = excluded.default_priority,
        notification_email = excluded.notification_email,
        auto_close_days = excluded.auto_close_days
    `).run(
      tenantId,
      body.default_priority ?? 'medium',
      body.notification_email ?? null,
      body.auto_close_days ?? 14,
    );

    const settings = db.prepare(
      'SELECT * FROM app_tracker_settings WHERE tenant_id = ?'
    ).get(tenantId);
    return c.json({ ok: true, data: settings });
  });

  return app;
}
