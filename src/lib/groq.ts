import type { ProviderId, Settings } from "./types";
import {
  MODEL_TPM,
  PROVIDER_TPM,
  TOKEN_BUDGET_MARGIN,
  CHARS_PER_TOKEN,
  DEFAULT_MAX_TOKENS,
  MIN_RESERVED_TOKENS,
  MAX_TOKENS_TPM_FRACTION,
  GPT_OSS_TEMPERATURE,
  GPT_OSS_TOP_P,
  GPT_OSS_REASONING_EFFORT,
  DEFAULT_RETRIES,
  RETRY_DELAYS_MS,
  EMPTY_RESPONSE_RETRY_DELAY_MS,
  TPM_RESET_WAIT_MS,
  MIN_PACE_WAIT_MS,
  BUDGET_RESET_BUFFER_MS,
  EXCLUDED_MODEL_PATTERNS,
  GEMINI_MODEL_PATTERN,
  OPENROUTER_FREE_PATTERN,
  MAX_MODELS_DISPLAY,
} from "./constants";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  baseUrl: string;
  keyUrl: string;
  blurb: string;
  models: { id: string; label: string }[];
}

/** Free OpenAI-compatible providers. All four support /chat/completions with a Bearer key. */
export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  groq: {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
    blurb: "Fastest inference on free keys. Best chat models today: GPT-OSS 120B/20B, plus Kimi K2 and Llama 4 Scout when available.",
    models: [
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B — best chat model on free keys (recommended)" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B — faster, lighter on free-tier rate limits" },
      { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B — if available on your key" },
      { id: "moonshotai/kimi-k2-instruct-0905", label: "Kimi K2 Instruct — if available on your key" },
    ],
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyUrl: "https://aistudio.google.com/apikey",
    blurb: "Best free quota + a 1M-token context window — huge CV batches fit in far fewer calls. OpenAI-compatible endpoint, JSON mode supported.",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash — smart, generous free tier (recommended)" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite — fastest, lightest on quota" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash — older, wide availability" },
    ],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/keys",
    blurb: "One key, many free models (look for the :free tag — the lineup rotates, verify at openrouter.ai/models).",
    models: [
      { id: "meta-llama/llama-4-maverick:free", label: "Llama 4 Maverick (free) — strong all-rounder" },
      { id: "meta-llama/llama-4-scout:free", label: "Llama 4 Scout (free) — lighter" },
      { id: "mistralai/mistral-small-3.2-24b-instruct:free", label: "Mistral Small 3.2 24B (free)" },
      { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B (free) — good fallback" },
    ],
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    keyUrl: "https://cloud.cerebras.ai",
    blurb: "Groq-class speed on Llama models with a simple free tier — a great second engine if Groq throttles you.",
    models: [
      { id: "llama-3.3-70b", label: "Llama 3.3 70B — best quality (recommended)" },
      { id: "qwen-3-32b", label: "Qwen 3 32B — balanced" },
      { id: "llama-3.1-8b", label: "Llama 3.1 8B — fastest" },
    ],
  },
};

export const DEFAULT_SETTINGS: Settings = {
  provider: "groq",
  apiKey: "",
  model: "openai/gpt-oss-120b",
  temperature: 0.2,
};

/** Safe lookup that tolerates old saved settings without a provider field. */
export function getProvider(s: Settings): ProviderInfo {
  return PROVIDERS[s.provider] ?? PROVIDERS.groq;
}

/* ---------------- free-tier token budgeting ----------------
 * Groq's free tier bills in tokens-per-minute (TPM). GPT-OSS 120B allows only
 * ~8,000 TPM, and a request's reserved output counts toward it. So every call
 * is (a) sized to fit the minute budget and (b) paced through a rolling
 * 60-second window so consecutive batches never exceed it.
 */

/** Tokens-per-minute budget for the configured model (conservative). */
export function getTpm(s: Settings): number {
  return MODEL_TPM[s.model] ?? PROVIDER_TPM[s.provider ?? "groq"] ?? 100000;
}

