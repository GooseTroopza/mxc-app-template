/**
 * Workflow Triggers + Actions
 *
 * Demonstrates MXC workflow engine integration:
 * - Triggers: events that can START a workflow
 * - Actions: things a workflow can INVOKE on this app
 *
 * Triggers are declared in the manifest and listened for by the workflow engine.
 * Actions are registered via actionHandlers in setup().
 */

interface EventBus {
  emit(event: unknown): Promise<void>;
}

interface DatabaseClient {
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number };
  };
}

// ---------------------------------------------------------------------------
// Trigger definitions — declared in manifest.triggers
// ---------------------------------------------------------------------------

export const WORKFLOW_TRIGGERS = [
  {
    id: 'item.created',
    label: 'Item Created',
    description: 'Fires when a new tracker item is created',
    schema: { title: 'string' as const, priority: 'string' as const },
  },
  {
    id: 'item.status_changed',
    label: 'Item Status Changed',
    description: 'Fires when an item status transitions (open → in_progress → resolved → closed)',
    schema: { itemId: 'string' as const, from: 'string' as const, to: 'string' as const },
  },
];

// ---------------------------------------------------------------------------
// Action definitions — declared in manifest.actions
// ---------------------------------------------------------------------------

export const WORKFLOW_ACTIONS = [
  {
    id: 'assign',
    label: 'Assign Item',
    description: 'Assign a tracker item to a user',
    inputSchema: { itemId: 'string' as const, assignee: 'string' as const },
  },
  {
    id: 'change_status',
    label: 'Change Item Status',
    description: 'Change a tracker item\'s status',
    inputSchema: { itemId: 'string' as const, status: 'string' as const },
  },
  {
    id: 'add_comment',
    label: 'Add Comment',
    description: 'Add a system comment to a tracker item',
    inputSchema: { itemId: 'string' as const, body: 'string' as const },
  },
];

// ---------------------------------------------------------------------------
// Action handlers — registered in setup() via actionHandlers
// ---------------------------------------------------------------------------

interface AppContext {
  tenantId: string;
  auth: unknown;
  events: EventBus;
  logger: { log(...args: unknown[]): void };
  appDb: { raw: DatabaseClient };
}

export function createActionHandlers(
  db: DatabaseClient,
  tenantId: string,
  events: EventBus,
  logger: { log(...args: unknown[]): void },
): Record<string, (input: Record<string, unknown>, ctx: AppContext) => Promise<unknown>> {
  return {
    // ── tracker.assign — assign an item to a user ────────────────────────
    assign: async (input) => {
      const { itemId, assignee } = input as { itemId: string; assignee: string };
      db.prepare(
        'UPDATE app_tracker_items SET assignee = ?, updated_at = ? WHERE id = ? AND tenant_id = ?'
      ).run(assignee, Math.floor(Date.now() / 1000), itemId, tenantId);
      logger.log(`[tracker:workflow] Assigned ${itemId} to ${assignee}`);
      return { ok: true, assignee };
    },

    // ── tracker.change_status — change an item's status ──────────────────
    change_status: async (input) => {
      const { itemId, status } = input as { itemId: string; status: string };
      const valid = ['open', 'in_progress', 'resolved', 'closed'];
      if (!valid.includes(status)) {
        return { ok: false, error: `Invalid status: ${status}` };
      }
      db.prepare(
        'UPDATE app_tracker_items SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?'
      ).run(status, Math.floor(Date.now() / 1000), itemId, tenantId);
      logger.log(`[tracker:workflow] Changed ${itemId} status to ${status}`);
      return { ok: true, status };
    },

    // ── tracker.add_comment — add a system comment ───────────────────────
    add_comment: async (input) => {
      const { itemId, body } = input as { itemId: string; body: string };
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO app_tracker_comments (id, tenant_id, item_id, body, author, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, tenantId, itemId, body, '[workflow]', Math.floor(Date.now() / 1000));
      logger.log(`[tracker:workflow] Added comment to ${itemId}`);
      return { ok: true, commentId: id };
    },
  };
}
