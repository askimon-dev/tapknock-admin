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
