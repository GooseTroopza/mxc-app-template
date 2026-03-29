/**
 * Event Handlers — subscribes to platform events
 *
 * Demonstrates subscribing to MXC platform events in setup().
 * Returns an unsubscribe function for teardown.
 */

interface EventBus {
  on(eventType: string, handler: (event: unknown) => void): void;
  off(eventType: string, handler: (event: unknown) => void): void;
}

interface DatabaseClient {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number };
  };
}

interface HandlerContext {
  events: EventBus;
  logger: { log(...args: unknown[]): void };
  db: DatabaseClient;
  tenantId: string;
}

export function setupEventHandlers(ctx: HandlerContext): () => void {
  const handlers: Array<{ eventType: string; handler: (event: unknown) => void }> = [];

  // ── data:sync-completed — fires when MXC finishes syncing entity data ──
  const onSyncCompleted = (event: unknown) => {
    ctx.logger.log('[tracker] Platform data sync completed — could refresh cached data here', event);
    // Example: invalidate caches, recount items, update dashboard stats
  };
  ctx.events.on('data:sync-completed', onSyncCompleted);
  handlers.push({ eventType: 'data:sync-completed', handler: onSyncCompleted });

  // Return unsubscribe function for teardown
  return () => {
    for (const { eventType, handler } of handlers) {
      ctx.events.off(eventType, handler);
    }
  };
}
