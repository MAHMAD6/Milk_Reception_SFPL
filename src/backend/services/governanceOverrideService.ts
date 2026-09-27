import { prisma } from '@core/db';

/**
 * Governance overrides are quality decisions where a manager's final decision differs
 * from the evaluated/recommended one:
 *   - ZMCC gate:        lab session final_decision != attendant_recommendation
 *   - Plant reception:  portion plant_decision != original_plant_decision after QA manager review
 *
 * Executive audit outcomes (approve / flag) are recorded in audit_log against the
 * underlying record, so the audit trail stays with the operational data.
 */

export type GovernanceAuditStatus = 'PENDING_AUDIT' | 'APPROVED' | 'FLAGGED';
export type GovernanceAuditAction = 'APPROVED' | 'FLAGGED';

export interface GovernanceOverride {
  id: string;
  reference: string;
  sourceName: string;
  stage: 'ZMCC_GATE' | 'PLANT_RECEPTION';
  failedParameter: string;
  failedValue: string;
  toleranceLimit: string;
  attendantNote: string;
  managerJustification: string;
  overruledBy: string;
  timestamp: string;
  status: GovernanceAuditStatus;
}

const LOOKBACK_DAYS = 30;
const MAX_ROWS = 200;

const AUDIT_ACTION_BY_DECISION: Record<GovernanceAuditAction, string> = {
  APPROVED: 'GOVERNANCE_OVERRIDE_APPROVED',
  FLAGGED: 'GOVERNANCE_OVERRIDE_FLAGGED',
};

const ZMCC_PREFIX = 'ZLS-';
const PLANT_PREFIX = 'VP-';

type ParsedOverrideId = { table: 'zmcc_lab_session' | 'visit_portion'; recordId: bigint };

export function parseGovernanceOverrideId(id: unknown): ParsedOverrideId | null {
  if (typeof id !== 'string') return null;
  const match = /^(ZLS|VP)-(\d{1,18})$/.exec(id.trim());
  if (!match) return null;
  return { table: match[1] === 'ZLS' ? 'zmcc_lab_session' : 'visit_portion', recordId: BigInt(match[2]) };
}

function userLabel(user: { full_name: string | null; username: string; role: string } | null | undefined): string {
  if (!user) return 'Unknown';
  return `${user.full_name || user.username} (${user.role})`;
}

function formatResultValue(result: { numeric_value: unknown; text_value: string | null }): string {
  if (result.numeric_value !== null && result.numeric_value !== undefined) return String(Number(result.numeric_value));
  return result.text_value || '—';
}

function formatRuleLimit(rule: { min_value: unknown; max_value: unknown; acceptable_option: string | null } | null | undefined): string {
  if (!rule) return '—';
  if (rule.acceptable_option) return rule.acceptable_option;
  const min = rule.min_value !== null && rule.min_value !== undefined ? Number(rule.min_value) : null;
  const max = rule.max_value !== null && rule.max_value !== undefined ? Number(rule.max_value) : null;
  if (min !== null && max !== null) return `${min} – ${max}`;
  if (min !== null) return `≥ ${min}`;
  if (max !== null) return `≤ ${max}`;
  return '—';
}

function summarizeFailures(
  results: Array<{ name: string; value: string; limit: string }>,
  fallbackParameter: string
): Pick<GovernanceOverride, 'failedParameter' | 'failedValue' | 'toleranceLimit'> {
  if (results.length === 0) {
    return { failedParameter: fallbackParameter, failedValue: '—', toleranceLimit: '—' };
  }
  return {
    failedParameter: results.map((r) => r.name).join(', '),
    failedValue: results.map((r) => r.value).join(', '),
    toleranceLimit: results.map((r) => r.limit).join(', '),
  };
}

async function loadAuditStatuses(keys: ParsedOverrideId[]): Promise<Map<string, GovernanceAuditStatus>> {
  const statuses = new Map<string, GovernanceAuditStatus>();
  if (keys.length === 0) return statuses;

  const rows = await prisma.auditLog.findMany({
    where: {
      table_name: { in: ['zmcc_lab_session', 'visit_portion'] },
      record_id: { in: keys.map((k) => k.recordId) },
      action: { in: Object.values(AUDIT_ACTION_BY_DECISION) },
    },
    orderBy: { created_at: 'desc' },
    select: { table_name: true, record_id: true, action: true },
  });

  for (const row of rows) {
    const key = `${row.table_name}:${row.record_id}`;
    if (statuses.has(key)) continue; // newest decision wins
    statuses.set(key, row.action === AUDIT_ACTION_BY_DECISION.APPROVED ? 'APPROVED' : 'FLAGGED');
  }
  return statuses;
}

