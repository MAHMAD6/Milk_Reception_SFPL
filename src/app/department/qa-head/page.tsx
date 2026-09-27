'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@modules/shared/Header';
import { HierarchicalNavDrawer } from '@modules/shared/navigation/HierarchicalNavDrawer';
import { User } from '@core/types';
import { ShieldCheck, Plus, Filter, CheckCircle2, AlertTriangle, XCircle, ArrowUpRight, History } from 'lucide-react';
import { PageLoader } from '@/components/ui/spinner';
import { PageTransition } from '@/components/motion/page-transition';
import { Modal } from '@/components/ui/modal';
import { AnimatePresence } from 'framer-motion';
import { roleGateRedirect } from '@/lib/role-routing';

const PAGE_ROLES = ['QA_HEAD', 'QA_MANAGER', 'DATA_EXECUTIVE', 'SUPER_ADMIN'];

interface LabTest {
  id: string;
  testCode: string;
  testName: string;
  resultType: string;
  unit: string | null;
}

interface SopRule {
  id: string;
  labTestId: string;
  testCode: string;
  testName: string;
  resultType: string;
  testingPoint: string;
  version: number;
  ruleCategory: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  minValue: number | null;
  maxValue: number | null;
  acceptableOption: string | null;
  warningTrigger: string | null;
  decisionConsequence: string | null;
  isActive: boolean;
}

const TESTING_POINTS = [
  { value: 'PLANT_QA', label: 'Plant QA Reception' },
  { value: 'ZMCC_LAB_MOT', label: 'ZMCC Lab (MOT Arrivals)' },
  { value: 'ZMCC_LAB_CONTRACTOR', label: 'ZMCC Lab (Contractor)' },
  { value: 'ZMCC_LAB_LOCAL_SUPPLIER', label: 'ZMCC Lab (Local Supplier)' },
  { value: 'DISPATCH', label: 'ZMCC Dispatch to Plant' },
  { value: 'MOT_SHOP', label: 'MOT Shop Collection' },
];

