'use client';

import React from 'react';
import { Play, CheckCircle2, PauseCircle, XCircle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Modal } from '@/components/ui/modal';
import type { OnHoldVisit, WaitingVisit } from './QAQueuePanel';
import type { VisitDetail } from './QATestingSection';

export interface QADecisionModalsProps {
  activeActionModal: 'START' | 'RESUME' | 'ACCEPT' | 'HOLD' | 'REJECT' | null;
  onCloseModal: () => void;
  actionVisitId: string | null;
  visitDetail: VisitDetail | null;
  activePortionIndex: number;
  qaOpTimestamp: string;
  onQaOpTimestampChange: (val: string) => void;
  holdReason: string;
  onHoldReasonChange: (val: string) => void;
  rejectionReason: string;
  onRejectionReasonChange: (val: string) => void;
  rejectionRemarks: string;
  onRejectionRemarksChange: (val: string) => void;
  onStartTestingConfirm: (e: React.FormEvent) => void;
  onResumeTestingConfirm: (e: React.FormEvent) => void;
  onAcceptPortionConfirm: (e: React.FormEvent) => void;
  onHoldPortionConfirm: (e: React.FormEvent) => void;
  onRejectPortionConfirm: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  waitingVisits: WaitingVisit[];
  onHoldVisits: OnHoldVisit[];
}

