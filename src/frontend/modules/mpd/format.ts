/** Placeholder for figures with no recorded data. */
export const NO_DATA = '—';

/** Formats a possibly-missing number with an optional unit suffix, e.g. `4.2%` or `12,400 L`. */
export function formatMetric(value: number | null | undefined, suffix = ''): string {
  return value === null || value === undefined ? NO_DATA : `${value.toLocaleString()}${suffix}`;
}
