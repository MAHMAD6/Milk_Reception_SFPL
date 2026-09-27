import { NextResponse } from 'next/server';
import { errorResponse, requireRoles } from '@/backend/core/apiGuard';
import { listGovernanceOverrides, recordGovernanceAudit } from '@/backend/services/governanceOverrideService';

export const dynamic = 'force-dynamic';

const READ_ROLES = ['HEAD_OF_MPD', 'QA_HEAD', 'EXECUTIVE_MANAGEMENT', 'DATA_EXECUTIVE', 'SUPER_ADMIN'] as const;
const AUDIT_ROLES = ['HEAD_OF_MPD', 'QA_HEAD', 'SUPER_ADMIN'] as const;

export async function GET(req: Request) {
  const access = await requireRoles(req, READ_ROLES);
  if (!access.ok) return access.response;

  try {
    const items = await listGovernanceOverrides();
    return NextResponse.json({ success: true, items }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: unknown) {
    return errorResponse('API_GOVERNANCE_EXCEPTIONS_GET_ERROR', error, 'Failed to fetch governance exceptions.');
  }
}

export async function POST(req: Request) {
  const access = await requireRoles(req, AUDIT_ROLES);
  if (!access.ok) return access.response;

  let body: { exceptionId?: unknown; action?: unknown; remarks?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { exceptionId, action, remarks } = body ?? {};
  if (typeof exceptionId !== 'string' || (action !== 'APPROVED' && action !== 'FLAGGED')) {
    return NextResponse.json({ error: 'Invalid action or exceptionId.' }, { status: 400 });
  }
  if (remarks !== undefined && remarks !== null && (typeof remarks !== 'string' || remarks.length > 2000)) {
    return NextResponse.json({ error: 'Remarks must be text of at most 2000 characters.' }, { status: 400 });
  }

  try {
    const recorded = await recordGovernanceAudit({
      overrideId: exceptionId,
      action,
      remarks: typeof remarks === 'string' && remarks.trim() ? remarks.trim() : null,
      userId: BigInt(access.user.id),
    });
    if (!recorded) {
      return NextResponse.json({ error: 'Governance exception not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Override ${exceptionId} has been marked as ${action}.`,
      auditedBy: access.user.username,
      auditedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return errorResponse('API_GOVERNANCE_EXCEPTIONS_POST_ERROR', error, 'Failed to audit governance exception.');
  }
}
