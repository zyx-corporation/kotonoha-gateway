/**
 * Gateway configuration from environment (M5-P2).
 */

export type GatewayConfig = {
  host: string;
  port: number;
  /** Empty set = auth disabled (local dev only). */
  apiKeys: Set<string>;
  rateLimitPerMinute: number;
};

export const GATEWAY_VERSION = "0.1.1";

export function loadConfig(): GatewayConfig {
  const port = Number(process.env.PORT ?? "8787");
  const keysRaw = process.env.KOTONOHA_GATEWAY_API_KEYS?.trim() ?? "";
  const apiKeys = new Set(
    keysRaw
      ? keysRaw
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      : [],
  );
  return {
    host: process.env.HOST ?? "127.0.0.1",
    port: Number.isFinite(port) && port > 0 ? port : 8787,
    apiKeys,
    rateLimitPerMinute: Math.max(
      1,
      Number(process.env.KOTONOHA_GATEWAY_RATE_LIMIT ?? "60"),
    ),
  };
}
