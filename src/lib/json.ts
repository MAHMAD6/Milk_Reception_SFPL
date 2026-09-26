import type { Prisma } from '@prisma/client';

/**
 * Typed access to Prisma JSON columns (audit old/new values, evaluation snapshots, ...).
 * JSON columns are `Prisma.JsonValue`; these narrow them without resorting to `any`.
 */

export type JsonRecord = Record<string, unknown>;

/** The value as a plain object, or an empty object when it is not one. */
export function jsonRecord(value: unknown): JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonRecord) : {};
}

/** A string field of a JSON object, or undefined. */
export function jsonString(value: unknown, key: string): string | undefined {
  const field = jsonRecord(value)[key];
  return typeof field === 'string' ? field : undefined;
}

/** Cast a serialisable value for writing into a Prisma JSON column. */
export function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