export const QADecisionModals: React.FC<QADecisionModalsProps> = ({
  activeActionModal,
  onCloseModal,
  actionVisitId,
  visitDetail,
  activePortionIndex,
  qaOpTimestamp,
  onQaOpTimestampChange,
  holdReason,
  onHoldReasonChange,
  rejectionReason,
  onRejectionReasonChange,
  rejectionRemarks,
  onRejectionRemarksChange,
  onStartTestingConfirm,
  onResumeTestingConfirm,
  onAcceptPortionConfirm,
  onHoldPortionConfirm,
  onRejectPortionConfirm,
  isSubmitting,
  waitingVisits,
  onHoldVisits,
}) => {
  const currentPortion = visitDetail?.portions?.[activePortionIndex] || null;
  const targetWaitingVisit = waitingVisits.find((v) => v.id === actionVisitId) || null;
  const targetHeldVisit = onHoldVisits.find((v) => v.id === actionVisitId) || null;

  return (
    <AnimatePresence>
      {activeActionModal && (
        <Modal key="qa-decision" onClose={onCloseModal} title="QA decision" preventClose={isSubmitting} className="p-5 sm:p-6 max-w-md max-h-[90dvh] overflow-y-auto space-y-5 text-foreground">
            {/* START TESTING MODAL */}
            {activeActionModal === 'START' && (
              <form onSubmit={onStartTestingConfirm} className="space-y-4">
                <div className="flex items-center space-x-2.5 pb-2 border-b border-border-strong">
                  <div className="p-2 bg-primary text-white rounded-xl">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Start QA Testing Session</h3>
                    <p className="text-xs text-slate-700 font-semibold">
                      Vehicle: <strong className="tabular-nums">{targetWaitingVisit?.vehicle_number || 'Selected'}</strong>
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Testing Start Operational Timestamp *
                  </label>
                  <input
                    type="datetime-local"
                    value={qaOpTimestamp}
                    onChange={(e) => onQaOpTimestampChange(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-xs tabular-nums font-semibold rounded-xl border border-border-strong bg-white text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    required
                  />
                  <p className="text-[10px] text-slate-700 font-medium">
                    Records the authoritative start time of this QA session.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border-strong">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onCloseModal}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-h-[44px] px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-xl shadow-md transition"
                  >
                    {isSubmitting ? 'Starting...' : 'Confirm & Start Testing'}
                  </button>
                </div>
              </form>
            )}

            {/* RESUME TESTING MODAL */}
            {activeActionModal === 'RESUME' && (
              <form onSubmit={onResumeTestingConfirm} className="space-y-4">
                <div className="flex items-center space-x-2.5 pb-2 border-b border-border-strong">
                  <div className="p-2 bg-amber-700 text-white rounded-xl">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Resume QA Testing Session</h3>
                    <p className="text-xs text-slate-700 font-semibold">
                      Vehicle: <strong className="tabular-nums">{targetHeldVisit?.vehicle_number || 'Selected'}</strong>
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Resume Operational Timestamp *
                  </label>
                  <input
                    type="datetime-local"
                    value={qaOpTimestamp}
                    onChange={(e) => onQaOpTimestampChange(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-xs tabular-nums font-semibold rounded-xl border border-border-strong bg-white text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border-strong">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onCloseModal}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-h-[44px] px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs rounded-xl shadow-md transition"
                  >
                    {isSubmitting ? 'Resuming...' : 'Confirm & Resume Session'}
                  </button>
                </div>
              </form>
            )}

            {/* ACCEPT PORTION MODAL */}
            {activeActionModal === 'ACCEPT' && (
              <form onSubmit={onAcceptPortionConfirm} className="space-y-4">
                <div className="flex items-center space-x-2.5 pb-2 border-b border-border-strong">
                  <div className="p-2 bg-emerald-700 text-white rounded-xl">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Accept Portion for Reception</h3>
                    <p className="text-xs text-slate-700 font-semibold">
                      Portion #{currentPortion?.portion_number} of {visitDetail?.vehicle_number}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold space-y-1">
                  <p>
                    Confirming that Portion #{currentPortion?.portion_number} meets plant quality standards and is approved for weighbridge and unloading.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Acceptance Operational Timestamp *
                  </label>
                  <input
                    type="datetime-local"
                    value={qaOpTimestamp}
                    onChange={(e) => onQaOpTimestampChange(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-xs tabular-nums font-semibold rounded-xl border border-border-strong bg-white text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border-strong">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onCloseModal}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-h-[44px] px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-md transition"
                  >
                    {isSubmitting ? 'Accepting...' : 'Confirm Portion Acceptance'}
                  </button>
                </div>
              </form>
            )}

            {/* HOLD PORTION MODAL */}
            {activeActionModal === 'HOLD' && (
              <form onSubmit={onHoldPortionConfirm} className="space-y-4">
                <div className="flex items-center space-x-2.5 pb-2 border-b border-border-strong">
                  <div className="p-2 bg-amber-600 text-white rounded-xl">
                    <PauseCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Place Portion On Hold</h3>
                    <p className="text-xs text-slate-700 font-semibold">
                      Portion #{currentPortion?.portion_number} of {visitDetail?.vehicle_number}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Hold Reason / Explanation *
                  </label>
                  <textarea
                    value={holdReason}
                    onChange={(e) => onHoldReasonChange(e.target.value)}
                    placeholder="Describe why this portion is being put on hold (e.g. pending supervisor review, re-sampling needed)..."
                    rows={3}
                    className="w-full p-3 text-xs font-semibold rounded-xl border border-border-strong bg-white text-foreground focus:outline-hidden focus:ring-2 focus:ring-amber-600"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Hold Operational Timestamp *
                  </label>
                  <input
                    type="datetime-local"
                    value={qaOpTimestamp}
                    onChange={(e) => onQaOpTimestampChange(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-xs tabular-nums font-semibold rounded-xl border border-border-strong bg-white text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border-strong">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onCloseModal}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !holdReason.trim()}
                    className="min-h-[44px] px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Placing On Hold...' : 'Confirm Hold Decision'}
                  </button>
                </div>
              </form>
            )}

            {/* REJECT PORTION MODAL */}
            {activeActionModal === 'REJECT' && (
              <form onSubmit={onRejectPortionConfirm} className="space-y-4">
                <div className="flex items-center space-x-2.5 pb-2 border-b border-border-strong">
                  <div className="p-2 bg-rose-700 text-white rounded-xl">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Reject Portion</h3>
                    <p className="text-xs text-slate-700 font-semibold">
                      Portion #{currentPortion?.portion_number} of {visitDetail?.vehicle_number}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Rejection Reason *
                  </label>
                  <select
                    value={rejectionReason}
                    onChange={(e) => onRejectionReasonChange(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-xl border border-border-strong bg-white text-foreground focus:outline-hidden focus:ring-2 focus:ring-rose-700"
                    required
                  >
                    <option value="">-- Select Rejection Reason --</option>
                    <option value="SOP Violation / Quality Out of Range">SOP Violation / Quality Out of Range</option>
                    <option value="Adulteration Suspected / Positive">Adulteration Suspected / Positive</option>
                    <option value="Temperature / Acidity Out of Bounds">Temperature / Acidity Out of Bounds</option>
                    <option value="Organoleptic / Visual Defect">Organoleptic / Visual Defect</option>
                    <option value="Antibiotics / Toxin Positive">Antibiotics / Toxin Positive</option>
                    <option value="Contractor / Transporter Breach">Contractor / Transporter Breach</option>
                    <option value="Other / Lab Supervisor Override">Other / Lab Supervisor Override</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Rejection Remarks *
                  </label>
                  <textarea
                    value={rejectionRemarks}
                    onChange={(e) => onRejectionRemarksChange(e.target.value)}
                    placeholder="Detailed chemist lab observations, sample retest notes..."
                    rows={2}
                    className="w-full p-3 text-xs font-semibold rounded-xl border border-border-strong bg-white text-foreground focus:outline-hidden focus:ring-2 focus:ring-rose-700"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Rejection Operational Timestamp *
                  </label>
                  <input
                    type="datetime-local"
                    value={qaOpTimestamp}
                    onChange={(e) => onQaOpTimestampChange(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-xs tabular-nums font-semibold rounded-xl border border-border-strong bg-white text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border-strong">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onCloseModal}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !rejectionReason.trim() || !rejectionRemarks.trim()}
                    className="min-h-[44px] px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Rejecting...' : 'Confirm Portion Rejection'}
                  </button>
                </div>
              </form>
            )}
        </Modal>
      )}
    </AnimatePresence>
  );
};