export async function listGovernanceOverrides(now: Date = new Date()): Promise<GovernanceOverride[]> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const userSelect = { select: { full_name: true, username: true, role: true } } as const;

  const [zmccSessions, plantPortions] = await Promise.all([
    prisma.zmccLabSession.findMany({
      where: {
        status: 'COMPLETED',
        attendant_recommendation: { not: null },
        final_decision: { not: null },
        final_decided_at: { gte: since },
      },
      include: {
        zmcc: { select: { name: true } },
        final_decider: userSelect,
        attendant_recommender: userSelect,
        mot_arrival: { select: { zmcc_token: true } },
        contractor_arrival: { select: { zmcc_token: true } },
        local_supplier_arrival: { select: { zmcc_token: true } },
        results: {
          where: { is_passed: false },
          include: { applied_rule: { select: { min_value: true, max_value: true, acceptable_option: true } } },
          orderBy: { display_order_snapshot: 'asc' },
        },
      },
      orderBy: { final_decided_at: 'desc' },
      take: MAX_ROWS,
    }),
    prisma.visitPortion.findMany({
      where: {
        original_plant_decision: { not: null },
        plant_decision: { not: null },
        manager_reviewed_by_user_id: { not: null },
        manager_reviewed_at: { gte: since },
      },
      include: {
        visit: {
          select: {
            vehicle_number: true,
            token_number: true,
            visit_number: true,
            procurement_source: { select: { name: true } },
          },
        },
        manager_reviewer: userSelect,
        plant_lab_results: {
          where: { is_passed: false },
          include: {
            lab_test: { select: { testName: true } },
            applied_rule: { select: { min_value: true, max_value: true, acceptable_option: true } },
          },
        },
      },
      orderBy: { manager_reviewed_at: 'desc' },
      take: MAX_ROWS,
    }),
  ]);

  const zmccOverrides = zmccSessions.filter(
    (s) => s.attendant_recommendation!.toUpperCase() !== s.final_decision!.toUpperCase()
  );
  const plantOverrides = plantPortions.filter(
    (p) => p.original_plant_decision!.toUpperCase() !== p.plant_decision!.toUpperCase()
  );

  const statuses = await loadAuditStatuses([
    ...zmccOverrides.map((s) => ({ table: 'zmcc_lab_session' as const, recordId: s.id })),
    ...plantOverrides.map((p) => ({ table: 'visit_portion' as const, recordId: p.id })),
  ]);

  const items: GovernanceOverride[] = [
    ...zmccOverrides.map((s) => {
      const token =
        s.mot_arrival?.zmcc_token || s.contractor_arrival?.zmcc_token || s.local_supplier_arrival?.zmcc_token || null;
      return {
        id: `${ZMCC_PREFIX}${s.id}`,
        reference: token || `Lab session ${s.id}`,
        sourceName: s.zmcc.name,
        stage: 'ZMCC_GATE' as const,
        ...summarizeFailures(
          s.results.map((r) => ({ name: r.test_name_snapshot, value: formatResultValue(r), limit: formatRuleLimit(r.applied_rule) })),
          'Lab decision'
        ),
        attendantNote: [
          `Attendant recommended ${s.attendant_recommendation}${s.attendant_recommender ? ` (${userLabel(s.attendant_recommender)})` : ''}.`,
          s.remarks || '',
        ].filter(Boolean).join(' '),
        managerJustification: s.final_decision_reason || '—',
        overruledBy: userLabel(s.final_decider),
        timestamp: (s.final_decided_at || s.completed_at || s.updated_at).toISOString(),
        status: statuses.get(`zmcc_lab_session:${s.id}`) || 'PENDING_AUDIT',
      };
    }),
    ...plantOverrides.map((p) => ({
      id: `${PLANT_PREFIX}${p.id}`,
      reference: `${p.visit.token_number || p.visit.visit_number} · ${p.visit.vehicle_number} · P${p.portion_number}`,
      sourceName: p.visit.procurement_source?.name || 'Unknown source',
      stage: 'PLANT_RECEPTION' as const,
      ...summarizeFailures(
        p.plant_lab_results.map((r) => ({ name: r.lab_test.testName, value: formatResultValue(r), limit: formatRuleLimit(r.applied_rule) })),
        'Plant QA decision'
      ),
      attendantNote: `Original decision ${p.original_plant_decision}; final decision ${p.plant_decision}.`,
      managerJustification: p.manager_review_reason || p.plant_correction_reason || '—',
      overruledBy: userLabel(p.manager_reviewer),
      timestamp: (p.manager_reviewed_at || p.updated_at).toISOString(),
      status: statuses.get(`visit_portion:${p.id}`) || 'PENDING_AUDIT',
    })),
  ];

  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** Returns false when the id does not reference an existing override record. */
export async function recordGovernanceAudit(input: {
  overrideId: string;
  action: GovernanceAuditAction;
  remarks: string | null;
  userId: bigint;
}): Promise<boolean> {
  const parsed = parseGovernanceOverrideId(input.overrideId);
  if (!parsed) return false;

  const exists =
    parsed.table === 'zmcc_lab_session'
      ? await prisma.zmccLabSession.findUnique({ where: { id: parsed.recordId }, select: { id: true } })
      : await prisma.visitPortion.findUnique({ where: { id: parsed.recordId }, select: { id: true } });
  if (!exists) return false;

  await prisma.auditLog.create({
    data: {
      table_name: parsed.table,
      record_id: parsed.recordId,
      action: AUDIT_ACTION_BY_DECISION[input.action],
      new_values: { override_id: input.overrideId, audit_decision: input.action, remarks: input.remarks },
      user_id: input.userId,
    },
  });
  return true;
}
