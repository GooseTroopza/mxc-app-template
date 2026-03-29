/**
 * Event Emitters — typed helpers for emitting tracker events
 *
 * Demonstrates the MXC EventBus pattern:
 * - Events declared in manifest.events.emits
 * - Emitted via ctx.events.emit()
 * - Other apps/workflows can subscribe to these events
 */

interface EventBus {
  emit(event: unknown): Promise<void>;
}

/** Standard MXC event shape */
interface TrackerEvent {
  type: string;
  appId: string;
  tenantId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

function createEvent(type: string, tenantId: string, data: Record<string, unknown>): TrackerEvent {
  return {
    type,
    appId: 'tracker',
    tenantId,
    timestamp: new Date().toISOString(),
    data,
  };
}

export async function emitItemCreated(
  events: EventBus, tenantId: string, item: Record<string, unknown>,
): Promise<void> {
  await events.emit(createEvent('tracker:item-created', tenantId, { item }));
}

export async function emitItemUpdated(
  events: EventBus, tenantId: string, item: Record<string, unknown>, changes: string[],
): Promise<void> {
  await events.emit(createEvent('tracker:item-updated', tenantId, { item, changes }));
}

export async function emitItemStatusChanged(
  events: EventBus, tenantId: string, itemId: string, from: string, to: string,
): Promise<void> {
  await events.emit(createEvent('tracker:item-status-changed', tenantId, { itemId, from, to }));
}

export async function emitItemDeleted(
  events: EventBus, tenantId: string, itemId: string,
): Promise<void> {
  await events.emit(createEvent('tracker:item-deleted', tenantId, { itemId }));
}

export async function emitCommentAdded(
  events: EventBus, tenantId: string, itemId: string, commentId: string,
): Promise<void> {
  await events.emit(createEvent('tracker:comment-added', tenantId, { itemId, commentId }));
}
