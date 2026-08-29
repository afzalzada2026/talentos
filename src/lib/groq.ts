import type { Settings } from "./types";

export const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile — best quality" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B — balanced" },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant — fastest, free-tier friendly" },
] as const;

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "llama-3.3-70b-versatile",
  temperature: 0.2,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ChatOpts {
  json?: boolean;
  maxTokens?: number;
  retries?: number;
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
          max_tokens: maxTokens,
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
        throw new Error(msg);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("Groq returned an empty response. Try again.");
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
