'use client';

import React, { useState, useMemo } from 'react';
import { MilkProcessLog } from '@backend/core/types';
import { buildVehicleVisitGroups } from './zmccManagerHelpers';
import { ManagerLifecycleTracker } from './ManagerLifecycleTracker';
import {
  Truck,
  Search,
  Eye,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface ZMCCManagerLiveDispatchesProps {
  logs: MilkProcessLog[];
  assignedSourceName: string;
  onInspectDetails: (log: MilkProcessLog) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

type LiveLifecycleFilter =
  | 'ALL_ACTIVE'
  | 'GATE_ENTERED'
  | 'PLANT_QA'
  | 'WEIGHBRIDGE'
  | 'UNLOADING'
  | 'AWAITING_RECEIPT';

export const ZMCCManagerLiveDispatches: React.FC<ZMCCManagerLiveDispatchesProps> = ({
  logs,
  assignedSourceName,
  onInspectDetails,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lifecycleFilter, setLifecycleFilter] = useState<LiveLifecycleFilter>('ALL_ACTIVE');

  // Build vehicle visit groups (independent of historical Business Date filter)
  const allGroups = useMemo(() => {
    return buildVehicleVisitGroups(logs);
  }, [logs]);

  // Active in-plant groups (prioritize active workflow state irrespective of midnight/08:00 date boundary)
  const activeGroups = useMemo(() => {
    return allGroups.filter((g) => {
      const isInPlant = g.lifecycle.isInPlant;
      const isDispatched = g.overallStatus === 'DISPATCHED';
      const isNotComplete = !g.lifecycle.isComplete;
      return (isInPlant || isDispatched) && isNotComplete;
    });
  }, [allGroups]);

  // Filtered active groups
  const filteredActiveGroups = useMemo(() => {
    return activeGroups.filter((g) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchVehicle = g.vehicleNumber.toLowerCase().includes(q);
        const matchToken = g.tokenNumber ? g.tokenNumber.toLowerCase().includes(q) : false;
        if (!matchVehicle && !matchToken) return false;
      }

      // 2. Lifecycle Filter
      if (lifecycleFilter === 'ALL_ACTIVE') return true;
      if (lifecycleFilter === 'GATE_ENTERED') return g.lifecycle.currentStageId === 'GATE_ENTRY';
      if (lifecycleFilter === 'PLANT_QA') return g.lifecycle.currentStageId === 'PLANT_QA';
      if (lifecycleFilter === 'WEIGHBRIDGE')
        return (
          g.lifecycle.currentStageId === 'FIRST_WEIGHT' ||
          g.lifecycle.currentStageId === 'SECOND_WEIGHT'
        );
      if (lifecycleFilter === 'UNLOADING') return g.lifecycle.currentStageId === 'UNLOADING';
      if (lifecycleFilter === 'AWAITING_RECEIPT')
        return g.lifecycle.currentStageId === 'FINAL_RECEIPT';

      return true;
    });
  }, [activeGroups, searchQuery, lifecycleFilter]);

  // Error State: Do not show "No Active Dispatches" on error
  if (error) {
    return (
      <div className="p-8 rounded-xl bg-red-50 border border-red-200 text-center space-y-3" role="alert">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto border border-red-200">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h4 className="text-base font-semibold text-red-800">Unable to Load Live Dispatches</h4>
        <p className="text-xs text-red-700 max-w-md mx-auto">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-red-800 text-white text-xs font-semibold hover:bg-red-800 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Loading</span>
          </button>
        )}
      </div>
    );
  }

  // Loading State
  if (isLoading && logs.length === 0) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading live dispatches">
        <div className="p-5 rounded-xl bg-card border border-border/80 shadow-xs animate-pulse space-y-3">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-10 bg-slate-100 rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="region" aria-label="ZMCC Manager Live Dispatches">
      {/* 1. Header and Tracking Info Banner */}
      <div className="p-5 rounded-xl bg-card border border-border/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/80">
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Live Vehicle Reception Pipeline ({assignedSourceName})
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                Real-time tracking of active milk tankers inside factory receiving operations.
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full text-xs tabular-nums font-semibold bg-blue-50 text-primary-hover border border-blue-200 self-start sm:self-auto">
            {activeGroups.length} Active Tankers in Plant
          </span>
        </div>

        {/* 2. Search & Stage Filters Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vehicle number, token #..."
              aria-label="Search live vehicles"
              className="w-full pl-10 pr-4 py-2 text-xs font-semibold rounded-lg bg-subtle border border-border/80 text-foreground focus:ring-2 focus:ring-primary outline-hidden shadow-2xs"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Stage filters">
            <button
              onClick={() => setLifecycleFilter('ALL_ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                lifecycleFilter === 'ALL_ACTIVE'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-subtle text-slate-600 border border-border/80 hover:bg-muted/60'
              }`}
            >
              All Active ({activeGroups.length})
            </button>
            <button
              onClick={() => setLifecycleFilter('GATE_ENTERED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                lifecycleFilter === 'GATE_ENTERED'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-subtle text-slate-600 border border-border/80 hover:bg-muted/60'
              }`}
            >
              Gate In
            </button>
            <button
              onClick={() => setLifecycleFilter('PLANT_QA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                lifecycleFilter === 'PLANT_QA'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-subtle text-slate-600 border border-border/80 hover:bg-muted/60'
              }`}
            >
              Plant QA
            </button>
            <button
              onClick={() => setLifecycleFilter('WEIGHBRIDGE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                lifecycleFilter === 'WEIGHBRIDGE'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-subtle text-slate-600 border border-border/80 hover:bg-muted/60'
              }`}
            >
              Weighbridge Scale
            </button>
            <button
              onClick={() => setLifecycleFilter('UNLOADING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                lifecycleFilter === 'UNLOADING'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-subtle text-slate-600 border border-border/80 hover:bg-muted/60'
              }`}
            >
              Silo Unloading
            </button>
            <button
              onClick={() => setLifecycleFilter('AWAITING_RECEIPT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                lifecycleFilter === 'AWAITING_RECEIPT'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-subtle text-slate-600 border border-border/80 hover:bg-muted/60'
              }`}
            >
              Awaiting Receipt
            </button>
          </div>
        </div>
      </div>

      {/* 3. Active Vehicle List / Cards */}
      {filteredActiveGroups.length === 0 ? (
        <div className="p-8 rounded-xl bg-card border border-border/80 shadow-xs text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto border border-slate-200">
            <Truck className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">No Active Dispatches in Pipeline</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery
              ? `No active dispatches match search query "${searchQuery}".`
              : 'There are currently no tankers from this ZMCC source in factory reception.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredActiveGroups.map((group) => {
            const lc = group.lifecycle;
            const primary = group.primaryLog;

            return (
              <div
                key={group.visitId}
                className="p-5 rounded-xl bg-card border border-border/80 shadow-xs space-y-4 hover:border-primary/40 transition"
              >
                {/* Top Row: Vehicle Info, Token, Stage Badge, Elapsed Timer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
                  <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                    <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-primary">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="tabular-nums font-semibold text-base text-foreground">
                          {group.vehicleNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-subtle border border-border tabular-nums text-[11px] font-semibold text-slate-700">
                          Visit #{group.visitId}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-green-50 border border-green-200 tabular-nums text-[11px] font-semibold text-green-800">
                          {group.portions.length} Portion{group.portions.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 font-semibold mt-0.5">
                        <span>Token: <strong>{group.tokenNumber || 'PENDING'}</strong></span>
                        <span>•</span>
                        <span>Source: <strong>{group.sourceName}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-auto">
                    {lc.elapsedInPlant && (
                      <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs tabular-nums font-semibold text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                        <span>In Plant: {lc.elapsedInPlant}</span>
                      </div>
                    )}

                    <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary text-white">
                      {lc.currentStageLabel}
                    </span>
                  </div>
                </div>

                {/* Middle Row: 7-Stage Visual Lifecycle Tracker */}
                <div className="py-2">
                  <ManagerLifecycleTracker lifecycle={lc} />
                </div>

                {/* Bottom Row: Quantities, Weights & Details Button with Full Locked Labels */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-border/80 text-xs tabular-nums">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 font-sans block">Declared Dispatch:</span>
                      <span className="font-semibold text-foreground">
                        {group.vehicleDispatchQuantityValue != null
                          ? `${group.vehicleDispatchQuantityValue.toLocaleString()} ${group.vehicleDispatchQuantityUnit || ''}`
                          : group.totalDispatchGrossLiters != null
                          ? `${group.totalDispatchGrossLiters.toLocaleString()} L`
                          : '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 font-sans block">First Weight (Loaded Vehicle):</span>
                      <span className="font-semibold text-foreground">
                        {group.firstWeightKg != null ? `${group.firstWeightKg.toLocaleString()} KG` : '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 font-sans block">Second Weight (After Unloading):</span>
                      <span className="font-semibold text-foreground">
                        {group.secondWeightKg != null ? `${group.secondWeightKg.toLocaleString()} KG` : '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 font-sans block">Latest Milestone:</span>
                      <span className="font-semibold text-primary block truncate" title={lc.latestEventLabel}>
                        {lc.latestEventLabel}
                      </span>
                      {lc.latestEventTimestamp && (
                        <span className="text-[10px] text-slate-500 font-normal block leading-tight mt-0.5">
                          {lc.latestEventTimestamp}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onInspectDetails(primary)}
                    className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-sans text-xs font-semibold transition flex items-center justify-center space-x-1.5 shadow-xs self-stretch md:self-auto"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Full Visit Details</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
