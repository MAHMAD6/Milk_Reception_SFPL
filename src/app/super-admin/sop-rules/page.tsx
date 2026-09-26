'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

interface Rule {
  id: string;
  testCode: string;
  testName: string;
  resultType: string;
  unit: string | null;
  version: number;
  ruleCategory: string;
  minValue: number | null;
  maxValue: number | null;
  acceptableOption: string | null;
  warningTrigger: string | null;
  decisionConsequence: string | null;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export default function SuperAdminSopRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRules() {
      try {
        const res = await fetch('/api/super-admin/sop-rules');
        const data = await res.json();
        if (res.ok) setRules(data.rules || []);
        else setError(data.error);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load rules.');
      } finally {
        setLoading(false);
      }
    }

    loadRules();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">SOP Laboratory Rules & Thresholds</h1>
        <p className="text-xs font-medium text-slate-500 mt-1">
          Configure quality acceptance rules and parameter limits.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SOP RULES TABLE */}
      <div className="bg-white rounded-xl border border-border/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-subtle text-slate-600 border-b border-border">
              <tr>
                <th className="p-3 font-semibold">Lab Test</th>
                <th className="p-3 font-semibold">Category</th>
                <th className="p-3 font-semibold">Version</th>
                <th className="p-3 font-semibold">Numeric Range</th>
                <th className="p-3 font-semibold">Acceptable Option</th>
                <th className="p-3 font-semibold">Consequence</th>
                <th className="p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 tabular-nums">
                    Loading versioned SOP rules...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 tabular-nums">
                    No active SOP rules configured yet.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-semibold text-foreground">{r.testName}</div>
                      <div className="tabular-nums text-xs text-slate-500">{r.testCode}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded tabular-nums text-xs font-semibold ${
                        r.ruleCategory === 'RELEASE' ? 'bg-emerald-100 text-emerald-900' : 'bg-blue-100 text-blue-900'
                      }`}>
                        {r.ruleCategory}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums font-semibold text-slate-700">v{r.version}</td>
                    <td className="p-3 tabular-nums text-slate-700">
                      {r.minValue !== null || r.maxValue !== null ? (
                        `${r.minValue ?? '-'} to ${r.maxValue ?? '-'} ${r.unit || ''}`
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3 tabular-nums text-slate-700">{r.acceptableOption || '-'}</td>
                    <td className="p-3 tabular-nums text-slate-700">{r.decisionConsequence || '-'}</td>
                    <td className="p-3">
                      {r.isActive ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-xs font-semibold">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
