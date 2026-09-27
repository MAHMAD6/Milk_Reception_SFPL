import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/backend/core/auth';
import { prisma } from '@/backend/core/db';
import { getSupplyChainLossHierarchy } from '@/backend/services/lossCalculationService';
import { safeErrorMessage } from '@/backend/core/apiGuard';

export async function GET(req: Request) {
  const current = await getCurrentUser(req);
  if (!current) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: BigInt(current.id) },
  });

  const allowedRoles = [
    'HEAD_OF_MPD',
    'SUPER_ADMIN',
    'EXECUTIVE_MANAGEMENT',
    'FINANCE_ACCOUNTS',
    'ZMCC_MANAGER',
    'DATA_EXECUTIVE',
    'QA_MANAGER',
    'QA_HEAD',
  ];

  if (!user || !user.is_active || !allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const searchParams = new URL(req.url).searchParams;
  const rawPeriod = searchParams.get('period');
  const period = (rawPeriod === 'wtd' || rawPeriod === 'mtd' || rawPeriod === 'custom') ? rawPeriod : 'today';
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  let zmccId: string | undefined = undefined;
  if (user.role === 'ZMCC_MANAGER') {
    // Source-scoped: never widen to system scope or accept a caller-chosen ZMCC.
    if (!user.procurement_source_id) {
      return NextResponse.json({ error: 'Forbidden. ZMCC Manager must be assigned to a ZMCC.' }, { status: 403 });
    }
    zmccId = user.procurement_source_id.toString();
  } else if (searchParams.get('zmccId')) {
    zmccId = searchParams.get('zmccId') || undefined;
    if (!/^\d+$/.test(zmccId || '')) {
      return NextResponse.json({ error: 'Invalid zmccId parameter.' }, { status: 400 });
    }
  }

  try {
    const result = await getSupplyChainLossHierarchy({
      period,
      from,
      to,
      zmccId,
    });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    const message = safeErrorMessage(error, 'Unable to calculate supply chain loss report.');
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
