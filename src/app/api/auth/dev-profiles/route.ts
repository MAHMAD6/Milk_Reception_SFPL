import { NextResponse } from 'next/server';
import { isDemoLoginEnabled } from '@core/demoLogin';

// Evaluated per request so ENABLE_DEMO_LOGIN is read at runtime, not baked in at build time.
export const dynamic = 'force-dynamic';

// One account per role, matching prisma/seed.ts. Served only when demo login is enabled.
const DEMO_PROFILES = [
  {
    group: 'DIRECTORATE & GOVERNANCE',
    items: [
      { label: 'Super Admin', department: 'System Administration', username: 'admin.superuser', password: 'admin123' },
      { label: 'Data Executive', department: 'Data & Analytics / QA Rules', username: 'data.executive', password: 'data123' },
      { label: 'Senior Executive Management', department: 'Executive Management', username: 'executive.management', password: 'exec123' },
      { label: 'Finance and Accounts', department: 'Finance & Accounts', username: 'finance.accounts', password: 'finance123' },
    ],
  },
  {
    group: 'MANAGERS & HEADS',
    items: [
      { label: 'MPD Head', department: 'Milk Procurement Directorate', username: 'mpd.head', password: 'mpdhead123' },
      { label: 'ZMCC / MPD Manager', department: 'Milk Procurement (Zone A - Hasilpur)', username: 'zmcc.manager.north', password: 'zone123' },
      { label: 'QA Head', department: 'Quality Assurance Directorate', username: 'qa.head', password: 'qahead123' },
      { label: 'QA Manager', department: 'Quality Assurance Management', username: 'qa.manager', password: 'qamgr123' },
      { label: 'Production Head', department: 'Production Directorate', username: 'production.head', password: 'prodhead123' },
      { label: 'Admin Head', department: 'Administration Directorate', username: 'admin.head', password: 'adminhead123' },
      { label: 'Plant Contractor Manager — Al Khair', department: 'Milk Procurement (Al Khair)', username: 'contractor.manager.alkhair', password: 'contractor123' },
    ],
  },
  {
    group: 'FIELD & PLANT OPERATORS',
    items: [
      { label: 'PHE Operator — Hasilpur', department: 'Milk Procurement (Hasilpur)', username: 'phe.operator', password: 'phe123' },
      { label: 'ZMCC Lab Attendant — Hasilpur', department: 'Milk Procurement (Hasilpur)', username: 'zmcc.operator', password: 'mpd123' },
      { label: 'MOT Field Operator', department: 'Milk Procurement (Hasilpur)', username: 'mot.driver', password: 'mot123' },
      { label: 'QA Lab Chemist', department: 'Quality Assurance Lab', username: 'qa.chemist', password: 'qa123' },
      { label: 'Weighbridge Operator', department: 'Production & Weighbridge', username: 'weighbridge.operator', password: 'weighbridge123' },
      { label: 'Production Reception Operator', department: 'Plant Production & Silos', username: 'production.operator', password: 'production123' },
      { label: 'Security Gate Operator', department: 'Security', username: 'security.gate', password: 'security123' },
    ],
  },
  {
    group: 'CONTRACTORS',
    items: [
      { label: 'Contractor Operator — Al Khair', department: 'Milk Procurement - Contractor Operations', username: 'contractor.operator.alkhair', password: 'mpd123' },
    ],
  },
];

export async function GET() {
  if (!isDemoLoginEnabled()) {
    return NextResponse.json({ profiles: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ profiles: DEMO_PROFILES }, { headers: { 'Cache-Control': 'no-store' } });
}
