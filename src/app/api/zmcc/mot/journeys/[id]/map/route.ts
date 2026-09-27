import { NextResponse } from 'next/server';
import { getJourneyMapData } from '@/backend/services/motService';
import { safeErrorMessage } from '@/backend/core/apiGuard';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getJourneyMapData(req, id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data, { status: result.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: safeErrorMessage(err, 'An unexpected error occurred while fetching journey map data.') },
      { status: 500 }
    );
  }
}
