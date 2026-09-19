import { NextRequest, NextResponse } from 'next/server';
import { adminUploadSupportAttachment } from '@/lib/tapknock-api';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { base64, file_name, mime_type } = body;
    if (!base64) {
      return NextResponse.json({ error: 'base64 is required' }, { status: 400 });
    }
    const data = await adminUploadSupportAttachment(base64, file_name || 'attachment.bin', mime_type || 'application/octet-stream');
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
