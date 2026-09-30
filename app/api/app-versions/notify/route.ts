import { NextRequest, NextResponse } from 'next/server';
import { sendInternalPush } from '@/lib/tapknock-api';

export const dynamic = 'force-dynamic';

/**
 * Tells somebody on an old build that there is a new one.
 *
 * Takes the account ids explicitly rather than recomputing "who is outdated"
 * here: the list the operator is looking at is the list they meant, and a
 * second calculation could quietly disagree with the one on their screen.
 *
 * Accounts that have never connected are not in it. Pushing an update notice
 * at a phone that has never appeared is shouting at nobody.
 */
export async function POST(req: NextRequest) {
  try {
    const { account_ids: accountIds, version_name: versionName, download_url: downloadUrl } =
      await req.json();

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { error: 'nobody_to_notify', message: 'Nobody is on an old build.' },
        { status: 400 }
      );
    }

    const result = await sendInternalPush({
      title: `TapKnock ${versionName ?? ''} is available`.trim(),
      body: accountIds.length === 1
        ? `You're on an older version. Tap to update — it takes a minute.`
        : `You're on an older version of TapKnock. Tap to update.`,
      target: 'targeted',
      account_ids: accountIds,
      priority: 'normal',
      category: 'update',
      action_url: downloadUrl ?? null,
      version_name: versionName ?? null,
      created_by: 'admin',
    });

    return NextResponse.json({ ok: true, notified: accountIds.length, result });
  } catch (err: any) {
    return NextResponse.json({ error: 'server_error', message: err?.message }, { status: 500 });
  }
}
