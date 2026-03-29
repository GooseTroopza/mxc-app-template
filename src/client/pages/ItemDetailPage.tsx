/**
 * Item Detail Page — shows item details + comments
 * Demonstrates: route params, nested resources, status transitions
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
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
  tags: string;
  created_at: number;
  updated_at: number;
}

interface Comment {
  id: string;
  body: string;
  author: string | null;
  created_at: number;
}

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: item, isLoading, error, refetch } = useApiQuery<Item>(
    `/api/tracker/items/${id}`,
    { enabled: !!id },
  );
  const { data: comments, refetch: refetchComments } = useApiQuery<Comment[]>(
    `/api/tracker/items/${id}/comments`,
    { enabled: !!id },
  );

  const updateMutation = useApiMutation<Partial<Item>, Item>(
    `/api/tracker/items/${id}`,
    'PUT',
  );

  const commentMutation = useApiMutation<{ body: string }, Comment>(
    `/api/tracker/items/${id}/comments`,
    'POST',
  );

  const [commentBody, setCommentBody] = useState('');

  if (isLoading) return <p className="p-6 text-muted-foreground">Loading...</p>;
  if (error) return <p className="p-6 text-red-500">Error: {error.message}</p>;
  if (!item) return <p className="p-6 text-muted-foreground">Item not found</p>;

  const handleStatusChange = async (newStatus: string) => {
    await updateMutation.mutateAsync({ status: newStatus });
    refetch();
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await commentMutation.mutateAsync({ body: commentBody.trim() });
    setCommentBody('');
    refetchComments();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{item.title}</h1>
        <div className="mt-2 flex gap-2">
          <Badge value={item.status} />
          <Badge value={item.priority} />
          {item.assignee && (
            <span className="text-xs text-muted-foreground">→ {item.assignee}</span>
          )}
        </div>
      </div>

      {/* Description */}
      {item.description && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Description</h2>
          <p className="text-sm">{item.description}</p>
        </Card>
      )}

      {/* Status transitions */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Status</h2>
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={item.status === s || updateMutation.isPending}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                item.status === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent disabled:opacity-50'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </Card>

      {/* Comments */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Comments ({comments?.length ?? 0})</h2>
        {comments && comments.length > 0 && (
          <div className="mb-4 divide-y divide-border">
            {comments.map((c) => (
              <div key={c.id} className="py-3">
                <p className="text-sm">{c.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.author ?? 'Anonymous'} · {new Date(c.created_at * 1000).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleComment} className="flex gap-2">
          <input
            type="text"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={commentMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Comment
          </button>
        </form>
      </Card>

      {/* Metadata */}
      <Card>
        <h2 className="mb-2 text-sm font-semibold">Details</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Created</dt>
          <dd>{new Date(item.created_at * 1000).toLocaleString()}</dd>
          <dt className="text-muted-foreground">Updated</dt>
          <dd>{new Date(item.updated_at * 1000).toLocaleString()}</dd>
          <dt className="text-muted-foreground">ID</dt>
          <dd className="font-mono text-xs">{item.id}</dd>
        </dl>
      </Card>
    </div>
  );
}