/** Rough token estimate (≈3.6 chars/token for English/mixed text). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

const minuteWindow: { t: number; tokens: number }[] = [];

/** Waits (if needed) until `tokens` fits inside the rolling 1-minute budget. */
async function pace(s: Settings, tokens: number): Promise<void> {
  const budget = Math.floor(getTpm(s) * TOKEN_BUDGET_MARGIN);
  for (;;) {
    const now = Date.now();
    while (minuteWindow.length && now - minuteWindow[0].t > 60000) minuteWindow.shift();
    const used = minuteWindow.reduce((a, e) => a + e.tokens, 0);
    if (used + tokens <= budget) {
      minuteWindow.push({ t: now, tokens });
      return;
    }
    const oldest = minuteWindow[0]?.t ?? now;
    await sleep(Math.max(MIN_PACE_WAIT_MS, 60000 - (now - oldest) + BUDGET_RESET_BUFFER_MS));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ChatOpts {
  json?: boolean;
  maxTokens?: number;
  retries?: number;
  reasoning?: "low" | "medium" | "high";
}

/**
 * Calls Groq's OpenAI-compatible endpoint directly from the browser.
 * Free-tier 429s are retried with back-off (≈9 s, then ≈22 s).
 */
export async function groqChat(
  s: Settings,
  system: string,
  user: string,
  opts?: ChatOpts
): Promise<string> {
  const { json = false, maxTokens = DEFAULT_MAX_TOKENS, retries = DEFAULT_RETRIES } = opts ?? {};
  const provider = getProvider(s);
  if (!s.apiKey.trim()) {
    throw new Error(`Add your free ${provider.name} API key in Settings first (${provider.keyUrl}).`);
  }

  const isGptOss = s.model.includes("gpt-oss");
  const tpm = getTpm(s);
  // Reserved output must leave room for the prompt inside the minute budget.
  const effMax = Math.min(maxTokens, Math.max(MIN_RESERVED_TOKENS, Math.floor(tpm * MAX_TOKENS_TPM_FRACTION)));
  const reserved = estimateTokens(system) + estimateTokens(user) + 80 + effMax;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
    await pace(s, reserved);
    try {
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: s.model,
          // Groq serves gpt-oss with two hard constraints: sampling is pinned
          // to temperature=1 / top_p=1, and its structured-output
          // (response_format) path returns empty content — so JSON is
          // requested via the prompt instead, and reasoning effort is capped
          // so internal "thinking" can't eat the completion budget.
          ...(isGptOss
            ? { temperature: GPT_OSS_TEMPERATURE, top_p: GPT_OSS_TOP_P, reasoning_effort: opts?.reasoning ?? GPT_OSS_REASONING_EFFORT }
            : { temperature: s.temperature }),
          // Groq (gpt-oss) needs max_completion_tokens; Google's compat layer
          // only accepts the legacy max_tokens field.
          ...(s.provider === "groq" ? { max_completion_tokens: effMax } : { max_tokens: effMax }),
          ...(json && !isGptOss ? { response_format: { type: "json_object" } } : {}),
          messages: [
            {
              role: "system",
              content:
                system +
                (json && isGptOss
                  ? "\nIMPORTANT: Respond with ONLY raw JSON — no markdown code fences, no commentary. The response must start with { and end with }."
                  : ""),
            },
            { role: "user", content: user },
          ],
        }),
      });

      if (!res.ok) {
        let msg = `Groq error ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.error?.message ?? msg;
        } catch {
          /* non-JSON error body */
        }
        if (res.status === 429 && attempt < retries) {
          lastErr = new Error(`${msg} — backing off and retrying…`);
          continue;
        }
        // Free-tier TPM overflow: a single request larger than the minute
        // budget. Wait out the window and retry once.
        if (res.status === 400 && /tokens per minute|request too large/i.test(msg)) {
          if (attempt < retries) {
            lastErr = new Error(`${msg} — waiting for the token budget to reset…`);
            await sleep(TPM_RESET_WAIT_MS);
            continue;
          }
          throw new Error(
            "This request exceeds the model's free-tier tokens-per-minute limit. Switch to GPT-OSS 20B or Google Gemini in Settings, or shorten the JD."
          );
        }
        if ((res.status === 400 || res.status === 404) && /model/i.test(msg)) {
          throw new Error(
            `${msg} — this model isn't available on your key. In Settings, use "Fetch available models" to list the models your key can actually use.`
          );
        }
        throw new Error(`[${res.status}] ${msg}`);
      }

      const data = await res.json();
      const message = data?.choices?.[0]?.message;
      const content = message?.content;
      const reasoning = message?.reasoning;
      const finish = data?.choices?.[0]?.finish_reason;
      if (typeof content === "string" && content.trim()) return content;
      // Some gpt-oss builds deliver the finished answer in `reasoning`.
      if (typeof reasoning === "string" && reasoning.trim()) return reasoning;
      if (attempt < retries) {
        lastErr = new Error("empty");
        await sleep(EMPTY_RESPONSE_RETRY_DELAY_MS);
        continue;
      }
      if (finish === "length") {
        throw new Error(
          "The model ran out of tokens before finishing its reply. Lower the shortlist size or batch count, or switch to GPT-OSS 20B in Settings."
        );
      }
      throw new Error(
        `Groq returned no content (model: ${s.model}, finish_reason: ${finish ?? "none"}). Try once more — if it repeats, switch to GPT-OSS 20B in Settings.`
      );
    } catch (e) {
      lastErr = e;
      // Network-level failures are retryable too.
      if (!(e instanceof TypeError) && !(e instanceof Error && e.message.includes("backing off"))) {
        throw e;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Request to Groq failed.");
}

/** Pulls a JSON object out of a model reply, tolerating code fences and prose. */
export function extractJson(raw: string): any {
  let t = raw.trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s !== -1 && e > s) {
    try {
      return JSON.parse(t.slice(s, e + 1));
    } catch {
      /* fall through to array attempt */
    }
  }
  const sa = t.indexOf("[");
  const ea = t.lastIndexOf("]");
  if (sa !== -1 && ea > sa) {
    try {
      return JSON.parse(t.slice(sa, ea + 1));
    } catch {
      /* ignore */
    }
  }
  throw new Error("The model didn't return valid JSON. Try again, or switch to a stronger model in Settings.");
}

