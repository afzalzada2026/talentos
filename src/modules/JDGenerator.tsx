import { useRef, useState } from "react";
import type { JDLibItem, Settings } from "../lib/types";
import { LEVELS } from "../lib/types";
import { groqChat } from "../lib/groq";
import { copyRichText, copyText, docFileContent, inFrame, mdToHtml, printPdf, smartDownload, slug } from "../lib/download";
import { extractDocxText } from "../lib/docx";
import { DEFAULT_JD_TEMPLATE } from "../lib/demo";
import { useLocalStorage } from "../lib/store";
import { Btn, Card, Field, FileGrabModal, Modal, Spinner, areaCls, inputCls, useToast } from "../components/ui";
import {
  IconChevron,
  IconCopy,
  IconDoc,
  IconDownload,
  IconEye,
  IconInbox,
  IconPrint,
  IconSpark,
  IconTrash,
  IconUpload,
  IconWand,
} from "../components/icons";

const JD_SYS = `You are an HR documentation specialist. You will receive a company's official JD format (a sample) and the details of a new position. Produce a complete, ready-to-publish job description that EXACTLY mirrors the sample's structure: same headings, same section order, same numbering and bullet style, same labeling and tone. Only the content changes to fit the new position — never add, remove or rename sections. Fill every field (reports-to, location, employment type, etc.) with sensible, realistic content consistent with the position, its level and division. Be comprehensive: 6-10 concrete responsibilities, precise experience and education requirements, technical skills, behavioral competencies, and KPIs if the format includes them. Output clean Markdown only — no commentary before or after.`;

interface Result {
  md: string;
  title: string;
  division: string;
  level: string;
  at: string;
}

