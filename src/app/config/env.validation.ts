import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database configuration
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/tokens"),

  // Kafka configuration
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_CLIENT_ID: z.string().default("token-price-service"),
  KAFKA_TOPIC: z.string().default("token-price-updates"),

  // Application behavior flags
  AUTO_SEED_ON_STARTUP: z.enum(["true", "false"]).default("true"),
});

export function validateEnv(config: Record<string, unknown>) {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`ENV validation error: ${message}`);
  }
  return parsed.data as Record<string, unknown>;
}
