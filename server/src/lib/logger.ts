import pino from "pino";
import { env } from "@/config/env";

// Redact anything that could ever carry a credential or health-record
// payload — never log passwords, tokens, or request bodies.
export const logger = pino({
  level: env.isProduction ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body",
      "res.body",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
    ],
    censor: "[redacted]",
  },
  transport: env.isProduction ? undefined : { target: "pino-pretty", options: { colorize: true } },
});