export default function JDGenerator({ settings, onOpenSettings }: { settings: Settings; onOpenSettings: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [division, setDivision] = useState("");
  const [level, setLevel] = useState<string>(LEVELS[3]);
  const [customLevel, setCustomLevel] = useState("");
  const [extra, setExtra] = useState("");
  const [template, setTemplate] = useLocalStorage<string>("talentos.jdTemplate", DEFAULT_JD_TEMPLATE);
  const [showTemplate, setShowTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [library, setLibrary] = useLocalStorage<JDLibItem[]>("talentos.jdLibrary", []);
  const [viewOpen, setViewOpen] = useState(false);
  const tplFileRef = useRef<HTMLInputElement>(null);
  const [grabState, setGrabState] = useState<{ filename: string; content: string; mime: string; richHtml?: string } | null>(null);

  const effLevel = level === "Custom…" ? customLevel.trim() || "—" : level;

  /** Reads a company JD format from a file — .docx is parsed locally, .txt/.md read as-is. */
  async function onTemplateFile(f: File | null) {
    if (!f) return;
    const name = f.name.toLowerCase();
    try {
      if (name.endsWith(".docx")) {
        const text = await extractDocxText(await f.arrayBuffer());
        setTemplate(text);
        setShowTemplate(true);
        toast("success", `Read “${f.name}” locally — headings & bullets preserved (${text.length.toLocaleString()} chars).`);
      } else if (name.endsWith(".doc")) {
        toast("error", "Legacy .doc files can't be read in-browser. Save it as .docx in Word, or paste the text.");
      } else {
        const text = await f.text();
        if (!text.trim()) throw new Error("That file is empty.");
        setTemplate(text);
        setShowTemplate(true);
        toast("success", `Loaded “${f.name}” as the company JD format.`);
      }
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  /** Downloads a text file — with an in-app grab dialog when a sandboxed preview blocks saves. */
  function grab(filename: string, content: string, mime: string, label: string, richHtml?: string) {
    if (smartDownload(filename, content, mime)) {
      toast("success", label);
    } else {
      setGrabState({ filename, content, mime, richHtml });
      toast("info", "Direct save is blocked in this preview — use the dialog to grab the file.");
    }
  }

  function exportWord() {
    if (!result) return;
    grab(`${fileBase()}.doc`, "\ufeff" + docFileContent(result.md, result.title), "application/msword", "Word (.doc) downloaded.", mdToHtml(result.md));
  }
  function exportMd() {
    if (!result) return;
    grab(`${fileBase()}.md`, result.md, "text/markdown", "Markdown downloaded.");
  }
  function exportTxt() {
    if (!result) return;
    grab(`${fileBase()}.txt`, result.md, "text/plain", "Plain text downloaded.");
  }
  function exportPdf() {
    if (!result) return;
    if (inFrame()) {
      setViewOpen(true);
      toast("info", "Printing is blocked in this preview — use “Copy for Word” in the viewer, then Save As PDF from Word.");
    } else {
      printPdf(result.md, result.title);
      toast("success", "Print dialog opened — choose “Save as PDF” as the destination.");
    }
  }

  async function copyForWord() {
    if (!result) return;
    (await copyRichText(mdToHtml(result.md), result.md))
      ? toast("success", "Formatted JD copied — paste it into a blank Word document (Ctrl+V).")
      : toast("error", "Clipboard is blocked here — use the Word download instead.");
  }

  async function generate() {
    setError("");
    if (!settings.apiKey.trim()) {
      onOpenSettings();
      toast("error", "Add your free Groq API key first.");
      return;
    }
    if (!title.trim()) {
      toast("error", "Enter the position title.");
      return;
    }
    if (!division.trim()) {
      toast("error", "Enter the division or department.");
      return;
    }
    if (!template.trim()) {
      toast("error", "Paste your company JD format first (or restore the built-in sample).");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const md = await groqChat(
        settings,
        JD_SYS,
        `SAMPLE COMPANY JD FORMAT:\n"""\n${template}\n"""\n\nNEW POSITION DETAILS:\nPosition Title: ${title.trim()}\nDivision / Department: ${division.trim()}\nJob Level: ${effLevel}\nAdditional instructions: ${extra.trim() || "None"}\n\nGenerate the job description now, in Markdown.`,
        { maxTokens: 8192, reasoning: "medium" }
      );
      setResult({ md: md.trim(), title: title.trim(), division: division.trim(), level: effLevel, at: new Date().toISOString() });
      toast("success", "JD generated in your company format.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  const fileBase = () => `${slug(result?.title ?? "job")}-jd`;

  function saveToLibrary() {
    if (!result) return;
    setLibrary((l) => [
      { id: Date.now().toString(36), title: result.title, division: result.division, level: result.level, md: result.md, at: result.at },
      ...l,
    ]);
    toast("success", "Saved to your JD library.");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* -------- form -------- */}
      <div className="space-y-5 lg:col-span-2">
        <Card className="p-5">
          <h3 className="mb-4 font-display text-[15px] font-bold tracking-tight">New position</h3>
          <div className="space-y-4">
            <Field label="Position title *">
              <input className={inputCls} placeholder="e.g. Supply Chain Manager" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Division / department *">
                <input className={inputCls} placeholder="e.g. Operations" value={division} onChange={(e) => setDivision(e.target.value)} />
              </Field>
              <Field label="Job level">
                <select className={inputCls + " cursor-pointer"} value={level} onChange={(e) => setLevel(e.target.value)}>
                  {LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                  <option>Custom…</option>
                </select>
              </Field>
            </div>
            {level === "Custom…" && (
              <Field label="Custom level">
                <input className={inputCls} placeholder="e.g. Deputy Head — Grade 7" value={customLevel} onChange={(e) => setCustomLevel(e.target.value)} />
              </Field>
            )}
            <Field label="Extra instructions" hint="optional">
              <textarea
                className={areaCls + " min-h-[70px]"}
                placeholder="e.g. hybrid work, must know SAP, team of 12, night-shift allowance…"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
            </Field>
            <Btn size="lg" className="w-full" onClick={generate} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <IconWand className="h-4 w-4 text-gold-200" />}
              {busy ? "Writing in company format…" : "Generate JD with AI"}
            </Btn>
            {error && <p className="rounded-lg border border-cancel/30 bg-cancel/5 px-3 py-2 text-[12.5px] font-medium text-cancel">{error}</p>}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <button
            className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-pine-50/60"
            onClick={() => setShowTemplate((v) => !v)}
          >
            <div>
              <h3 className="font-display text-[15px] font-bold tracking-tight">Company JD format</h3>
              <p className="text-[12px] text-ink3">Upload your sample JD (.docx) or paste it — the AI mirrors its exact structure.</p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5">
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  tplFileRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    tplFileRef.current?.click();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-line2 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink2 transition-all hover:border-pine-400 hover:text-pine-700 active:translate-y-px"
              >
                <IconUpload className="h-3.5 w-3.5" /> Upload .docx
              </span>
              <IconChevron className={`h-4 w-4 text-ink3 transition-transform duration-200 ${showTemplate ? "rotate-180" : ""}`} />
            </span>
          </button>
          <input
            ref={tplFileRef}
            type="file"
            accept=".docx,.doc,.txt,.md,.text"
            className="hidden"
            onChange={(e) => {
              onTemplateFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          {showTemplate && (
            <div className="anim-fade border-t border-line p-5 pt-4">
              <textarea
                className={areaCls + " min-h-[260px] font-mono text-[12px]"}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder="Paste one of your existing JDs here…"
              />
              <div className="mt-2.5 flex justify-end">
                <Btn variant="ghost" size="sm" onClick={() => setTemplate(DEFAULT_JD_TEMPLATE)}>
                  Restore built-in sample
                </Btn>
              </div>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="flex items-center gap-2">
              <IconInbox className="h-4 w-4 text-pine-600" />
              <h3 className="font-display text-[14px] font-bold tracking-tight">JD library</h3>
            </div>
            <span className="rounded-md bg-pine-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-pine-700">{library.length}</span>
          </div>
          {library.length === 0 ? (
            <p className="px-5 py-6 text-center text-[12.5px] text-ink3">Generated JDs you save will appear here for reuse.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-line/70 overflow-y-auto">
              {library.map((j) => (
                <li key={j.id} className="group flex items-center justify-between gap-2 px-5 py-2.5 transition-colors hover:bg-pine-50/50">
                  <button
                    className="min-w-0 text-left"
                    onClick={() => {
                      setResult({ md: j.md, title: j.title, division: j.division, level: j.level, at: j.at });
                      setTitle(j.title);
                      setDivision(j.division);
                      toast("info", `Loaded “${j.title}” from library.`);
                    }}
                  >
                    <p className="truncate text-[13px] font-semibold text-ink group-hover:text-pine-700">{j.title}</p>
                    <p className="font-mono text-[10.5px] text-ink3">
                      {j.division} · {j.level} · {new Date(j.at).toLocaleDateString()}
                    </p>
                  </button>
                  <button
                    className="rounded-md p-1.5 text-ink3 opacity-0 transition-all hover:bg-cancel/10 hover:text-cancel group-hover:opacity-100"
                    onClick={() => {
                      setLibrary((l) => l.filter((x) => x.id !== j.id));
                      toast("info", "Removed from library.");
                    }}
                    aria-label={`Delete ${j.title}`}
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* -------- preview -------- */}
      <div className="lg:col-span-3">
        <Card className="sticky top-[86px] flex max-h-[calc(100vh-120px)] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <IconDoc className="h-5 w-5 text-pine-600" />
              <h3 className="font-display text-[15px] font-bold tracking-tight">Preview</h3>
              {result && (
                <span className="font-mono text-[11px] text-ink3">
                  {result.title} · {result.division} · {result.level}
                </span>
              )}
            </div>
            {result && (
              <div className="flex flex-wrap gap-1.5">
                <Btn variant="primary" size="sm" onClick={() => setViewOpen(true)}>
                  <IconEye className="h-3.5 w-3.5" /> Open
                </Btn>
                <Btn variant="gold" size="sm" onClick={exportWord}>
                  <IconDownload className="h-3.5 w-3.5" /> Word
                </Btn>
                <Btn variant="outline" size="sm" onClick={exportPdf}>
                  <IconPrint className="h-3.5 w-3.5" /> PDF
                </Btn>
                <Btn variant="outline" size="sm" onClick={exportMd}>
                  .md
                </Btn>
                <Btn variant="outline" size="sm" onClick={exportTxt}>
                  .txt
                </Btn>
                <Btn variant="outline" size="sm" onClick={async () => ((await copyText(result.md)) ? toast("success", "Markdown copied.") : toast("error", "Copy failed."))}>
                  <IconCopy className="h-3.5 w-3.5" />
                </Btn>
                <Btn variant="outline" size="sm" onClick={saveToLibrary}>
                  Save
                </Btn>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-white/70 px-6 py-6 sm:px-8">
            {busy ? (
              <div className="space-y-4 py-4">
                <div className="shimmer h-8 w-2/3 rounded-lg" />
                <div className="shimmer h-4 w-1/2 rounded-md" />
                <div className="space-y-2 pt-4">
                  {[92, 100, 96, 78, 88, 100, 84, 60].map((w, i) => (
                    <div key={i} className="shimmer h-3.5 rounded-md" style={{ width: `${w}%` }} />
                  ))}
                </div>
                <p className="flex items-center gap-2 pt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink3">
                  <Spinner className="h-3.5 w-3.5" /> mirroring your company format…
                </p>
              </div>
            ) : result ? (
              <article className="md anim-rise mx-auto max-w-[720px]" dangerouslySetInnerHTML={{ __html: mdToHtml(result.md) }} />
            ) : (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-line2 bg-white text-ink3">
                  <IconSpark className="h-6 w-6 text-gold-500" />
                </div>
                <h4 className="font-display text-[15px] font-semibold">Your JD will appear here</h4>
                <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-ink3">
                  Fill the position details, keep your company format below, and generate. Download as Word, PDF, Markdown or plain text.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* -------- document viewer (always works, even where downloads are blocked) -------- */}
      <Modal open={viewOpen && !!result} onClose={() => setViewOpen(false)} title={result?.title ?? "JD document"} width="max-w-3xl">
        {result && (
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Btn variant="gold" size="sm" onClick={copyForWord}>
                <IconCopy className="h-3.5 w-3.5" /> Copy for Word
              </Btn>
              <Btn variant="outline" size="sm" onClick={async () => ((await copyText(result.md)) ? toast("success", "Markdown copied.") : toast("error", "Copy failed."))}>
                Copy Markdown
              </Btn>
              <Btn variant="outline" size="sm" onClick={exportWord}>
                <IconDownload className="h-3.5 w-3.5" /> Word (.doc)
              </Btn>
              <Btn variant="outline" size="sm" onClick={exportPdf}>
                <IconPrint className="h-3.5 w-3.5" /> Print / PDF
              </Btn>
            </div>
            <div className="max-h-[56vh] overflow-y-auto rounded-xl border border-line bg-white px-6 py-6 sm:px-8">
              <article className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(result.md) }} />
            </div>
            <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink3">
              “Copy for Word” puts the formatted JD on your clipboard — paste it into a blank document with Ctrl+V
            </p>
          </div>
        )}
      </Modal>

      <FileGrabModal
        open={!!grabState}
        onClose={() => setGrabState(null)}
        filename={grabState?.filename ?? ""}
        content={grabState?.content ?? ""}
        mime={grabState?.mime ?? "text/plain"}
        richHtml={grabState?.richHtml}
      />
    </div>
  );
}
