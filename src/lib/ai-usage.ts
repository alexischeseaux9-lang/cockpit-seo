import { getServiceClient } from "./supabase";

// Pricing (USD par token / par image). Verbatim V3.
const ANTHROPIC_PRICING: Record<string, { input: number; output: number; cache_read: number; cache_write: number }> = {
  "claude-sonnet-4-6": { input: 0.000003, output: 0.000015, cache_read: 0.0000003, cache_write: 0.00000375 },
  "claude-haiku-4-5": { input: 0.0000008, output: 0.000004, cache_read: 0.00000008, cache_write: 0.000001 },
};

export const FAL_PRICING: Record<string, number> = {
  "fal-ai/flux/schnell": 0.003,
  "fal-ai/flux/dev": 0.025,
  "fal-ai/flux-pro/v1.1": 0.04,
  "fal-ai/flux-pro": 0.05,
};

type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

// Best-effort: ne jamais casser un pipeline si le log echoue.
export async function logAnthropicUsage(opts: {
  model: string;
  usage: AnthropicUsage;
  context: string;
  site_id?: string | null;
}): Promise<void> {
  try {
    const p = ANTHROPIC_PRICING[opts.model] || ANTHROPIC_PRICING["claude-sonnet-4-6"];
    const u = opts.usage || {};
    const cost =
      (u.input_tokens || 0) * p.input +
      (u.output_tokens || 0) * p.output +
      (u.cache_read_input_tokens || 0) * p.cache_read +
      (u.cache_creation_input_tokens || 0) * p.cache_write;
    await getServiceClient().from("ai_usage_log").insert({
      provider: "anthropic",
      model: opts.model,
      context: opts.context,
      site_id: opts.site_id || null,
      input_tokens: u.input_tokens || 0,
      output_tokens: u.output_tokens || 0,
      cached_input_tokens: u.cache_read_input_tokens || 0,
      cache_creation_tokens: u.cache_creation_input_tokens || 0,
      cost_usd: Number(cost.toFixed(6)),
    });
  } catch {
    /* best-effort */
  }
}

export async function logFalUsage(opts: {
  model: string;
  context: string;
  size?: string;
  site_id?: string | null;
}): Promise<void> {
  try {
    const cost = FAL_PRICING[opts.model] ?? 0.025;
    await getServiceClient().from("ai_usage_log").insert({
      provider: "fal",
      model: opts.model,
      context: opts.context,
      site_id: opts.site_id || null,
      image_count: 1,
      image_size: opts.size || null,
      cost_usd: cost,
    });
  } catch {
    /* best-effort */
  }
}
