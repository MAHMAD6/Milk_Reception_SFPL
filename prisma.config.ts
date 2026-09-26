import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 reads the connection URL from here (not schema.prisma) and no longer
// loads .env on its own. CI provides DATABASE_URL as a real environment variable.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
