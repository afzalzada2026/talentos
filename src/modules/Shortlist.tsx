import { useMemo, useRef, useState } from "react";
import type { CandidateSummary, CvBlock, Settings } from "../lib/types";
import { extractJson, groqChat } from "../lib/groq";
import { splitCvs } from "../lib/cv";
import { copyText, smartDownload, toCsv } from "../lib/download";
import { extractDocxText } from "../lib/docx";
import { extractPdfText } from "../lib/pdf";
import { SAMPLE_CVS, SAMPLE_JD } from "../lib/demo";
import { Bar, Btn, Card, Field, FileGrabModal, Spinner, areaCls, inputCls, useToast } from "../components/ui";
import {
  IconAlert,
  IconArrow,
  IconCheck,
  IconCopy,
  IconDownload,
  IconExternal,
  IconKey,
  IconRefresh,
  IconScan,
  IconSpark,
  IconTable,
  IconUpload,
  IconX,
} from "../components/icons";

const SCREEN_SYS = `You are an expert recruiter and ATS screening engine. For every CV provided, extract a factual candidate summary and score its match against the given job description.
Respond with ONLY a valid JSON object of this exact shape (no markdown fences, no commentary):
{"candidates":[{"cvName":"the CV file/header name","candidateName":"","currentTitle":"current or most recent job title","currentOrg":"current or most recent employer","relevantExp":"e.g. 8 yrs in frontend / React development","qualifications":"highest degrees & certifications, comma separated","email":"","phone":"","score":0,"why":"one sentence, max 25 words, on fit to the JD"}]}
Rules: score is an integer 0-100 judged strictly against the JD (skills, years, seniority, domain). Use "" when a field is missing — never invent data.`;

const RANK_SYS = `You are a Head of Talent Acquisition finalising a shortlist. You receive AI-extracted candidate summaries plus the job description. Re-assess every candidate against the JD, keep only the top N best matches, rank them (1 = best), and sharpen each "why".
Respond with ONLY a valid JSON object: {"shortlist":[ ...candidate objects with the same fields, sorted best first... ]} where "why" is 1-2 compelling sentences citing specific JD requirements the candidate meets. Do not add candidates that are not in the summaries and do not invent data.`;

const BATCH_BUDGET = 42000;
const CV_CAP = 6000;

