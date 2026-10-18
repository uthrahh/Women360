import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Running test files across worker threads in parallel crashes tinypool
    // on this stack (Windows + shared Postgres connections) with an opaque
    // "Worker exited unexpectedly" — the suite is small enough that running
    // files sequentially costs a few seconds and is reliable instead.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://women360:women360@localhost:5432/women360_test?schema=public",
      JWT_ACCESS_SECRET: "test-access-secret-please-override-0123456789",
      JWT_REFRESH_SECRET: "test-refresh-secret-please-override-0123456789",
      CORS_ORIGINS: "http://localhost:5173",
      // Test-only key (32 zero-padded bytes, base64) so two-factor is exercised.
      TWO_FACTOR_ENCRYPTION_KEY: "dzM2MHRlc3R3MzYwdGVzdHczNjB0ZXN0dzM2MHRlc3Q=",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
