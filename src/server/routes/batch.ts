/**
 * Batch Routes — scheduled job endpoints
 *
 * POST /batch/daily-digest — triggered by MXC cron scheduler
 * POST /batch/auto-close   — close stale resolved items
 *
 * Demonstrates the background job pattern: MXC calls these endpoints
 * on a schedule. The app does the work and returns results.
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

export function createBatchRoutes(
  db: DatabaseClient,
  tenantId: string,
  auth: { requirePermission(p: string): unknown },
): Hono {
  const app = new Hono();

  const admin = auth.requirePermission('tracker:admin') as MiddlewareHandler;

  // ── Daily digest — summarise recent activity ───────────────────────────
  app.post('/daily-digest', admin, (c) => {
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

    const created = db.prepare(
      'SELECT COUNT(*) as count FROM app_tracker_items WHERE tenant_id = ? AND created_at >= ?'
    ).get(tenantId, oneDayAgo) as { count: number };

    const resolved = db.prepare(
      'SELECT COUNT(*) as count FROM app_tracker_items WHERE tenant_id = ? AND status = ? AND updated_at >= ?'
    ).get(tenantId, 'resolved', oneDayAgo) as { count: number };

    const open = db.prepare(
      'SELECT COUNT(*) as count FROM app_tracker_items WHERE tenant_id = ? AND status IN (?, ?)'
    ).get(tenantId, 'open', 'in_progress') as { count: number };

    const digest = {
      period: '24h',
      created: created.count,
      resolved: resolved.count,
      open: open.count,
      timestamp: new Date().toISOString(),
    };

    console.log('[tracker] Daily digest:', digest);
    return c.json({ ok: true, data: digest });
  });

  // ── Auto-close — close stale resolved items ────────────────────────────
  app.post('/auto-close', admin, (c) => {
    const settings = db.prepare(
      'SELECT auto_close_days FROM app_tracker_settings WHERE tenant_id = ?'
    ).get(tenantId) as { auto_close_days: number } | undefined;

    const days = settings?.auto_close_days ?? 14;
    if (days === 0) {
      return c.json({ ok: true, data: { closed: 0, message: 'Auto-close disabled' } });
    }

    const cutoff = Math.floor(Date.now() / 1000) - (days * 86400);
    const result = db.prepare(
      'UPDATE app_tracker_items SET status = ?, updated_at = ? WHERE tenant_id = ? AND status = ? AND updated_at < ?'
    ).run('closed', Math.floor(Date.now() / 1000), tenantId, 'resolved', cutoff);

    console.log(`[tracker] Auto-closed ${result.changes} items older than ${days} days`);
    return c.json({ ok: true, data: { closed: result.changes, threshold_days: days } });
  });

  return app;
}
