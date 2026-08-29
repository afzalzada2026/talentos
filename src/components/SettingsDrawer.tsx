import { useEffect, useState } from "react";
import type { Settings } from "../lib/types";
import { DEFAULT_SETTINGS, PROVIDERS, fetchModels, getProvider, groqChat } from "../lib/groq";
import type { ProviderId } from "../lib/types";
import { useLocalStorage } from "../lib/store";
import { Btn, Field, Spinner, inputCls, useToast } from "./ui";
import { IconCheck, IconEye, IconEyeOff, IconKey, IconRefresh, IconX, IconAlert } from "./icons";

export default function SettingsDrawer({
  open,
  onClose,
  settings,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (s: Settings) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Settings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState("");
  const [fetched, setFetched] = useLocalStorage<Record<string, { id: string; label: string }[]>>("talentos.fetchedModels", {});
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setTesting("idle");
      setTestMsg("");
    }
  }, [open, settings]);

  async function test() {
    setTesting("busy");
    setTestMsg("");
    try {
      await groqChat(draft, "You are a connectivity probe.", "Reply with the single word: ready", {
        maxTokens: 128,
        retries: 1,
      });
      setTesting("ok");
      setTestMsg("Connection OK — the model responded.");
    } catch (e) {
      setTesting("fail");
      setTestMsg(e instanceof Error ? e.message : "Connection failed.");
    }
  }

  async function fetchModelList() {
    setFetching(true);
    try {
      const list = await fetchModels(draft);
      setFetched((f) => ({ ...f, [draft.provider]: list }));
      toast("success", `Found ${list.length} usable model${list.length === 1 ? "" : "s"} on your ${getProvider(draft).name} key.`);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Could not fetch the model list.");
    } finally {
      setFetching(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-pine-950/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-[65] flex h-full w-[392px] max-w-[94vw] flex-col border-l border-line bg-panel shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-600">Configuration</p>
            <h2 className="font-display text-lg font-bold tracking-tight">AI Engine Settings</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-ink3 transition-colors hover:bg-pine-50 hover:text-ink" aria-label="Close settings">
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="space-y-2">
            <Field label="AI provider" hint="all free tiers">
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(PROVIDERS) as ProviderId[]).map((pid) => {
                  const p = PROVIDERS[pid];
                  const active = draft.provider === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() =>
                        setDraft({ ...draft, provider: pid, model: p.models[0].id })
                      }
                      className={`rounded-lg border px-3 py-2 text-left transition-all ${
                        active
                          ? "border-pine-500 bg-pine-50 ring-2 ring-pine-500/15"
                          : "border-line2 bg-white hover:border-pine-400"
                      }`}
                    >
                      <span className={`block text-[12.5px] font-bold ${active ? "text-pine-700" : "text-ink"}`}>{p.name}</span>
                      <span className="block font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink3">
                        {pid === "groq" ? "current default" : pid === "gemini" ? "1M context" : pid === "openrouter" ? "many models" : "groq-speed"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <p className="text-[12px] leading-relaxed text-ink3">{getProvider(draft).blurb}</p>
          </section>

          <hr className="border-line" />

          <section className="space-y-2">
            <Field label={`${getProvider(draft).name} API key`} hint="free · stored only in this browser">
              <div className="relative">
                <IconKey className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink3" />
                <input
                  type={showKey ? "text" : "password"}
                  className={inputCls + " pl-9 pr-10 font-mono text-[12.5px]"}
                  placeholder="gsk_..."
                  value={draft.apiKey}
                  onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink3 transition-colors hover:text-ink"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <p className="text-[12px] leading-relaxed text-ink3">
              Create a free key at{" "}
              <a
                href={getProvider(draft).keyUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-pine-600 underline decoration-pine-200 underline-offset-2 hover:text-pine-700"
              >
                {getProvider(draft).keyUrl.replace("https://", "")}
              </a>
              . No budget needed — every provider here runs a free tier.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Btn variant="outline" size="sm" onClick={test} disabled={testing === "busy"}>
                {testing === "busy" ? <Spinner className="h-3.5 w-3.5" /> : testing === "ok" ? <IconCheck className="h-3.5 w-3.5 text-onboarded" /> : null}
                Test connection
              </Btn>
              {testMsg ? (
                <span className={`flex items-start gap-1.5 text-[12px] font-medium ${testing === "ok" ? "text-onboarded" : "text-cancel"}`}>
                  {testing === "fail" ? <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
                  {testMsg}
                </span>
              ) : null}
            </div>
          </section>

          <hr className="border-line" />

          <section className="space-y-2">
            <Field label="Model">
              <select className={inputCls + " cursor-pointer"} value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })}>
                {!getProvider(draft).models.some((m) => m.id === draft.model) &&
                  !(fetched[draft.provider] ?? []).some((m) => m.id === draft.model) && (
                    <option value={draft.model}>{draft.model} — saved, not on this provider's list (may fail)</option>
                  )}
                {(fetched[draft.provider] ?? []).length > 0 ? (
                  <>
                    <optgroup label={`Available on your ${getProvider(draft).name} key`}>
                      {(fetched[draft.provider] ?? []).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Built-in recommendations">
                      {getProvider(draft)
                        .models.filter((m) => !(fetched[draft.provider] ?? []).some((f) => f.id === m.id))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                    </optgroup>
                  </>
                ) : (
                  getProvider(draft).models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))
                )}
              </select>
            </Field>
            <button
              type="button"
              onClick={fetchModelList}
              disabled={fetching}
              className="inline-flex items-center gap-1.5 rounded-md border border-line2 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink2 transition-all hover:border-pine-400 hover:text-pine-700 active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
            >
              {fetching ? <Spinner className="h-3.5 w-3.5" /> : <IconRefresh className="h-3.5 w-3.5" />}
              Fetch models available on my key
            </button>
            <p className="text-[12px] leading-relaxed text-ink3">
              Unsure which model your key serves? Fetch the live list — the dropdown then shows exactly what works. Hitting free-tier rate limits on huge CV files? Switch heavy screening runs to{" "}
              <strong className="text-ink2">GPT-OSS 20B</strong> or <strong className="text-ink2">Gemini 2.5 Flash</strong>.
            </p>
          </section>

          <section className="space-y-2">
            <Field label="Temperature" hint={`creativity · ${draft.temperature.toFixed(1)}`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={draft.temperature}
                onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })}
                className="w-full accent-pine-600"
              />
            </Field>
            <p className="text-[12px] text-ink3">
              Lower = stricter, more consistent screening. Note: Groq pins GPT-OSS models to temperature 1 — this slider applies to other models, and the app handles the GPT-OSS constraint automatically.
            </p>
          </section>

          <hr className="border-line" />

          <section className="rounded-lg border border-line bg-pine-50/60 p-3.5">
            <h4 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-pine-700">Free-tier tips</h4>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-ink2">
              <li>Groq may throttle to ~1 request per 30s on some models — the app waits and retries automatically.</li>
              <li>Everything else (CVs, tracker, JDs) is stored locally in your browser; only prompts are sent to Groq.</li>
            </ul>
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(DEFAULT_SETTINGS);
              toast("info", "Settings reset to defaults — remember to Save.");
            }}
          >
            Reset
          </Btn>
          <div className="flex gap-2">
            <Btn variant="outline" onClick={onClose}>
              Cancel
            </Btn>
            <Btn
              onClick={() => {
                onSave(draft);
                toast("success", draft.apiKey.trim() ? "Settings saved. AI modules are ready." : "Settings saved — add an API key to unlock AI.");
                onClose();
              }}
            >
              <IconCheck className="h-4 w-4" />
              Save settings
            </Btn>
          </div>
        </div>
      </aside>
    </>
  );
}
