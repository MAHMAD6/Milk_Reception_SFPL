import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 talks to PostgreSQL through a driver adapter (node-postgres) instead of
// the Rust query engine, and no longer reads DATABASE_URL implicitly.
export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof createPrismaClient> | undefined;
} & typeof global;

function getPrismaClient(): PrismaClient {
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = createPrismaClient();
  }
  return globalThis.prismaGlobal;
}

/**
 * Lazily-connected client: the connection is created on first use, not at import time,
 * so `next build` can load route modules without DATABASE_URL (e.g. in a container
 * build stage). One client per process, reused across hot reloads in development.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