export default function QAHeadDepartmentPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const hamburgerButtonRef = useRef<HTMLButtonElement | null>(null);

  const [rules, setRules] = useState<SopRule[]>([]);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<string>('PLANT_QA');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [formTestId, setFormTestId] = useState('');
  const [formTestingPoint, setFormTestingPoint] = useState('PLANT_QA');
  const [formCategory, setFormCategory] = useState<'RELEASE' | 'MONITORING'>('RELEASE');
  const [formMinValue, setFormMinValue] = useState('');
  const [formMaxValue, setFormMaxValue] = useState('');
  const [formAcceptableOption, setFormAcceptableOption] = useState('');
  const [formWarningTrigger, setFormWarningTrigger] = useState('');
  const [formDecisionConsequence, setFormDecisionConsequence] = useState('');
  const [formReason, setFormReason] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [rulesRes, testsRes] = await Promise.all([
        fetch(`/api/qa-head/sop-rules?testingPoint=${selectedPoint}`),
        fetch('/api/lab-tests'),
      ]);

      if (rulesRes.ok) {
        const rData = await rulesRes.json();
        setRules(rData.rules || []);
      }
      if (testsRes.ok) {
        const tData = await testsRes.json();
        setTests(tData.tests || tData || []);
      }
    } catch (err) {
      console.error('Failed to load rules or tests', err);
    }
  }, [selectedPoint]);

  useEffect(() => {
    async function loadUser() {
      let redirecting = false;
      try {
        const res = await fetch('/api/auth/me');
        const data = res.ok ? await res.json() : null;
        const redirect = roleGateRedirect(data?.user, PAGE_ROLES);
        if (redirect) {
          redirecting = true;
          window.location.replace(redirect);
          return;
        }
        setUser(data.user);
      } catch (err) {
        console.error('Failed to load user', err);
      } finally {
        if (!redirecting) setLoading(false);
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formTestId) {
      setFormError('Please select a Lab Test.');
      return;
    }
    if (formReason.trim().length < 3) {
      setFormError('A substantive governance reason of at least 3 characters is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        labTestId: formTestId,
        testingPoint: formTestingPoint,
        ruleCategory: formCategory,
        minValue: formMinValue ? parseFloat(formMinValue) : null,
        maxValue: formMaxValue ? parseFloat(formMaxValue) : null,
        acceptableOption: formAcceptableOption.trim() || null,
        warningTrigger: formWarningTrigger.trim() || null,
        decisionConsequence: formDecisionConsequence.trim() || null,
        reason: formReason.trim(),
      };

      const res = await fetch('/api/qa-head/sop-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create SOP rule.');
      }

      setIsModalOpen(false);
      setFormTestId('');
      setFormMinValue('');
      setFormMaxValue('');
      setFormAcceptableOption('');
      setFormWarningTrigger('');
      setFormDecisionConsequence('');
      setFormReason('');
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error creating rule.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageLoader label="Loading QA Head Station…" className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col w-full max-w-full overflow-x-hidden">
      <Header
        currentUser={user}
        title="QA Head — SOP Quality Rules"
        showBranding={true}
        showMenuButton={true}
        onMenuClick={() => setIsDrawerOpen(true)}
        menuButtonRef={hamburgerButtonRef}
      />

      <HierarchicalNavDrawer
        currentUser={user}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        triggerButtonRef={hamburgerButtonRef}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <PageTransition>
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-border shadow-2xs">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-900" />
              SOP Quality Rules & Threshold Governance
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Authoritative management of laboratory test acceptance criteria, numeric bounds, and managerial exception consequences.
            </p>
          </div>
          <button
            onClick={() => {
              setFormTestingPoint(selectedPoint);
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-emerald-900 text-white px-4 py-2.5 rounded-lg text-xs font-semibold hover:bg-emerald-950 transition shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            Create SOP Rule Version
          </button>
        </div>

        {/* Testing Point Selector Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {TESTING_POINTS.map((tp) => (
            <button
              key={tp.value}
              onClick={() => setSelectedPoint(tp.value)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                selectedPoint === tp.value
                  ? 'bg-emerald-900 text-white border-emerald-900 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tp.label}
            </button>
          ))}
        </div>

        {/* Rules Table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Active & Historic SOP Rules for {TESTING_POINTS.find((tp) => tp.value === selectedPoint)?.label}
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {rules.length} {rules.length === 1 ? 'rule' : 'rules'} found
            </span>
          </div>

          {rules.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No SOP rules found for this testing point.</p>
              <p className="text-xs text-slate-500">Click &quot;Create SOP Rule Version&quot; above to establish quality threshold criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Test</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Numeric Bounds (Min - Max)</th>
                    <th className="px-4 py-3">Acceptable Option</th>
                    <th className="px-4 py-3">Consequence</th>
                    <th className="px-4 py-3">Effective Date</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-3">
                        <div className="font-semibold text-slate-900">{rule.testName}</div>
                        <div className="text-[10px] text-slate-400 tabular-nums">{rule.testCode} ({rule.resultType})</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-blue-700">v{rule.version}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          rule.ruleCategory === 'RELEASE' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {rule.ruleCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {rule.minValue !== null || rule.maxValue !== null ? (
                          <span>
                            {rule.minValue !== null ? rule.minValue : '—'} &nbsp;to&nbsp;{' '}
                            {rule.maxValue !== null ? rule.maxValue : '—'}
                          </span>
                        ) : (
                          <span className="text-slate-400">N/A (Qualitative)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {rule.acceptableOption ? (
                          <span className="font-semibold text-emerald-700">{rule.acceptableOption}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-600 tabular-nums text-[11px]">{rule.decisionConsequence || 'OUT_OF_SPEC'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 tabular-nums text-[11px]">
                        {new Date(rule.effectiveFrom).toLocaleDateString('en-PK')}
                      </td>
                      <td className="px-4 py-3">
                        {rule.isActive ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-semibold">
                            <History className="w-3 h-3" /> Superseded
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </PageTransition>
      </main>

      {/* Modal for Creating New Rule Version */}
      <AnimatePresence>{isModalOpen && (
        <Modal key="modal-0" onClose={() => setIsModalOpen(false)} title="Create rule version" className="max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-900" />
                Publish New SOP Rule Version
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-semibold"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Testing Point</label>
                <select
                  value={formTestingPoint}
                  onChange={(e) => setFormTestingPoint(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800"
                >
                  {TESTING_POINTS.filter((tp) => tp.value !== 'ZMCC_LAB_CONTRACTOR').map((tp) => (
                    <option key={tp.value} value={tp.value}>
                      {tp.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lab Test</label>
                <select
                  value={formTestId}
                  onChange={(e) => setFormTestId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800"
                >
                  <option value="">-- Select Lab Test --</option>
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.testName} ({t.testCode}) — {t.resultType}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rule Category</label>
                <select
                  value={['MOT_SHOP', 'DISPATCH'].includes(formTestingPoint) ? 'MONITORING' : formCategory}
                  onChange={(e) => setFormCategory(e.target.value as 'RELEASE' | 'MONITORING')}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800"
                >
                  <option value="RELEASE" disabled={['MOT_SHOP', 'DISPATCH'].includes(formTestingPoint)}>
                    RELEASE {['MOT_SHOP', 'DISPATCH'].includes(formTestingPoint) ? '(Pending workflow approval)' : '(Blocking if Out-of-Spec)'}
                  </option>
                  <option value="MONITORING">MONITORING (Advisory / Non-blocking)</option>
                </select>
                {['MOT_SHOP', 'DISPATCH'].includes(formTestingPoint) && (
                  <p className="mt-1 text-[11px] text-amber-700 font-medium">
                    Testing point {formTestingPoint} supports MONITORING rules only until release consequence workflow is approved.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min Value (Numeric)</label>
                  <input
                    type="number"
                    step="any"
                    value={formMinValue}
                    onChange={(e) => setFormMinValue(e.target.value)}
                    placeholder="e.g. 28.0"
                    className="w-full border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Value (Numeric)</label>
                  <input
                    type="number"
                    step="any"
                    value={formMaxValue}
                    onChange={(e) => setFormMaxValue(e.target.value)}
                    placeholder="e.g. 32.0"
                    className="w-full border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Acceptable Option (Qualitative)</label>
                <input
                  type="text"
                  value={formAcceptableOption}
                  onChange={(e) => setFormAcceptableOption(e.target.value)}
                  placeholder="e.g. NEGATIVE or PASS"
                  className="w-full border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Warning Trigger (Optional)</label>
                <input
                  type="text"
                  value={formWarningTrigger}
                  onChange={(e) => setFormWarningTrigger(e.target.value)}
                  placeholder="e.g. BORDERLINE"
                  className="w-full border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Decision Consequence</label>
                <input
                  type="text"
                  value={formDecisionConsequence}
                  onChange={(e) => setFormDecisionConsequence(e.target.value)}
                  placeholder="Default: OUT_OF_SPEC"
                  className="w-full border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Governance Justification / Reason <span className="text-red-600">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Explain why this rule threshold is being established or updated..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-medium"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-900 text-white px-5 py-2 rounded-lg font-semibold hover:bg-emerald-950 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Publish Version'}
                </button>
              </div>
            </form>
          </Modal>
      )}</AnimatePresence>
    </div>
  );
}
