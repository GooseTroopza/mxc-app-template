/**
 * Items List Page — CRUD with filters
 * Demonstrates: useApiQuery, useApiMutation, form handling, cache invalidation
 */

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '../hooks/useApi';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';

interface Item {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string | null;
  created_at: number;
}

export function ItemsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const queryPath = statusFilter
    ? `/api/tracker/items?status=${statusFilter}`
    : '/api/tracker/items';

  const { data: items, isLoading, error, refetch } = useApiQuery<Item[]>(queryPath);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');

  const createMutation = useApiMutation<{ title: string; priority: string }, Item>(
    '/api/tracker/items',
    'POST',
    { invalidate: [queryPath] },
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createMutation.mutateAsync({ title: title.trim(), priority });
    setTitle('');
    setShowCreate(false);
    refetch();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Items</h1>
          <p className="text-sm text-muted-foreground">All tracked items</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showCreate ? 'Cancel' : '+ New Item'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Item title..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
          </form>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Items list */}
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-red-500">Error: {error.message}</p>}
      {items && items.length === 0 && (
        <Card>
          <p className="text-center text-muted-foreground py-8">
            No items found. Click "+ New Item" to create one.
          </p>
        </Card>
      )}
      {items && items.map((item) => (
        <Card key={item.id}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium">{item.title}</h3>
              {item.description && (
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {item.assignee && `Assigned to ${item.assignee} · `}
                {new Date(item.created_at * 1000).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge value={item.status} />
              <Badge value={item.priority} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
