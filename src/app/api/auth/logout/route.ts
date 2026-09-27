import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/backend/core/auth';
import { prisma } from '@/backend/core/db';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/backend/core/session';

export async function POST(req: Request) {
  const current = await getCurrentUser(req);
  let endpoint: string | null = null;
  try {
    const body = await req.json();
    if (body?.endpoint && typeof body.endpoint === 'string' && body.endpoint.length <= 10000) {
      endpoint = body.endpoint;
    }
  } catch (_e) {
    // Body is optional on logout
  }

  if (current) {
    const userId = BigInt(current.id);
    // Revocation failure must never keep the user signed in, so it is logged, not thrown.
    await prisma.$transaction(async (tx) => {
      const condition: { user_id: bigint; revoked_at: null; endpoint?: string } = {
        user_id: userId,
        revoked_at: null,
      };
      if (endpoint) {
        condition.endpoint = endpoint;
      }
      const revoked = await tx.pushSubscription.updateMany({
        where: condition,
        data: { revoked_at: new Date() },
      });
      if (revoked.count) {
        await tx.auditLog.create({
          data: {
            table_name: 'push_subscription',
            record_id: userId,
            action: 'PUSH_SUBSCRIPTIONS_REVOKED_ON_LOGOUT',
            new_values: {
              count: revoked.count,
              endpoint: endpoint || 'ALL_DEVICE_SUBSCRIPTIONS',
            },
            user_id: userId,
          },
        });
      }
    }).catch((err) => console.error('[AUTH_LOGOUT_PUSH_REVOKE_ERROR]', err));
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions(0), expires: new Date(0) });
  return response;
}