function makeBatches(blocks: CvBlock[]): CvBlock[][] {
  const batches: CvBlock[][] = [];
  let cur: CvBlock[] = [];
  let size = 0;
  for (const b of blocks) {
    const t = Math.min(b.text.length, CV_CAP) + 60;
    if (cur.length && size + t > BATCH_BUDGET) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(b);
    size += t;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

function norm(c: any, fallbackName?: string): CandidateSummary {
  const score = Number(c?.score);
  return {
    cvName: String(c?.cvName || fallbackName || "—"),
    candidateName: String(c?.candidateName || "—"),
    currentTitle: String(c?.currentTitle || "—"),
    currentOrg: String(c?.currentOrg || "—"),
    relevantExp: String(c?.relevantExp ?? c?.relevantYears ?? "—"),
    qualifications: String(c?.qualifications || "—"),
    email: String(c?.email || "—"),
    phone: String(c?.phone || "—"),
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
    why: String(c?.why || "—"),
  };
}

type Phase = { kind: "idle" } | { kind: "screen"; batch: number; batches: number; screened: number } | { kind: "rank" } | { kind: "done" };

export default function Shortlist({ settings, onOpenSettings }: { settings: Settings; onOpenSettings: () => void }) {
  const toast = useToast();
  const [jd, setJd] = useState("");
  const [cvText, setCvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [topN, setTopN] = useState(10);
  const [sep, setSep] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [results, setResults] = useState<CandidateSummary[] | null>(null);
  const [error, setError] = useState("");
  const cancelRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const jdFileRef = useRef<HTMLInputElement>(null);
  const [jdSource, setJdSource] = useState("");
  const [grab, setGrab] = useState<{ filename: string; content: string; mime: string } | null>(null);

  /** Loads the JD from a file: .pdf parsed with pdf.js, .docx with the ZIP parser, both locally. */
  async function onJdFile(f: File | null) {
    if (!f) return;
    const name = f.name.toLowerCase();
    try {
      if (name.endsWith(".pdf")) {
        const text = await extractPdfText(await f.arrayBuffer());
        setJd(text);
        setJdSource(f.name);
        toast("success", `JD extracted from “${f.name}” (${text.length.toLocaleString()} chars). Paste-over if anything looks off.`);
      } else if (name.endsWith(".docx")) {
        const text = await extractDocxText(await f.arrayBuffer());
        setJd(text);
        setJdSource(f.name);
        toast("success", `JD extracted from “${f.name}” (${text.length.toLocaleString()} chars).`);
      } else if (name.endsWith(".doc")) {
        toast("error", "Legacy .doc files can't be read in-browser. Save the JD as .docx or PDF, or paste the text.");
      } else {
        const text = await f.text();
        if (!text.trim()) throw new Error("That file is empty.");
        setJd(text);
        setJdSource(f.name);
        toast("success", `JD loaded from “${f.name}”.`);
      }
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  const split = useMemo(() => (cvText.trim() ? splitCvs(cvText, sep) : { blocks: [], method: "empty" }), [cvText, sep]);
  const running = phase.kind === "screen" || phase.kind === "rank";

  function loadDemo() {
    setJd(SAMPLE_JD);
    setJdSource("");
    setCvText(SAMPLE_CVS);
    setSep("");
    setFileName("demo_candidates_merged.txt");
    setResults(null);
    setError("");
    toast("info", "Demo data loaded — 6 merged CVs + a Senior Frontend Engineer JD. Hit Run screening.");
  }

  async function onFile(f: File | null) {
    if (!f) return;
    try {
      const text = await f.text();
      setCvText(text);
      setFileName(f.name);
      setResults(null);
      toast("success", `Loaded ${f.name} (${(f.size / 1024).toFixed(0)} KB).`);
    } catch {
      toast("error", "Could not read that file. Try a plain .txt export.");
    }
  }

  async function run() {
    setError("");
    setResults(null);
    if (!settings.apiKey.trim()) {
      onOpenSettings();
      toast("error", "Add your free Groq API key first.");
      return;
    }
    if (!jd.trim()) {
      toast("error", "Paste the job description first.");
      return;
    }
    if (!split.blocks.length) {
      toast("error", "Paste or upload the merged CVs file first.");
      return;
    }
    if (split.blocks.length === 1 && cvText.length > 4000) {
      toast("info", "Only 1 CV block detected — set a custom separator if this file holds many CVs.");
    }

    const batches = makeBatches(split.blocks);
    cancelRef.current = false;

    try {
      const all: CandidateSummary[] = [];
      setPhase({ kind: "screen", batch: 0, batches: batches.length, screened: 0 });

      for (let i = 0; i < batches.length; i++) {
        if (cancelRef.current) throw new Error("__cancelled__");
        setPhase({ kind: "screen", batch: i, batches: batches.length, screened: all.length });
        const batchText = batches[i]
          .map((b) => `<<<CV name="${b.name}">>>\n${b.text.slice(0, CV_CAP)}\n<<<END>>>`)
          .join("\n\n");
        const raw = await groqChat(
          settings,
          SCREEN_SYS,
          `JOB DESCRIPTION:\n"""\n${jd}\n"""\n\nScreen every CV below and return one summary object per CV.\n\n${batchText}`,
          { json: true, maxTokens: 8192, reasoning: "low" }
        );
        const j = extractJson(raw);
        const list: any[] = Array.isArray(j) ? j : j?.candidates ?? j?.shortlist ?? [];
        list.forEach((c, idx) => all.push(norm(c, batches[i][idx]?.name)));
        setPhase({ kind: "screen", batch: i + 1, batches: batches.length, screened: all.length });
      }

      if (cancelRef.current) throw new Error("__cancelled__");
      if (!all.length) throw new Error("No candidates could be extracted from the CV file. Check the separator setting.");

      let finalList: CandidateSummary[];
      if (all.length > topN) {
        setPhase({ kind: "rank" });
        const pool = [...all].sort((a, b) => b.score - a.score).slice(0, 400);
        const raw = await groqChat(
          settings,
          RANK_SYS,
          `Shortlist size N = ${topN}\n\nJOB DESCRIPTION:\n"""\n${jd}\n"""\n\nCANDIDATE SUMMARIES (JSON):\n${JSON.stringify(pool)}`,
          { json: true, maxTokens: 8192, reasoning: "low" }
        );
        const j = extractJson(raw);
        const list: any[] = Array.isArray(j) ? j : j?.shortlist ?? j?.candidates ?? [];
        finalList = list.map((c) => norm(c)).slice(0, Math.max(1, topN));
        if (!finalList.length) finalList = [...all].sort((a, b) => b.score - a.score).slice(0, topN);
      } else {
        finalList = [...all].sort((a, b) => b.score - a.score);
      }

      setResults(finalList);
      setPhase({ kind: "done" });
      toast("success", `Shortlisted ${finalList.length} of ${all.length} candidates.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      if (msg.includes("__cancelled__")) {
        setPhase({ kind: "idle" });
        toast("info", "Screening cancelled after the current batch.");
      } else {
        setError(msg);
        setPhase({ kind: "idle" });
      }
    }
  }

  function exportCsv() {
    if (!results) return;
    const csv = "\ufeff" + toCsv([
      ["Rank", "CV Name", "Candidate Name", "Current/Last Job Title", "Current/Last Organization", "Relevant Experience", "Qualifications", "Email Address", "Phone Number", "Why should be considered?"],
      ...results.map((c, i) => [i + 1, c.cvName, c.candidateName, c.currentTitle, c.currentOrg, c.relevantExp, c.qualifications, c.email, c.phone, c.why]),
    ]);
    if (smartDownload("shortlist_top_candidates.csv", csv, "text/csv")) {
      toast("success", "CSV exported — opens in Excel.");
    } else {
      setGrab({ filename: "shortlist_top_candidates.csv", content: csv, mime: "text/csv" });
      toast("info", "Direct save is blocked in this preview — use the dialog to grab the file.");
    }
  }

  async function copyMd() {
    if (!results) return;
    const md =
      "| Rank | CV Name | Candidate | Current/Last Title | Current/Last Org | Relevant Exp. | Qualifications | Email | Phone | Why consider? |\n" +
      "|---|---|---|---|---|---|---|---|---|---|\n" +
      results.map((c, i) => `| ${i + 1} | ${c.cvName} | ${c.candidateName} | ${c.currentTitle} | ${c.currentOrg} | ${c.relevantExp} | ${c.qualifications} | ${c.email} | ${c.phone} | ${c.why} |`).join("\n");
    (await copyText(md)) ? toast("success", "Markdown table copied.") : toast("error", "Copy failed — use CSV export instead.");
  }

  const scoreTone = (s: number) => (s >= 80 ? "bg-onboarded" : s >= 60 ? "bg-gold-500" : "bg-cancel");

  return (
    <div className="space-y-5">
      {!settings.apiKey.trim() && (
        <div className="anim-rise flex flex-col gap-3 rounded-xl border border-gold-400/50 bg-gold-100/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <IconKey className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
            <div>
              <p className="text-[13.5px] font-semibold text-ink">Connect your free Groq (Llama) API key</p>
              <p className="text-[12.5px] text-ink2">Create one at console.groq.com/keys — it's free and stays in this browser.</p>
            </div>
          </div>
          <Btn variant="gold" size="sm" onClick={onOpenSettings} className="shrink-0">
            Open settings <IconArrow className="h-3.5 w-3.5" />
          </Btn>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-5">
        {/* -------- inputs -------- */}
        <div className="space-y-5 xl:col-span-3">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-[15px] font-bold tracking-tight">Job description</h3>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] text-ink3">
                  {jdSource ? (
                    <span className="text-pine-600">via {jdSource} · </span>
                  ) : null}
                  {jd.trim() ? `${(jd.length / 1000).toFixed(1)}k chars` : "paste or upload"}
                </span>
                <Btn variant="outline" size="sm" onClick={() => jdFileRef.current?.click()}>
                  <IconUpload className="h-3.5 w-3.5" /> Upload PDF / Word
                </Btn>
              </div>
            </div>
            <input
              ref={jdFileRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md,.text"
              className="hidden"
              onChange={(e) => {
                onJdFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <textarea
              className={areaCls + " min-h-[150px] font-[13px]"}
              placeholder={"Paste the full JD here, or upload it as PDF / Word…\n\ne.g. Senior Frontend Engineer — React, TypeScript, 6+ yrs…"}
              value={jd}
              onChange={(e) => {
                setJd(e.target.value);
                setJdSource("");
              }}
            />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Shortlist size" hint="top N candidates">
                <input
                  type="number"
                  min={1}
                  max={50}
                  className={inputCls + " font-mono"}
                  value={topN}
                  onChange={(e) => setTopN(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                />
              </Field>
              <Field label="Custom separator" hint="optional · plain text or /regex/">
                <input
                  className={inputCls + " font-mono text-[12.5px]"}
                  placeholder="e.g. =====  or  /-{5,}/"
                  value={sep}
                  onChange={(e) => setSep(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-[15px] font-bold tracking-tight">Merged CVs file</h3>
              <div className="flex flex-wrap gap-2">
                <Btn
                  variant="gold"
                  size="sm"
                  onClick={() => window.open("https://onefileapp.com", "_blank", "noopener,noreferrer")}
                  title="Open onefileapp.com in a new tab to merge your CVs into one .txt"
                >
                  <IconExternal className="h-3.5 w-3.5" /> onefileapp.com
                </Btn>
                <Btn variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <IconUpload className="h-3.5 w-3.5" /> Upload .txt
                </Btn>
                <Btn variant="ghost" size="sm" onClick={loadDemo}>
                  <IconSpark className="h-3.5 w-3.5 text-gold-600" /> Demo data
                </Btn>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".txt,.text,.md,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            <div
              className="group relative mb-3 cursor-pointer rounded-lg border-2 border-dashed border-line2 bg-white/60 px-4 py-3.5 transition-colors hover:border-pine-400 hover:bg-pine-50/60"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFile(e.dataTransfer.files?.[0] ?? null);
              }}
            >
              <div className="flex items-center gap-3">
                <IconUpload className="h-5 w-5 text-ink3 transition-colors group-hover:text-pine-600" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink2">
                    {fileName || "Drop your onefileapp.com merged .txt here"}
                  </p>
                  <p className="text-[12px] text-ink3">Headers like “===== Name_CV.pdf =====” are detected automatically.</p>
                </div>
              </div>
            </div>
            <textarea
              className={areaCls + " min-h-[220px] font-mono text-[12px] leading-relaxed"}
              placeholder={"…or paste the merged CV text here. Each CV block should start with its file-name header line."}
              value={cvText}
              onChange={(e) => {
                setCvText(e.target.value);
                setFileName("");
              }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-pine-700 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                {split.blocks.length} CV{split.blocks.length === 1 ? "" : "s"} detected
              </span>
              <span className="font-mono text-[11px] text-ink3">({split.method})</span>
              {split.blocks.slice(0, 6).map((b, i) => (
                <span key={i} className="max-w-[180px] truncate rounded-md border border-line bg-white px-2 py-0.5 text-[11px] text-ink2">
                  {b.name}
                </span>
              ))}
              {split.blocks.length > 6 && (
                <span className="rounded-md border border-line bg-white px-2 py-0.5 font-mono text-[11px] text-ink3">+{split.blocks.length - 6} more</span>
              )}
            </div>
          </Card>
        </div>

        {/* -------- pipeline panel -------- */}
        <div className="xl:col-span-2">
          <Card className="sticky top-[86px] overflow-hidden">
            <div className="border-b border-line bg-pine-900 px-5 py-4 text-pine-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <IconScan className="h-5 w-5 text-gold-400" />
                  <h3 className="font-display text-[15px] font-bold tracking-tight text-white">Screening pipeline</h3>
                </div>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-pine-200">
                  {settings.model.split("/").pop()?.slice(0, 18) ?? "groq"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/5 px-3 py-2">
                  <p className="font-display text-xl font-bold text-white">{split.blocks.length}</p>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-pine-200">CVs found</p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-2">
                  <p className="font-display text-xl font-bold text-white">{cvText ? makeBatches(split.blocks).length : 0}</p>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-pine-200">AI batches</p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-2">
                  <p className="font-display text-xl font-bold text-gold-400">{topN}</p>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-pine-200">Top picks</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 px-5 py-4">
              {[
                { label: "Detect & split CV blocks", state: split.blocks.length > 0 ? "done" : "wait" },
                {
                  label: phase.kind === "screen" ? `Screening — batch ${Math.min(phase.batch + 1, phase.batches)} of ${phase.batches}` : "AI screens every CV against the JD",
                  state: phase.kind === "screen" ? "busy" : results ? "done" : "wait",
                },
                { label: phase.kind === "rank" ? "Ranking & writing fit notes…" : "Rank, shortlist & finalize", state: phase.kind === "rank" ? "busy" : results ? "done" : "wait" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                      s.state === "done"
                        ? "border-onboarded/40 bg-onboarded/10 text-onboarded"
                        : s.state === "busy"
                        ? "border-gold-500/50 bg-gold-100 text-gold-600"
                        : "border-line2 bg-white text-ink3"
                    }`}
                  >
                    {s.state === "done" ? <IconCheck className="h-3.5 w-3.5" /> : s.state === "busy" ? <Spinner className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={`text-[12.5px] font-medium ${s.state === "wait" ? "text-ink3" : "text-ink"}`}>{s.label}</span>
                </div>
              ))}

              {phase.kind === "screen" && (
                <div className="pt-1">
                  <Bar pct={((phase.batch + 0.4) / Math.max(1, phase.batches)) * 100} />
                  <p className="mt-1.5 font-mono text-[11px] text-ink3">
                    {phase.screened} candidate summaries extracted · free tier may pause ~30s between batches
                  </p>
                </div>
              )}
              {phase.kind === "rank" && (
                <div className="scanbar h-2 w-full overflow-hidden rounded-full bg-pine-100">
                  <span />
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-cancel/30 bg-cancel/5 px-3 py-2.5 text-[12.5px] font-medium text-cancel">
                  <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {running ? (
                  <Btn variant="danger" className="flex-1" onClick={() => (cancelRef.current = true)}>
                    <IconX className="h-4 w-4" /> Cancel run
                  </Btn>
                ) : results ? (
                  <>
                    <Btn className="flex-1" onClick={run}>
                      <IconRefresh className="h-4 w-4" /> Re-run
                    </Btn>
                    <Btn
                      variant="outline"
                      onClick={() => {
                        setResults(null);
                        setPhase({ kind: "idle" });
                      }}
                    >
                      Clear
                    </Btn>
                  </>
                ) : (
                  <Btn size="lg" className="flex-1" onClick={run} disabled={!split.blocks.length || !jd.trim()}>
                    <IconSpark className="h-4 w-4 text-gold-200" /> Run AI screening
                  </Btn>
                )}
              </div>
              {!results && !running && (
                <p className="text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink3">
                  two-pass: batch screen → comparative rank
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* -------- results -------- */}
      {results && (
        <Card className="anim-rise overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-3">
              <IconTable className="h-5 w-5 text-pine-600" />
              <div>
                <h3 className="font-display text-[15px] font-bold tracking-tight">
                  Top {results.length} candidates
                  <span className="ml-2 font-mono text-[11px] font-medium text-ink3">
                    avg match {Math.round(results.reduce((a, c) => a + c.score, 0) / Math.max(1, results.length))}/100
                  </span>
                </h3>
              </div>
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" size="sm" onClick={copyMd}>
                <IconCopy className="h-3.5 w-3.5" /> Copy table
              </Btn>
              <Btn variant="gold" size="sm" onClick={exportCsv}>
                <IconDownload className="h-3.5 w-3.5" /> Export CSV
              </Btn>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-pine-50/70 font-mono text-[10px] uppercase tracking-[0.12em] text-ink3">
                  <th className="px-3 py-2.5">Rank</th>
                  <th className="px-3 py-2.5">CV name</th>
                  <th className="px-3 py-2.5">Candidate</th>
                  <th className="px-3 py-2.5">Current / last title</th>
                  <th className="px-3 py-2.5">Current / last org</th>
                  <th className="px-3 py-2.5">Relevant exp.</th>
                  <th className="px-3 py-2.5">Qualifications</th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Phone</th>
                  <th className="w-[26%] px-3 py-2.5">Why should be considered?</th>
                </tr>
              </thead>
              <tbody>
                {results.map((c, i) => (
                  <tr key={i} className={`border-b border-line/70 transition-colors hover:bg-pine-50/60 ${i % 2 ? "bg-white/50" : ""}`}>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-col items-start gap-1.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-lg font-display text-[13px] font-bold ${
                            i < 3 ? "bg-gold-500 text-pine-950" : "bg-pine-100 text-pine-700"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-semibold text-ink2">{c.score}</span>
                          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-line">
                            <span className={`block h-full rounded-full ${scoreTone(c.score)}`} style={{ width: `${c.score}%` }} />
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2.5 align-top font-mono text-[11.5px] text-ink2" title={c.cvName}>
                      {c.cvName}
                    </td>
                    <td className="px-3 py-2.5 align-top font-semibold text-ink">{c.candidateName}</td>
                    <td className="px-3 py-2.5 align-top text-ink2">{c.currentTitle}</td>
                    <td className="px-3 py-2.5 align-top text-ink2">{c.currentOrg}</td>
                    <td className="px-3 py-2.5 align-top text-ink2">{c.relevantExp}</td>
                    <td className="max-w-[200px] px-3 py-2.5 align-top text-ink2">{c.qualifications}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-[11.5px] text-pine-700">{c.email}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-[11.5px] text-ink2">{c.phone}</td>
                    <td className="px-3 py-2.5 align-top leading-relaxed text-ink2">{c.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line bg-pine-50/40 px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink3">
            scores are AI estimates — always verify references & documents before interviews
          </p>
        </Card>
      )}

      <FileGrabModal
        open={!!grab}
        onClose={() => setGrab(null)}
        filename={grab?.filename ?? ""}
        content={grab?.content ?? ""}
        mime={grab?.mime ?? "text/plain"}
      />
    </div>
  );
}
