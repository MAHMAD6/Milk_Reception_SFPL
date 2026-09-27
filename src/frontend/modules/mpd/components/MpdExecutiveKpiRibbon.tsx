'use client';

import React from 'react';
import { fmtNum } from '../format';
import { Droplet, Truck, ShieldAlert, Layers, Building2 } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { MpdSummary } from '../types';

interface MpdExecutiveKpiRibbonProps {
  summary: MpdSummary;
  isLoading?: boolean;
}

const loadingValue = <Skeleton className="h-7 w-24" />;

export const MpdExecutiveKpiRibbon: React.FC<MpdExecutiveKpiRibbonProps> = ({ summary, isLoading }) => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        label="Gross intake"
        icon={Droplet}
        tone="info"
        value={isLoading ? loadingValue : `${summary.totalIntakeLiters.toLocaleString()} L`}
        hint={
          <span className="tabular-nums">
            Fat {fmtNum(summary.weightedFatPercent, '%')} · LR {fmtNum(summary.weightedLr)}
          </span>
        }
      />
      <StatCard
        label="13% TS equivalent"
        icon={Layers}
        tone="success"
        value={isLoading ? loadingValue : `${summary.standardized13TsLiters.toLocaleString()} L`}
        hint="Total-solids standardized volume"
      />
      <StatCard
        label="In transit"
        icon={Truck}
        tone="warning"
        value={isLoading ? loadingValue : `${summary.inTransitLiters.toLocaleString()} L`}
        hint={
          <span>
            <span className="tabular-nums">{summary.inTransitTankerCount}</span> tankers en route to plant
          </span>
        }
      />
      <StatCard
        label="Supply chain loss"
        icon={ShieldAlert}
        tone="warning"
        value={isLoading ? loadingValue : `${summary.supplyChainLossPercent}%`}
        hint={
          <span>
            Net <span className="tabular-nums">{summary.supplyChainLossLiters.toLocaleString()} L</span> across 4 tiers
          </span>
        }
      />
      <StatCard
        label="Active supply nodes"
        icon={Building2}
        value={isLoading ? loadingValue : summary.activeZmccCount + summary.activeContractorCount}
        hint={
          <span>
            <span className="tabular-nums">{summary.activeZmccCount}</span> ZMCCs ·{' '}
            <span className="tabular-nums">{summary.activeContractorCount}</span> plant contractors
          </span>
        }
      />
    </div>
  );
};
