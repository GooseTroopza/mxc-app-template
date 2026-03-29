/**
 * Database Schema — App Tables + Migrations
 *
 * Demonstrates:
 * - app_tracker_* table creation (follows MXC naming convention)
 * - Tracked migrations for schema evolution
 * - Idempotent initialisation (safe to call on every startup)
 */

interface DatabaseClient {
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number } | void;
    get(...params: unknown[]): unknown;
    all?(...params: unknown[]): unknown[];
  };
}

// ---------------------------------------------------------------------------
// DDL — CREATE TABLE statements
// ---------------------------------------------------------------------------

const DDL_STATEMENTS: readonly string[] = [
  // ── Items (the core entity) ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS app_tracker_items (
    id          TEXT    PRIMARY KEY,
    tenant_id   TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'open'
                        CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority    TEXT    NOT NULL DEFAULT 'medium'
                        CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    assignee    TEXT,
    tags        TEXT    DEFAULT '[]',
    created_by  TEXT,
    updated_by  TEXT,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  )`,

  // ── Comments (nested resource on items) ──────────────────────────────────
  `CREATE TABLE IF NOT EXISTS app_tracker_comments (
    id          TEXT    PRIMARY KEY,
    tenant_id   TEXT    NOT NULL,
    item_id     TEXT    NOT NULL
                        REFERENCES app_tracker_items(id) ON DELETE CASCADE,
    body        TEXT    NOT NULL,
    author      TEXT,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  )`,

  // ── Settings (app-level configuration per tenant) ────────────────────────
  `CREATE TABLE IF NOT EXISTS app_tracker_settings (
    tenant_id           TEXT PRIMARY KEY,
    default_priority    TEXT NOT NULL DEFAULT 'medium',
    notification_email  TEXT,
    auto_close_days     INTEGER NOT NULL DEFAULT 14
  )`,

  // ── Indexes ──────────────────────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_tracker_items_tenant
    ON app_tracker_items(tenant_id)`,

  `CREATE INDEX IF NOT EXISTS idx_tracker_items_status
    ON app_tracker_items(tenant_id, status)`,

  `CREATE INDEX IF NOT EXISTS idx_tracker_comments_item
    ON app_tracker_comments(item_id)`,
];

// ---------------------------------------------------------------------------
// Migration tracking
// ---------------------------------------------------------------------------

const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS app_tracker_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  INTEGER NOT NULL DEFAULT (unixepoch())
)`;

function runMigration(db: DatabaseClient, version: number, sql: string): void {
  db.prepare(MIGRATIONS_TABLE).run();
  const existing = db.prepare(
    'SELECT version FROM app_tracker_migrations WHERE version = ?'
  ).get(version);
  if (existing) return;
  db.prepare(sql).run();
  db.prepare('INSERT INTO app_tracker_migrations (version) VALUES (?)').run(version);
}

// ---------------------------------------------------------------------------
// initDatabase — run all DDL + migrations
// ---------------------------------------------------------------------------

export function initDatabase(db: DatabaseClient): void {
  for (const statement of DDL_STATEMENTS) {
    db.prepare(statement).run();
  }

  // Tracked migrations (add new ones as the schema evolves):
  runMigration(db, 1, `SELECT 1`); // baseline

  // Example future migration:
  // runMigration(db, 2, `ALTER TABLE app_tracker_items ADD COLUMN due_date TEXT`);

  console.log('[tracker] Database schema initialised');
}

export const TRACKER_TABLES = [
  'app_tracker_items',
  'app_tracker_comments',
  'app_tracker_settings',
  'app_tracker_migrations',
] as const;