/**
 * Asks the provider's OpenAI-compatible /models endpoint which chat models
 * this key can actually use — removes all guesswork about model IDs.
 */
export async function fetchModels(s: Settings): Promise<{ id: string; label: string }[]> {
  const provider = getProvider(s);
  if (!s.apiKey.trim()) throw new Error("Enter your API key first.");
  const res = await fetch(`${provider.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${s.apiKey.trim()}` },
  });
  if (!res.ok) {
    let msg = `Provider error ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
    } catch {
      /* non-JSON body */
    }
    throw new Error(`[${res.status}] ${msg}`);
  }
  const data = await res.json();
  const ids: string[] = Array.isArray(data?.data)
    ? data.data.map((m: any) => String(m?.id ?? "")).filter(Boolean)
    : [];
  const drop = EXCLUDED_MODEL_PATTERNS;
  let kept = Array.from(new Set(ids.filter((id) => !drop.test(id))));
  if (s.provider === "gemini") kept = kept.filter((id) => GEMINI_MODEL_PATTERN.test(id));
  kept.sort((a, b) => a.localeCompare(b));
  if (s.provider === "openrouter") {
    // Surface the ":free" lineup first — that's what the free tier serves.
    kept.sort((a, b) => Number(OPENROUTER_FREE_PATTERN.test(b)) - Number(OPENROUTER_FREE_PATTERN.test(a)));
  }
  const out = kept.slice(0, MAX_MODELS_DISPLAY).map((id) => ({
    id,
    label: id + (s.provider === "openrouter" && OPENROUTER_FREE_PATTERN.test(id) ? " · free" : ""),
  }));
  if (!out.length) throw new Error("The provider returned no usable chat models for this key.");
  return out;
}
