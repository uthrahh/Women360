# Migrations

No migration has been generated yet — that requires a running Postgres
instance, which the environment that wrote this schema didn't have
access to (see the root `server/README.md` note on unverified code).

Run this once, locally, against `docker-compose.yml`'s Postgres:

```bash
npm run prisma:migrate -- --name init
```

That creates `prisma/migrations/<timestamp>_init/migration.sql` — commit
it. After that exists, switch `.github/workflows/ci.yml`'s `server` job
from `npx prisma db push` to `npm run prisma:migrate:deploy`, which
applies committed migrations instead of pushing the schema directly.
