import { NextResponse } from 'next/server';
import { getJourneyMapData } from '@/backend/services/motService';
import { getErrorMessage } from '@/lib/errors';

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
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) || 'An unexpected error occurred while fetching journey map data.' },
      { status: 500 }
    );
  }
}
