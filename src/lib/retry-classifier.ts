// Classifie une erreur de job en bucket (interface V3 verbatim).

export type FailureBucket = "retry" | "paused" | "permanent";
export type ClassifiedFailure = { bucket: FailureBucket; reason: string; message: string };

const PAUSED_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  { regex: /Exhausted balance|User is locked.*Reason: Exhausted/i, reason: "fal_credit" },
  { regex: /credit balance is too low|insufficient_quota|insufficient credits|credits_exhausted/i, reason: "anthropic_credit" },
  { regex: /Billing hard limit has been reached|billing_limit_user_error/i, reason: "openai_credit" },
  { regex: /401\s+Unauthorized|invalid_api_key|API key not valid|invalid x-api-key/i, reason: "invalid_credentials" },
  { regex: /403\s+Forbidden(?!.*Reached concurrent)/i, reason: "forbidden_creds" },
  { regex: /shopify.*access[_ ]denied|access_denied|shopify_access_denied/i, reason: "shopify_access_denied" },
  { regex: /ENOTFOUND|ECONNREFUSED|getaddrinfo/i, reason: "dns_unreachable" },
];

const RETRY_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  { regex: /fal\.ai 429|concurrent_requests_limit|fal_rate_limit/i, reason: "fal_rate_limit" },
  { regex: /rate_limit_error|rate.limit.exceeded|429\s+too\s+many|too many/i, reason: "rate_limit" },
  { regex: /overloaded_error|Overloaded/i, reason: "anthropic_overloaded" },
  { regex: /5\d{2}\s+(Internal|Bad|Service|Gateway)|provider_5xx/i, reason: "provider_5xx" },
  { regex: /GitHub 409.*(but expected|is at)/i, reason: "github_race" },
  { regex: /GitHub 422.*(sha|does not match)/i, reason: "github_sha_mismatch" },
  { regex: /ETIMEDOUT|ECONNRESET|fetch failed|network.timeout|timeout of \d+ms exceeded|timeout/i, reason: "network_timeout" },
  { regex: /Handle has already been taken/i, reason: "shopify_handle_taken" },
];

export const MAX_AUTO_RETRIES = 4;

export function classifyFailure(error: unknown): ClassifiedFailure {
  const message = error instanceof Error ? error.message : String(error ?? "unknown error");
  const truncated = message.slice(0, 2000);
  // validation: jamais de retry (donnees cassees)
  if (/validation|invalid input|anti_patterns|persona_leak|json_parse|missing_keyword/i.test(message)) {
    return { bucket: "permanent", reason: "validation_error", message: truncated };
  }
  for (const { regex, reason } of PAUSED_PATTERNS) {
    if (regex.test(message)) return { bucket: "paused", reason, message: truncated };
  }
  for (const { regex, reason } of RETRY_PATTERNS) {
    if (regex.test(message)) return { bucket: "retry", reason, message: truncated };
  }
  return { bucket: "permanent", reason: "unknown", message: truncated };
}
