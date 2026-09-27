import type { CanonicalRole } from './types';

/**
 * Role groups for read endpoints whose consumers are specific workspaces.
 * Keep these aligned with the page gates in src/app and the role navigation config.
 */
export const ROLE_GROUPS = {
  PLANT_QA: ['QA_LAB_ATTENDANT', 'QA_MANAGER', 'QA_HEAD', 'SUPER_ADMIN'],
  PRODUCTION: ['PRODUCTION_RECEPTION_OPERATOR', 'PRODUCTION_HEAD', 'SUPER_ADMIN'],
  /** Roles restricted to their own procurement source's operational records. */
  SOURCE_SCOPED_READERS: ['ZMCC_MANAGER', 'ZMCC_LAB_ATTENDANT', 'CONTRACTOR_MANAGER', 'CONTRACTOR_OPERATOR'],
  /** Roles that may read every procurement source's operational records. */
  SYSTEM_WIDE_READERS: [
    'SUPER_ADMIN',
    'HEAD_OF_MPD',
    'EXECUTIVE_MANAGEMENT',
    'DATA_EXECUTIVE',
    'FINANCE_ACCOUNTS',
    'ADMIN_HEAD',
    'QA_HEAD',
    'QA_MANAGER',
    'PRODUCTION_HEAD',
  ],
} as const satisfies Record<string, readonly CanonicalRole[]>;

export function roleIn(role: string | null | undefined, group: readonly CanonicalRole[]): boolean {
  return typeof role === 'string' && (group as readonly string[]).includes(role);
}
