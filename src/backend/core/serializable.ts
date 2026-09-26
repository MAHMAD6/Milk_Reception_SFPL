import type { Prisma, ProcurementSource, User as DbUser } from '@prisma/client';

/**
 * Input types for response serializers. A serializer accepts the base model plus
 * whichever relations it reads; relations are optional because different queries
 * include different subsets.
 */

/** A related user as selected for display (id + names). */
export type UserRef = Pick<DbUser, 'id' | 'username' | 'full_name'>;

/** A related procurement source (ZMCC / contractor) as selected for display. */
export type SourceRef = Pick<ProcurementSource, 'id' | 'code' | 'name'>;

/** A numeric DB value as it may arrive: Prisma Decimal, or already converted. */
export type NumericLike = Prisma.Decimal | number | string;
