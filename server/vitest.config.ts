import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://women360:women360@localhost:5432/women360_test?schema=public",
      JWT_ACCESS_SECRET: "test-access-secret-please-override-0123456789",
      JWT_REFRESH_SECRET: "test-refresh-secret-please-override-0123456789",
      CORS_ORIGINS: "http://localhost:5173",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
