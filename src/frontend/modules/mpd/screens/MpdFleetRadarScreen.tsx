'use client';

import React, { useState } from 'react';
import { Truck, Navigation, Thermometer, ShieldAlert, CheckCircle2, Clock, Search } from 'lucide-react';
import type { InTransitTankerTelemetry, MotRouteTelemetry, EmergencySubstituteTelemetry } from '../types';

interface MpdFleetRadarScreenProps {
  tankers: InTransitTankerTelemetry[];
  routes: MotRouteTelemetry[];
  substitutes: EmergencySubstituteTelemetry[];
}

export const MpdFleetRadarScreen: React.FC<MpdFleetRadarScreenProps> = ({ tankers, routes, substitutes }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'TANKERS' | 'MOT_ROUTES' | 'SUBSTITUTES'>('ALL');

  const filteredTankers = tankers.filter(
    (t) =>
      t.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.sourceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.driverName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRoutes = routes.filter(
    (r) =>
      r.routeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.routeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.motName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search and Filters Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-border">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search vehicle number, driver, MOT, or ZMCC source..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border focus:outline-hidden focus:border-primary bg-subtle"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'TANKERS', 'MOT_ROUTES', 'SUBSTITUTES'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFilter === filter
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter === 'ALL' && `All Fleet (${tankers.length + routes.length})`}
              {filter === 'TANKERS' && `Plant Tankers (${tankers.length})`}
              {filter === 'MOT_ROUTES' && `MOT Vans (${routes.length})`}
              {filter === 'SUBSTITUTES' && `Substitutes (${substitutes.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Heavy In-Transit Tankers (ZMCC to Plant) */}
      {(activeFilter === 'ALL' || activeFilter === 'TANKERS') && (
        <div className="bg-white border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-semibold text-foreground">
                Inter-Facility In-Transit Tankers (ZMCC → Plant)
              </h2>
            </div>
            <span className="text-xs tabular-nums font-medium text-slate-500">
              {filteredTankers.length} active shipments
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-subtle border-b border-border text-slate-600 font-semibold">
                  <th className="py-3 px-4">Vehicle / Driver</th>
                  <th className="py-3 px-4">Origin ZMCC</th>
                  <th className="py-3 px-4 text-right">Volume</th>
                  <th className="py-3 px-4 text-center">Quality (Fat / LR)</th>
                  <th className="py-3 px-4 text-center">Temp</th>
                  <th className="py-3 px-4">Departure / ETA Plant</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTankers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      No in-transit tankers matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTankers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="tabular-nums font-semibold text-foreground">{t.vehicleNumber}</div>
                        <div className="text-slate-500 text-xs">{t.driverName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{t.sourceName}</div>
                        <div className="text-slate-500 tabular-nums text-xs">{t.sourceCode}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="tabular-nums font-semibold text-foreground">{t.grossLiters.toLocaleString()} L</div>
                        <div className="text-slate-500 tabular-nums text-xs">{t.at13tsLiters.toLocaleString()} L @13%TS</div>
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums">
                        <span className="font-semibold text-slate-800">{t.fatPercent}%</span>
                        <span className="text-slate-400 mx-1">|</span>
                        <span className="font-semibold text-slate-800">{t.lr}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 tabular-nums font-semibold px-2 py-0.5 rounded ${
                            t.temperatureCelsius <= 4.0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : t.temperatureCelsius <= 6.0
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <Thermometer className="w-3 h-3" />
                          {t.temperatureCelsius}°C
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Dep: {t.departureTime}</span>
                        </div>
                        <div className="text-xs font-semibold text-primary">ETA: {t.etaPlant}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-primary border border-blue-200">
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. MOT Route Vans (Village Pickups to ZMCC) */}
      {(activeFilter === 'ALL' || activeFilter === 'MOT_ROUTES') && (
        <div className="bg-white border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-semibold text-foreground">
                Active MOT Field Routes (Village Shops → ZMCC)
              </h2>
            </div>
            <span className="text-xs tabular-nums font-medium text-slate-500">
              {filteredRoutes.length} active routes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-subtle border-b border-border text-slate-600 font-semibold">
                  <th className="py-3 px-4">Route / MOT</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4 text-center">Shop Progress</th>
                  <th className="py-3 px-4 text-right">Collected Volume</th>
                  <th className="py-3 px-4 text-center">Quality (Fat / LR)</th>
                  <th className="py-3 px-4">ZMCC Arrival</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRoutes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      No active MOT field routes.
                    </td>
                  </tr>
                ) : (
                  filteredRoutes.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{r.routeName}</div>
                        <div className="text-slate-500 text-xs">
                          <span className="tabular-nums">{r.routeCode}</span> • MOT: <strong className="text-slate-700">{r.motName}</strong>
                        </div>
                      </td>
                      <td className="py-3 px-4 tabular-nums font-semibold text-slate-800">
                        {r.vehicleNumber}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="tabular-nums font-semibold text-slate-800">
                            {r.completedShops}/{r.totalShops}
                          </span>
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${r.totalShops > 0 ? (r.completedShops / r.totalShops) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-foreground">
                        {r.grossLiters.toLocaleString()} L
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums">
                        <span className="font-semibold text-slate-800">{r.fatPercent}%</span>
                        <span className="text-slate-400 mx-1">|</span>
                        <span className="font-semibold text-slate-800">{r.lr}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {r.etaOrArrival}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                            r.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-50 text-primary border border-blue-200'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Emergency Vehicle Substitutions */}
      {(activeFilter === 'ALL' || activeFilter === 'SUBSTITUTES') && (
        <div className="bg-white border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h2 className="text-xs font-semibold text-foreground">
                Emergency Vehicle Substitutions (Field Breakdown Swaps)
              </h2>
            </div>
            <span className="text-xs tabular-nums font-medium text-slate-500">
              {substitutes.length} record(s) today
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-subtle border-b border-border text-slate-600 font-semibold">
                  <th className="py-3 px-4">Substitute Vehicle</th>
                  <th className="py-3 px-4">Replaced Broken Vehicle</th>
                  <th className="py-3 px-4">ZMCC Assignment</th>
                  <th className="py-3 px-4">Registered By / Timestamp</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {substitutes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No emergency vehicle replacements active.
                    </td>
                  </tr>
                ) : (
                  substitutes.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="tabular-nums font-semibold text-foreground">{s.vehicleNumber}</div>
                        <div className="text-slate-500 text-xs">{s.vehicleType}</div>
                      </td>
                      <td className="py-3 px-4 tabular-nums font-semibold text-rose-700">
                        {s.replacedVehicleNumber} (Broken)
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {s.zmccName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-semibold">{s.registeredBy}</div>
                        <div className="text-slate-500 text-xs tabular-nums">
                          {new Date(s.timestamp).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
