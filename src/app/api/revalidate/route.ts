import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireRoles } from '@core/apiGuard';

export async function POST(req: NextRequest) {
  const access = await requireRoles(req, ['SUPER_ADMIN']);
  if (!access.ok) return access.response;

  let body: { path?: unknown; tag?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }
  const { path, tag } = body ?? {};

  if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && path.length <= 500) {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, type: 'path', value: path });
  }

  if (typeof tag === 'string' && tag.trim() && tag.length <= 200) {
    // Expire immediately (pre-Next-16 behaviour) rather than stale-while-revalidate.
    revalidateTag(tag, { expire: 0 });
    return NextResponse.json({ revalidated: true, type: 'tag', value: tag });
  }

  return NextResponse.json({ error: 'Missing or invalid path or tag parameter' }, { status: 400 });
}
