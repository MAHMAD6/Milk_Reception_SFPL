import { NextResponse } from 'next/server';
import { submitShopCollection } from '@/backend/services/motService';
import { getErrorMessage } from '@/lib/errors';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await submitShopCollection(req, body);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ...result.data, collection: result.data }, { status: result.status });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) || 'An unexpected error occurred while submitting collection.' },
      { status: 500 }
    );
  }
}
