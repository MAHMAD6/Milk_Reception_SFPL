import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getErrorMessage } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const { path, tag } = await req.json();

    if (path) {
      revalidatePath(path);
      return NextResponse.json({ revalidated: true, type: 'path', value: path });
    }

    if (tag) {
      // Expire immediately (pre-Next-16 behaviour) rather than stale-while-revalidate.
      revalidateTag(tag, { expire: 0 });
      return NextResponse.json({ revalidated: true, type: 'tag', value: tag });
    }

    return NextResponse.json({ error: 'Missing path or tag parameter' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to revalidate cache', details: getErrorMessage(error) }, { status: 500 });
  }
}
