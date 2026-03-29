/**
 * Items CRUD Routes — demonstrates full REST pattern with MXC auth
 *
 * GET    /items          — list (tracker:view)
 * GET    /items/:id      — detail (tracker:view)
 * POST   /items          — create (tracker:edit)
 * PUT    /items/:id      — update (tracker:edit)
 * DELETE /items/:id      — delete (tracker:admin)
 * POST   /items/:id/comments — add comment (tracker:edit)
 * GET    /items/:id/comments  — list comments (tracker:view)
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

export function createItemRoutes(
  db: DatabaseClient,
  tenantId: string,
  auth: {
    requireAuth(): unknown;
    requirePermission(p: string): unknown;
  },
): Hono {
  const app = new Hono();

  const view = auth.requirePermission('tracker:view') as MiddlewareHandler;
  const edit = auth.requirePermission('tracker:edit') as MiddlewareHandler;
  const admin = auth.requirePermission('tracker:admin') as MiddlewareHandler;

  // ── List items ─────────────────────────────────────────────────────────
  app.get('/', view, (c) => {
    const status = c.req.query('status');
    const priority = c.req.query('priority');
    const limit = parseInt(c.req.query('limit') ?? '50', 10);
    const offset = parseInt(c.req.query('offset') ?? '0', 10);

    let sql = 'SELECT * FROM app_tracker_items WHERE tenant_id = ?';
    const params: unknown[] = [tenantId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const items = db.prepare(sql).all(...params);
    const total = db.prepare(
      'SELECT COUNT(*) as count FROM app_tracker_items WHERE tenant_id = ?'
    ).get(tenantId) as { count: number };

    return c.json({ ok: true, data: items, total: total.count });
  });

  // ── Get single item ────────────────────────────────────────────────────
  app.get('/:id', view, (c) => {
    const item = db.prepare(
      'SELECT * FROM app_tracker_items WHERE id = ? AND tenant_id = ?'
    ).get(c.req.param('id'), tenantId);

    if (!item) return c.json({ ok: false, error: 'Item not found' }, 404);
    return c.json({ ok: true, data: item });
  });

  // ── Create item ────────────────────────────────────────────────────────
  app.post('/', edit, async (c) => {
    const body = await c.req.json<{
      title: string;
      description?: string;
      priority?: string;
      assignee?: string;
      tags?: string[];
    }>();

    if (!body.title?.trim()) {
      return c.json({ ok: false, error: 'title is required' }, 400);
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO app_tracker_items (id, tenant_id, title, description, priority, assignee, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tenantId,
      body.title.trim(),
      body.description ?? '',
      body.priority ?? 'medium',
      body.assignee ?? null,
      JSON.stringify(body.tags ?? []),
      now,
      now,
    );

    const item = db.prepare('SELECT * FROM app_tracker_items WHERE id = ?').get(id);
    return c.json({ ok: true, data: item }, 201);
  });

  // ── Update item ────────────────────────────────────────────────────────
  app.put('/:id', edit, async (c) => {
    const id = c.req.param('id');
    const existing = db.prepare(
      'SELECT * FROM app_tracker_items WHERE id = ? AND tenant_id = ?'
    ).get(id, tenantId) as Record<string, unknown> | undefined;

    if (!existing) return c.json({ ok: false, error: 'Item not found' }, 404);

    const body = await c.req.json<Record<string, unknown>>();
    const allowed = ['title', 'description', 'status', 'priority', 'assignee', 'tags'];
    const updates: string[] = [];
    const params: unknown[] = [];

    for (const field of allowed) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(field === 'tags' ? JSON.stringify(body[field]) : body[field]);
      }
    }

    if (updates.length === 0) {
      return c.json({ ok: false, error: 'No valid fields to update' }, 400);
    }

    updates.push('updated_at = ?');
    params.push(Math.floor(Date.now() / 1000));
    params.push(id, tenantId);

    db.prepare(
      `UPDATE app_tracker_items SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`
    ).run(...params);

    const updated = db.prepare('SELECT * FROM app_tracker_items WHERE id = ?').get(id);
    return c.json({ ok: true, data: updated });
  });

  // ── Delete item ────────────────────────────────────────────────────────
  app.delete('/:id', admin, (c) => {
    const id = c.req.param('id');
    const result = db.prepare(
      'DELETE FROM app_tracker_items WHERE id = ? AND tenant_id = ?'
    ).run(id, tenantId);

    if (result.changes === 0) {
      return c.json({ ok: false, error: 'Item not found' }, 404);
    }
    return c.json({ ok: true, data: { deleted: true } });
  });

  // ── Add comment ────────────────────────────────────────────────────────
  app.post('/:id/comments', edit, async (c) => {
    const itemId = c.req.param('id');
    const item = db.prepare(
      'SELECT id FROM app_tracker_items WHERE id = ? AND tenant_id = ?'
    ).get(itemId, tenantId);

    if (!item) return c.json({ ok: false, error: 'Item not found' }, 404);

    const body = await c.req.json<{ body: string; author?: string }>();
    if (!body.body?.trim()) {
      return c.json({ ok: false, error: 'body is required' }, 400);
    }

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO app_tracker_comments (id, tenant_id, item_id, body, author, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, tenantId, itemId, body.body.trim(), body.author ?? null, Math.floor(Date.now() / 1000));

    const comment = db.prepare('SELECT * FROM app_tracker_comments WHERE id = ?').get(id);
    return c.json({ ok: true, data: comment }, 201);
  });

  // ── List comments ──────────────────────────────────────────────────────
  app.get('/:id/comments', view, (c) => {
    const itemId = c.req.param('id');
    const comments = db.prepare(
      'SELECT * FROM app_tracker_comments WHERE item_id = ? AND tenant_id = ? ORDER BY created_at ASC'
    ).all(itemId, tenantId);
    return c.json({ ok: true, data: comments });
  });

  return app;
}
