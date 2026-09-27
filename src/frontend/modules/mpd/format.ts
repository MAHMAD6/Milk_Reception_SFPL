export const NO_DATA = '—';

/** Formats a telemetry number, rendering "—" when the system holds no data for it. */
export function fmtNum(value: number | null | undefined, suffix = ''): string {
  return value === null || value === undefined || Number.isNaN(value) ? NO_DATA : `${value.toLocaleString()}${suffix}`;
}
