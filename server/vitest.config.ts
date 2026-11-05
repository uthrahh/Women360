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
      // The review-needed features are exercised by their own tests; one test turns this off.
      CLINICAL_CONTENT: "true",
      // Pinned so tests never depend on a local .env file.
      SUPPORT_EMAIL: "admin.women360@gmail.com",
      DATABASE_URL: "postgresql://women360:women360@localhost:5432/women360_test?schema=public",
      JWT_ACCESS_SECRET: "test-access-secret-please-override-0123456789",
      JWT_REFRESH_SECRET: "test-refresh-secret-please-override-0123456789",
      CORS_ORIGINS: "http://localhost:5173",
      // Throwaway web-push keys made for the tests; they protect nothing.
      VAPID_PUBLIC_KEY: "BHzxe064z8zPFDasUNUkQeyIOQagiphIE2WSa5cWidEsYXm0lXA5GFD9sJmJygBKN6OPaP3kTGLiWgFBtH7JHUc",
      VAPID_PRIVATE_KEY: "QAf-vYE5oGwyY9V6AUFPfPOhxQC-9pXIdSuBZbAatF8",
      // Throwaway token for the backup-report route's tests.
      BACKUP_REPORT_TOKEN: "test-backup-report-token-0123456789abcdef",
      // Test-only key (32 zero-padded bytes, base64) so two-factor is exercised.
      TWO_FACTOR_ENCRYPTION_KEY: "dzM2MHRlc3R3MzYwdGVzdHczNjB0ZXN0dzM2MHRlc3Q=",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
