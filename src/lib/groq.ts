import type { Settings } from "./types";

/** Models currently served on Groq's free tier. GPT-OSS is the best chat model most free keys get. */
export const GROQ_MODELS = [
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B — best chat model on free keys (recommended)" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B — faster, lighter on free-tier rate limits" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B — if available on your key" },
  { id: "moonshotai/kimi-k2-instruct-0905", label: "Kimi K2 Instruct — if available on your key" },
] as const;

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "openai/gpt-oss-120b",
  temperature: 0.2,
};

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
  const { json = false, maxTokens = 6000, retries = 2 } = opts ?? {};
  if (!s.apiKey.trim()) {
    throw new Error("Add your free Groq API key in Settings first (console.groq.com → API Keys).");
  }

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(attempt === 1 ? 9000 : 22000);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: s.model,
          temperature: s.temperature,
          // gpt-oss are reasoning models: the canonical budget field is
          // max_completion_tokens, and unbounded "thinking" can eat the whole
          // budget — so reasoning effort is capped (default low).
          max_completion_tokens: maxTokens,
          ...(s.model.includes("gpt-oss") ? { reasoning_effort: opts?.reasoning ?? "low" } : {}),
          ...(json ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: system },
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
        if ((res.status === 400 || res.status === 404) && /model/i.test(msg)) {
          throw new Error(
            `${msg} — this model isn't on your key. Open Settings and choose GPT-OSS 120B (the default free-tier chat model).`
          );
        }
        throw new Error(msg);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      const finish = data?.choices?.[0]?.finish_reason;
      if (typeof content !== "string" || !content.trim()) {
        if (attempt < retries) {
          lastErr = new Error("empty");
          await sleep(3000);
          continue;
        }
        throw new Error(
          finish === "length"
            ? "The model ran out of tokens before finishing its reply. Lower the shortlist size or batch count, or switch to GPT-OSS 20B in Settings."
            : "Groq returned an empty response (the model spent its token budget on internal reasoning). Try again, or switch to GPT-OSS 20B in Settings."
        );
      }
      return content;
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
