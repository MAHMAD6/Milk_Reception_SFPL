import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 reads the connection URL from here (not schema.prisma) and no longer
// loads .env on its own. CI provides DATABASE_URL as a real environment variable.
// `prisma generate` (npm postinstall, Docker build stage) needs no database, so the URL
// is read leniently here; migrate/seed commands still fail clearly when it is missing.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
