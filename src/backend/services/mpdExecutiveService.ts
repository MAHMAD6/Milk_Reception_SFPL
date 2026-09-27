import { prisma } from '@core/db';
import { getSupplyChainLossHierarchy } from './lossCalculationService';
import { getPakistanCalendarDate } from '@core/business-day';
import { calculateSNF } from '@backend/utils/milkFormulas';
import { listGovernanceOverrides, type GovernanceOverride } from './governanceOverrideService';

/**
 * MPD executive telemetry for the current Pakistan calendar day.
 *
 * Every figure is derived from recorded operational data. Where the system holds no
 * data for a metric the value is `null` (rendered as "—"), never a placeholder number.
 */
export interface MpdExecutiveTelemetry {
  businessDate: string;
  calendarDate: string;
  summary: {
    totalIntakeLiters: number;
    weightedFatPercent: number | null;
    weightedLr: number | null;
    weightedSnfPercent: number | null;
    standardized13TsLiters: number;
    inTransitLiters: number;
    inTransitTankerCount: number;
    supplyChainLossPercent: number;
    supplyChainLossLiters: number;
    activeZmccCount: number;
    activeContractorCount: number;
  };
  motRoutes: Array<{
    id: string;
    routeCode: string;
    routeName: string;
    vehicleNumber: string;
    motName: string;
    completedShops: number;
    totalShops: number;
    grossLiters: number;
    fatPercent: number | null;
    lr: number | null;
    status: string;
    etaOrArrival: string;
  }>;
  inTransitTankers: Array<{
    id: string;
    vehicleNumber: string;
    driverName: string;
    sourceName: string;
    sourceCode: string;
    departureTime: string;
    grossLiters: number;
    at13tsLiters: number;
    temperatureCelsius: number | null;
    fatPercent: number | null;
    lr: number | null;
    status: string;
    etaPlant: string;
  }>;
  zmccCenters: Array<{
    id: string;
    code: string;
    name: string;
    intakeLiters: number;
    siloStockLiters: number;
    siloCapacityPercent: number | null;
    avgFatPercent: number | null;
    avgLr: number | null;
    dispatchedLiters: number;
    dispatchedTankerCount: number;
    isActive: boolean;
  }>;
  plantContractors: Array<{
    id: string;
    code: string;
    name: string;
    deliveredLiters: number;
    avgFatPercent: number | null;
    avgLr: number | null;
    qualityPassRatePercent: number | null;
    pricingAgreement: string | null;
    erpStatus: 'VERIFIED' | 'PENDING_ERP_MAPPING';
  }>;
  qualityFunnel: {
    /** Village-shop rejections are not captured by MOT collection; null until they are. */
    villageShopRejectedLiters: number | null;
    villageShopRejectionPercent: number | null;
    zmccGateRejectedLiters: number;
    zmccGateRejectionPercent: number;
    plantGateRejectedLiters: number;
    plantGateRejectionPercent: number;
    incidents: {
      formalinCount: number;
      ureaCount: number;
      waterLowLrCount: number;
      cobPositiveCount: number;
    };
  };
  governanceOverrides: GovernanceOverride[];
  /** Emergency vehicle substitution is not modelled yet; always empty until it is. */
  emergencySubstitutes: Array<{
    id: string;
    vehicleNumber: string;
    vehicleType: string;
    replacedVehicleNumber: string;
    zmccName: string;
    registeredBy: string;
    timestamp: string;
    status: string;
  }>;
}

const TEST_CODES = {
  temperature: ['LT-000001'],
  cob: ['LT-000004'],
  urea: ['LT-000012'],
  formalin: ['LT-000018'],
  lr: ['LT-000008', 'LT-000027'],
} as const;

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const num = (value: unknown): number | null =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value);

/** Liters-weighted average accumulator; returns null when nothing was weighed. */
class WeightedAverage {
  private sum = 0;
  private weight = 0;
  add(value: number | null, weight: number) {
    if (value === null || !(weight > 0)) return;
    this.sum += value * weight;
    this.weight += weight;
  }
  value(digits = 2): number | null {
    return this.weight > 0 ? round(this.sum / this.weight, digits) : null;
  }
}

function pktDayBounds(calendarDate: string) {
  return {
    start: new Date(`${calendarDate}T00:00:00.000+05:00`),
    end: new Date(`${calendarDate}T23:59:59.999+05:00`),
  };
}

