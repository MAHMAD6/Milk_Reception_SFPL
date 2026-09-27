import { NextResponse } from 'next/server';
import { recordGpsBatch } from '@/backend/services/motService';
import { safeErrorMessage } from '@/backend/core/apiGuard';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await recordGpsBatch(req, body);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data, { status: result.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: safeErrorMessage(err, 'An unexpected error occurred while recording GPS batch.') },
      { status: 500 }
    );
  }
}
