/**
 * Settings Page — app configuration UI
 * Demonstrates: settings API, form state, save/load pattern
 */

import { useState, useEffect } from 'react';
import { useApiQuery, useApiMutation } from '../hooks/useApi';
import { Card } from '../components/Card';

interface Settings {
  default_priority: string;
  notification_email: string | null;
  auto_close_days: number;
}

export function SettingsPage() {
  const { data: settings, isLoading } = useApiQuery<Settings>('/api/tracker/settings');

  const [form, setForm] = useState<Settings>({
    default_priority: 'medium',
    notification_email: null,
    auto_close_days: 14,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const saveMutation = useApiMutation<Settings, Settings>(
    '/api/tracker/settings',
    'PUT',
    { invalidate: ['/api/tracker/settings'] },
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveMutation.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (isLoading) return <p className="p-6 text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure the Tracker app</p>
      </div>

      <form onSubmit={handleSave}>
        <Card className="space-y-4">
          {/* Default priority */}
          <div>
            <label className="block text-sm font-medium">Default Priority</label>
            <p className="text-xs text-muted-foreground mb-1">
              Priority assigned to new items when not specified
            </p>
            <select
              value={form.default_priority}
              onChange={(e) => setForm({ ...form, default_priority: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Notification email */}
          <div>
            <label className="block text-sm font-medium">Notification Email</label>
            <p className="text-xs text-muted-foreground mb-1">
              Email for daily digest and critical alerts
            </p>
            <input
              type="email"
              value={form.notification_email ?? ''}
              onChange={(e) => setForm({ ...form, notification_email: e.target.value || null })}
              placeholder="alerts@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Auto-close days */}
          <div>
            <label className="block text-sm font-medium">Auto-close after (days)</label>
            <p className="text-xs text-muted-foreground mb-1">
              Close resolved items after this many days (0 = disabled)
            </p>
            <input
              type="number"
              value={form.auto_close_days}
              onChange={(e) => setForm({ ...form, auto_close_days: parseInt(e.target.value, 10) || 0 })}
              min={0}
              max={365}
              className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
            {saved && <span className="text-sm text-green-600">✓ Saved</span>}
          </div>
        </Card>
      </form>
    </div>
  );
}