function portionLiters(
  portion: { dispatch_quantity_value: unknown; dispatch_quantity_unit: string | null },
  density: number | null
): number | null {
  const value = num(portion.dispatch_quantity_value);
  if (value === null) return null;
  if (portion.dispatch_quantity_unit === 'LITER') return value;
  if (portion.dispatch_quantity_unit === 'KG' && density && density > 0) return value / density;
  return null;
}

export async function getMpdExecutiveTelemetry(): Promise<MpdExecutiveTelemetry> {
  const calendarDate = getPakistanCalendarDate();
  const { start: todayStart, end: todayEnd } = pktDayBounds(calendarDate);
  const today = { gte: todayStart, lte: todayEnd };

  const [
    activeSources,
    tankLedgerAllTime,
    tankReceiptsToday,
    activeJourneys,
    inTransitVisits,
    zmccSessionsToday,
    zmccFailedResults,
    plantFailedResults,
    governanceOverrides,
  ] = await Promise.all([
    prisma.procurementSource.findMany({
      where: { is_active: true },
      include: {
        zmcc_tanks: { select: { capacity_liters: true, is_active: true } },
        visits: {
          where: { created_at: today, current_status: { notIn: ['CANCELLED', 'DRAFT_DISPATCH'] } },
          select: {
            vehicle_dispatch_gross_liters: true,
            vehicle_dispatch_at_13ts_liters: true,
            vehicle_dispatch_fat: true,
            vehicle_dispatch_lr: true,
            vehicle_dispatch_density: true,
            portions: {
              select: { plant_decision: true, dispatch_quantity_value: true, dispatch_quantity_unit: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.zmccTankInventoryTransaction.groupBy({
      by: ['zmcc_id', 'transaction_type'],
      _sum: { quantity_liters: true },
    }),
    prisma.zmccTankInventoryTransaction.groupBy({
      by: ['zmcc_id'],
      where: { transaction_type: 'RECEIPT', operational_timestamp: today },
      _sum: { quantity_liters: true, at_13ts_liters: true },
    }),
    prisma.motJourney.findMany({
      where: { operational_date: today },
      include: {
        route: { select: { route_code: true, name: true } },
        mot_vehicle: { select: { vehicle_number: true } },
        mot_profile: { select: { name: true } },
        summary: true,
        _count: { select: { stops: true, collections: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.vehicleVisit.findMany({
      where: { current_status: 'DISPATCHED' },
      include: {
        procurement_source: { select: { name: true, code: true } },
        portions: {
          select: {
            dispatch_lab_results: {
              where: { lab_test: { testCode: { in: [...TEST_CODES.temperature] } } },
              select: { numeric_value: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.zmccLabSession.findMany({
      where: { status: 'COMPLETED', completed_at: today },
      select: { decision: true, final_decision: true, gross_liters: true },
    }),
    prisma.zmccLabResult.findMany({
      where: {
        is_passed: false,
        session: { completed_at: today },
        test_code_snapshot: { in: [...TEST_CODES.cob, ...TEST_CODES.urea, ...TEST_CODES.formalin, ...TEST_CODES.lr] },
      },
      select: { test_code_snapshot: true },
    }),
    prisma.plantLabResult.findMany({
      where: {
        is_passed: false,
        created_at: today,
        lab_test: { testCode: { in: [...TEST_CODES.cob, ...TEST_CODES.urea, ...TEST_CODES.formalin, ...TEST_CODES.lr] } },
      },
      select: { lab_test: { select: { testCode: true } } },
    }),
    listGovernanceOverrides().catch((err) => {
      console.error('[MPD_TELEMETRY_GOVERNANCE_ERROR]', err);
      return [] as GovernanceOverride[];
    }),
  ]);

  let lossSummary: { lossLiters: number; lossPercent: number } = { lossLiters: 0, lossPercent: 0 };
  try {
    const lossData = await getSupplyChainLossHierarchy({ period: 'today' });
    lossSummary = lossData.summary.tier4TotalLoss;
  } catch (err) {
    console.error('[MPD_TELEMETRY_LOSS_ERROR]', err);
  }

  // Tank ledger: stock is the signed all-time balance; intake is today's receipts.
  const stockByZmcc = new Map<string, number>();
  for (const row of tankLedgerAllTime) {
    const qty = num(row._sum.quantity_liters) ?? 0;
    const signed = row.transaction_type === 'RECEIPT' || row.transaction_type === 'ADJUSTMENT_IN' ? qty : -qty;
    const key = row.zmcc_id.toString();
    stockByZmcc.set(key, (stockByZmcc.get(key) ?? 0) + signed);
  }
  const receiptsByZmcc = new Map(
    tankReceiptsToday.map((row) => [
      row.zmcc_id.toString(),
      { liters: num(row._sum.quantity_liters) ?? 0, at13ts: num(row._sum.at_13ts_liters) ?? 0 },
    ])
  );

  const divisionFat = new WeightedAverage();
  const divisionLr = new WeightedAverage();
  let plantRejectedLiters = 0;
  let plantAssessedLiters = 0;

  const zmccCenters = activeSources
    .filter((s) => s.source_type === 'ZMCC')
    .map((zmcc) => {
      const fat = new WeightedAverage();
      const lr = new WeightedAverage();
      let dispatched = 0;

      for (const v of zmcc.visits) {
        const liters = num(v.vehicle_dispatch_gross_liters) ?? 0;
        dispatched += liters;
        fat.add(num(v.vehicle_dispatch_fat), liters);
        lr.add(num(v.vehicle_dispatch_lr), liters);
        divisionFat.add(num(v.vehicle_dispatch_fat), liters);
        divisionLr.add(num(v.vehicle_dispatch_lr), liters);
      }

      const capacity = zmcc.zmcc_tanks
        .filter((t) => t.is_active)
        .reduce((sum, t) => sum + (num(t.capacity_liters) ?? 0), 0);
      const stock = round(stockByZmcc.get(zmcc.id.toString()) ?? 0);

      return {
        id: zmcc.id.toString(),
        code: zmcc.code,
        name: zmcc.name,
        intakeLiters: round(receiptsByZmcc.get(zmcc.id.toString())?.liters ?? 0),
        siloStockLiters: stock,
        siloCapacityPercent: capacity > 0 ? Math.round((stock / capacity) * 100) : null,
        avgFatPercent: fat.value(),
        avgLr: lr.value(),
        dispatchedLiters: round(dispatched),
        dispatchedTankerCount: zmcc.visits.length,
        isActive: zmcc.is_active,
      };
    });

  let contractorAt13ts = 0;
  const plantContractors = activeSources
    .filter((s) => s.source_type === 'CONTRACTOR')
    .map((c) => {
      const fat = new WeightedAverage();
      const lr = new WeightedAverage();
      let delivered = 0;
      let decidedPortions = 0;
      let acceptedPortions = 0;

      for (const v of c.visits) {
        const liters = num(v.vehicle_dispatch_gross_liters) ?? 0;
        delivered += liters;
        contractorAt13ts += num(v.vehicle_dispatch_at_13ts_liters) ?? 0;
        fat.add(num(v.vehicle_dispatch_fat), liters);
        lr.add(num(v.vehicle_dispatch_lr), liters);
        divisionFat.add(num(v.vehicle_dispatch_fat), liters);
        divisionLr.add(num(v.vehicle_dispatch_lr), liters);
        for (const p of v.portions) {
          if (p.plant_decision === 'ACCEPTED' || p.plant_decision === 'REJECTED') decidedPortions++;
          if (p.plant_decision === 'ACCEPTED') acceptedPortions++;
        }
      }

      return {
        id: c.id.toString(),
        code: c.code,
        name: c.name,
        deliveredLiters: round(delivered),
        avgFatPercent: fat.value(),
        avgLr: lr.value(),
        qualityPassRatePercent: decidedPortions > 0 ? Math.round((acceptedPortions / decidedPortions) * 100) : null,
        pricingAgreement: null,
        erpStatus: (c.code ? 'VERIFIED' : 'PENDING_ERP_MAPPING') as 'VERIFIED' | 'PENDING_ERP_MAPPING',
      };
    });

  // Plant gate rejection share across every source's visits dispatched today.
  for (const source of activeSources) {
    for (const v of source.visits) {
      const density = num(v.vehicle_dispatch_density);
      for (const p of v.portions) {
        if (p.plant_decision !== 'ACCEPTED' && p.plant_decision !== 'REJECTED') continue;
        const liters = portionLiters(p, density);
        if (liters === null) continue;
        plantAssessedLiters += liters;
        if (p.plant_decision === 'REJECTED') plantRejectedLiters += liters;
      }
    }
  }

  const motRoutes = activeJourneys.map((j) => ({
    id: j.id.toString(),
    routeCode: j.route?.route_code || '—',
    routeName: j.route?.name || '—',
    vehicleNumber: j.mot_vehicle?.vehicle_number || '—',
    motName: j.mot_profile?.name || '—',
    completedShops: j._count.collections,
    totalShops: Math.max(j._count.stops, j._count.collections),
    grossLiters: num(j.summary?.total_gross_liters) ?? 0,
    fatPercent: num(j.summary?.weighted_avg_fat),
    lr: num(j.summary?.weighted_avg_lr),
    status: j.status,
    etaOrArrival: j.status === 'COMPLETED' ? 'Arrived ZMCC' : 'Collecting',
  }));

  const inTransitTankers = inTransitVisits.map((v) => {
    const temperatures = v.portions
      .flatMap((p) => p.dispatch_lab_results.map((r) => num(r.numeric_value)))
      .filter((t): t is number => t !== null);
    return {
      id: v.id.toString(),
      vehicleNumber: v.vehicle_number,
      driverName: '—',
      sourceName: v.procurement_source?.name || '—',
      sourceCode: v.procurement_source?.code || '',
      departureTime: v.created_at.toISOString(),
      grossLiters: num(v.vehicle_dispatch_gross_liters) ?? 0,
      at13tsLiters: num(v.vehicle_dispatch_at_13ts_liters) ?? 0,
      temperatureCelsius: temperatures.length ? round(temperatures.reduce((a, b) => a + b, 0) / temperatures.length, 1) : null,
      fatPercent: num(v.vehicle_dispatch_fat),
      lr: num(v.vehicle_dispatch_lr),
      status: v.current_status,
      etaPlant: 'In Transit',
    };
  });

  let zmccRejectedLiters = 0;
  let zmccTestedLiters = 0;
  for (const s of zmccSessionsToday) {
    const liters = num(s.gross_liters) ?? 0;
    zmccTestedLiters += liters;
    if ((s.final_decision || s.decision) === 'REJECTED') zmccRejectedLiters += liters;
  }

  const failedCodes = [
    ...zmccFailedResults.map((r) => r.test_code_snapshot.toUpperCase()),
    ...plantFailedResults.map((r) => r.lab_test.testCode.toUpperCase()),
  ];
  const countCodes = (codes: readonly string[]) => failedCodes.filter((c) => codes.includes(c)).length;

  const zmccIntakeLiters = zmccCenters.reduce((sum, z) => sum + z.intakeLiters, 0);
  const contractorLiters = plantContractors.reduce((sum, c) => sum + c.deliveredLiters, 0);
  const zmccIntakeAt13ts = Array.from(receiptsByZmcc.values()).reduce((sum, r) => sum + r.at13ts, 0);
  const weightedFat = divisionFat.value();
  const weightedLr = divisionLr.value();
  const pct = (part: number, whole: number) => (whole > 0 ? round((part / whole) * 100) : 0);

  return {
    businessDate: calendarDate,
    calendarDate,
    summary: {
      totalIntakeLiters: round(zmccIntakeLiters + contractorLiters),
      weightedFatPercent: weightedFat,
      weightedLr,
      weightedSnfPercent: weightedFat !== null && weightedLr !== null ? round(calculateSNF(weightedLr, weightedFat)) : null,
      standardized13TsLiters: round(zmccIntakeAt13ts + contractorAt13ts),
      inTransitLiters: round(inTransitTankers.reduce((sum, t) => sum + t.grossLiters, 0)),
      inTransitTankerCount: inTransitTankers.length,
      supplyChainLossPercent: round(lossSummary.lossPercent || 0),
      supplyChainLossLiters: round(lossSummary.lossLiters || 0),
      activeZmccCount: zmccCenters.length,
      activeContractorCount: plantContractors.length,
    },
    motRoutes,
    inTransitTankers,
    zmccCenters,
    plantContractors,
    qualityFunnel: {
      villageShopRejectedLiters: null,
      villageShopRejectionPercent: null,
      zmccGateRejectedLiters: round(zmccRejectedLiters),
      zmccGateRejectionPercent: pct(zmccRejectedLiters, zmccTestedLiters),
      plantGateRejectedLiters: round(plantRejectedLiters),
      plantGateRejectionPercent: pct(plantRejectedLiters, plantAssessedLiters),
      incidents: {
        formalinCount: countCodes(TEST_CODES.formalin),
        ureaCount: countCodes(TEST_CODES.urea),
        waterLowLrCount: countCodes(TEST_CODES.lr),
        cobPositiveCount: countCodes(TEST_CODES.cob),
      },
    },
    governanceOverrides,
    emergencySubstitutes: [],
  };
}
