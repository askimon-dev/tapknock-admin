export const TAPKNOCK_API_BASE =
  process.env.TAPKNOCK_API_URL ||
  process.env.NEXT_PUBLIC_TAPKNOCK_API_URL ||
  'http://tapknock:8080';

export const ADMIN_SECRET =
  process.env.ADMIN_SECRET ||
  process.env.TAPKNOCK_SECRET ||
  'tapknock-admin-secret-key-2026';

export async function sendInternalPush(data: {
  title: string;
  body: string;
  target?: 'all' | 'targeted';
  account_ids?: string[];
  priority?: string;
  category?: string;
  action_url?: string | null;
  version_name?: string | null;
  version_code?: number | null;
  scheduled_at?: string | null;
  created_by?: string;
}) {
  const url = `${TAPKNOCK_API_BASE}/api/admin/push`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': ADMIN_SECRET,
      },
      body: JSON.stringify(data),
      cache: 'no-store',
    });
    return await res.json();
  } catch (err: any) {
    console.error('Failed to dispatch push to TapKnock backend:', err);
    return { ok: false, error: err.message };
  }
}

export async function fetchLiveBackendStats() {
  const url = `${TAPKNOCK_API_BASE}/api/admin/stats`;
  try {
    const res = await fetch(url, {
      headers: {
        'X-Admin-Secret': ADMIN_SECRET,
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function triggerTestRing(code: string, visitorName = 'Admin Test Ring') {
  const url = `${TAPKNOCK_API_BASE}/api/ring`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        visitor_name: visitorName,
        reason: 'delivery',
      }),
      cache: 'no-store',
    });
    return await res.json();
  } catch (err: any) {
    return { error: err.message };
  }
}

// ------------------------------------------------ Support Tickets API

export async function adminListSupportTickets(params?: {
  status?: string;
  priority?: string;
  assigned_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.priority && params.priority !== 'all') query.set('priority', params.priority);
  if (params?.assigned_to && params.assigned_to !== 'all') query.set('assigned_to', params.assigned_to);
  if (params?.search) query.set('search', params.search);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const url = `${TAPKNOCK_API_BASE}/api/admin/support/tickets?${query.toString()}`;
  const res = await fetch(url, {
    headers: { 'X-Admin-Secret': ADMIN_SECRET },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to list tickets: ${res.statusText}`);
  return await res.json();
}

export async function adminGetSupportTicket(id: string) {
  const url = `${TAPKNOCK_API_BASE}/api/admin/support/tickets/${id}`;
  const res = await fetch(url, {
    headers: { 'X-Admin-Secret': ADMIN_SECRET },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to get ticket: ${res.statusText}`);
  return await res.json();
}

export async function adminSendSupportMessage(
  ticketId: string,
  data: {
    sender_name?: string;
    message: string;
    attachments?: any[];
    update_status?: string | null;
  }
) {
  const url = `${TAPKNOCK_API_BASE}/api/admin/support/tickets/${ticketId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: JSON.stringify(data),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to send message: ${res.statusText}`);
  return await res.json();
}

export async function adminUpdateSupportTicket(ticketId: string, data: Record<string, any>) {
  const url = `${TAPKNOCK_API_BASE}/api/admin/support/tickets/${ticketId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: JSON.stringify(data),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to update ticket: ${res.statusText}`);
  return await res.json();
}

export async function adminAddSupportNote(ticketId: string, author: string, note: string) {
  const url = `${TAPKNOCK_API_BASE}/api/admin/support/tickets/${ticketId}/notes`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ author, note }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to add note: ${res.statusText}`);
  return await res.json();
}

export async function adminUploadSupportAttachment(base64: string, fileName: string, mimeType: string) {
  const url = `${TAPKNOCK_API_BASE}/api/admin/support/upload`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ base64, file_name: fileName, mime_type: mimeType }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to upload attachment: ${res.statusText}`);
  return await res.json();
}


// ------------------------------------------------------------------ issues
//
// The bug and feature queue. The server owns it, the same way it owns support
// tickets, so the panel, the admin app and a coding agent all read one thing.

export interface Issue {
  id: string;
  issue_number: number;
  reference: string;
  title: string;
  body: string | null;
  kind: 'bug' | 'feature' | 'improvement' | 'chore';
  status: 'open' | 'in_progress' | 'blocked' | 'fixed' | 'verified' | 'closed' | 'wont_fix';
  priority: 'low' | 'normal' | 'high' | 'critical';
  area: 'app' | 'server' | 'admin' | 'admin_app' | 'infra' | 'other';
  assigned_ai: 'claude' | 'antigravity' | null;
  steps: string | null;
  expected: string | null;
  actual: string | null;
  app_version: string | null;
  device_info: any;
  attachments: string[];
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
  branch: string | null;
  commit_sha: string | null;
  test_notes: string | null;
  fixed_in_version: string | null;
}

export interface IssueComment {
  id: string;
  issue_id: string;
  author: string;
  body: string;
  created_at: string;
}

const issueHeaders = {
  'Content-Type': 'application/json',
  'X-Admin-Secret': ADMIN_SECRET,
};

export async function adminListIssues(params?: {
  status?: string;
  kind?: string;
  priority?: string;
  area?: string;
  assigned_ai?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ issues: Issue[]; counts: Record<string, number> }> {
  const query = new URLSearchParams();
  for (const key of ['status', 'kind', 'priority', 'area', 'assigned_ai', 'search'] as const) {
    const value = params?.[key];
    if (value && value !== 'all') query.set(key, value);
  }
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));

  const res = await fetch(`${TAPKNOCK_API_BASE}/api/admin/issues?${query}`, {
    headers: issueHeaders,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to list issues: ${res.statusText}`);
  return await res.json();
}

export async function adminGetIssue(ref: string): Promise<{ issue: Issue; comments: IssueComment[] }> {
  const res = await fetch(`${TAPKNOCK_API_BASE}/api/admin/issues/${encodeURIComponent(ref)}`, {
    headers: issueHeaders,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to get issue: ${res.statusText}`);
  return await res.json();
}

export async function adminCreateIssue(data: Record<string, any>): Promise<{ issue: Issue }> {
  const res = await fetch(`${TAPKNOCK_API_BASE}/api/admin/issues`, {
    method: 'POST',
    headers: issueHeaders,
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Failed to create issue: ${res.statusText}`);
  return json;
}

export async function adminUpdateIssue(ref: string, data: Record<string, any>) {
  const res = await fetch(`${TAPKNOCK_API_BASE}/api/admin/issues/${encodeURIComponent(ref)}`, {
    method: 'PATCH',
    headers: issueHeaders,
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Failed to update issue: ${res.statusText}`);
  return json;
}

export async function adminDeleteIssue(ref: string) {
  const res = await fetch(`${TAPKNOCK_API_BASE}/api/admin/issues/${encodeURIComponent(ref)}`, {
    method: 'DELETE',
    headers: issueHeaders,
  });
  if (!res.ok) throw new Error(`Failed to delete issue: ${res.statusText}`);
  return await res.json();
}

export async function adminAddIssueComment(ref: string, author: string, body: string) {
  const res = await fetch(`${TAPKNOCK_API_BASE}/api/admin/issues/${encodeURIComponent(ref)}/comments`, {
    method: 'POST',
    headers: issueHeaders,
    body: JSON.stringify({ author, body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Failed to add comment: ${res.statusText}`);
  return json;
}
