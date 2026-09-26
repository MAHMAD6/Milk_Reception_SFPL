import { NextResponse } from 'next/server';
import { recordGpsBatch } from '@/backend/services/motService';
import { getErrorMessage } from '@/lib/errors';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await recordGpsBatch(req, body);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data, { status: result.status });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) || 'An unexpected error occurred while recording GPS batch.' },
      { status: 500 }
    );
  }
}
