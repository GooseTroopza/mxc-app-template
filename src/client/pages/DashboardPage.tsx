/**
 * Dashboard Page — shows stats and recent items
 * Demonstrates: useApiQuery, Card components, loading states
 */

import { useApiQuery } from '../hooks/useApi';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';

interface Item {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: number;
}

interface ItemsResponse {
  items: Item[];
  total: number;
}

export function DashboardPage() {
  const { data: items, isLoading, error } = useApiQuery<Item[]>('/api/tracker/items?limit=10');

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of all tracked items</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Items" value={items?.length ?? '—'} />
        <StatCard label="Open" value={items?.filter(i => i.status === 'open').length ?? '—'} />
        <StatCard label="In Progress" value={items?.filter(i => i.status === 'in_progress').length ?? '—'} />
        <StatCard label="Resolved" value={items?.filter(i => i.status === 'resolved').length ?? '—'} />
      </div>

      {/* Recent items */}
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Recent Items</h2>
        {isLoading && <p className="text-muted-foreground">Loading...</p>}
        {error && <p className="text-red-500">Error: {error.message}</p>}
        {items && items.length === 0 && (
          <p className="text-muted-foreground">No items yet. Create one to get started.</p>
        )}
        {items && items.length > 0 && (
          <div className="divide-y divide-border">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.created_at * 1000).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge value={item.status} />
                  <Badge value={item.priority} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
