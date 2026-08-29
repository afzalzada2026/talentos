import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { IconAlert, IconCheck, IconCopy, IconDownload, IconInfo, IconX } from "./icons";
import { copyRichText, copyText, makeBlobUrl } from "../lib/download";

/* ---------------- toasts ---------------- */

type Kind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: Kind;
  msg: string;
}

const ToastCtx = createContext<(kind: Kind, msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

const TOAST_STYLE: Record<Kind, { ring: string; icon: ReactNode }> = {
  success: { ring: "border-onboarded/40", icon: <IconCheck className="h-4 w-4 text-onboarded" /> },
  error: { ring: "border-cancel/40", icon: <IconAlert className="h-4 w-4 text-cancel" /> },
  info: { ring: "border-open/40", icon: <IconInfo className="h-4 w-4 text-open" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);
  const idRef = useRef(1);
  const push = (kind: Kind, msg: string) => {
    const id = idRef.current++;
    setList((l) => [...l.slice(-3), { id, kind, msg }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4200);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[80] flex w-[330px] max-w-[calc(100vw-40px)] flex-col gap-2">
        {list.map((t) => (
          <div
            key={t.id}
            className={`anim-toast flex items-start gap-2.5 rounded-lg border bg-white px-3.5 py-3 text-[13px] font-medium text-ink shadow-[0_10px_30px_rgba(11,36,27,0.16)] ${TOAST_STYLE[t.kind].ring}`}
          >
            <span className="mt-0.5 shrink-0">{TOAST_STYLE[t.kind].icon}</span>
            <span className="leading-snug">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- buttons ---------------- */

type Variant = "primary" | "gold" | "outline" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const V: Record<Variant, string> = {
  primary: "bg-pine-700 text-white hover:bg-pine-600 shadow-sm",
  gold: "bg-gold-500 text-pine-950 hover:bg-gold-400 shadow-sm",
  outline: "border border-line2 bg-white text-ink2 hover:border-pine-400 hover:text-pine-700",
  ghost: "text-ink2 hover:bg-pine-50 hover:text-pine-800",
  danger: "border border-cancel/30 text-cancel hover:bg-cancel/10",
  dark: "bg-pine-900 text-pine-100 hover:bg-pine-800",
};
const SZ: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-[12px] rounded-md gap-1.5",
  md: "px-3.5 py-2 text-[13px] rounded-lg gap-2",
  lg: "px-5 py-2.5 text-sm rounded-lg gap-2",
};

export function Btn({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex select-none items-center justify-center font-semibold transition-all duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 ${V[variant]} ${SZ[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- primitives ---------------- */

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-line bg-panel shadow-[0_1px_2px_rgba(23,37,31,0.05)] ${className}`}>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink3">
        {label}
        {hint ? <em className="font-sans text-[11px] normal-case tracking-normal text-ink3/80 not-italic">{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line2 bg-white px-3 py-2 text-[13.5px] text-ink placeholder:text-ink3/60 outline-none transition-colors focus:border-pine-500 focus:ring-2 focus:ring-pine-500/15";
export const areaCls = inputCls + " resize-y leading-relaxed";

/* ---------------- modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="anim-fade absolute inset-0 bg-pine-950/45" onClick={onClose} />
      <div className={`anim-pop relative w-full ${width} max-h-[88vh] overflow-y-auto rounded-xl border border-line bg-panel shadow-2xl`}>
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-panel/95 px-5 py-3.5 backdrop-blur">
          <h3 className="font-display text-[15px] font-semibold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink3 transition-colors hover:bg-pine-50 hover:text-ink"
            aria-label="Close"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- grab-your-file fallback ---------------- */

/**
 * Shown when the browser (usually a preview iframe) blocks a direct download.
 * Offers a direct download link (user-initiated), copy-to-clipboard, and an
 * optional rich-text "Copy for Word".
 */
export function FileGrabModal({
  open,
  onClose,
  filename,
  content,
  mime,
  richHtml,
}: {
  open: boolean;
  onClose: () => void;
  filename: string;
  content: string;
  mime: string;
  richHtml?: string;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => (open ? makeBlobUrl(content, mime) : ""), [open, content, mime]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Save your file" width="max-w-2xl">
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-gold-400/50 bg-gold-100/60 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink2">
          <IconInfo className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
          <p>
            This preview environment blocks automatic file saves, so pick one of these instead. When you open the
            published site in a normal browser tab, downloads will just work.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-pine-900 px-2.5 py-1 font-mono text-[11.5px] font-semibold text-pine-100">{filename}</span>
          <span className="font-mono text-[11px] text-ink3">{(content.length / 1024).toFixed(1)} KB</span>
          <div className="ml-auto flex gap-2">
            {richHtml && (
              <Btn
                variant="gold"
                size="sm"
                onClick={async () => {
                  (await copyRichText(richHtml, content))
                    ? toast("success", "Copied with formatting — paste into Word (Ctrl+V).")
                    : toast("error", "Clipboard blocked here — use the download link.");
                }}
              >
                <IconCopy className="h-3.5 w-3.5" /> Copy for Word
              </Btn>
            )}
            <Btn
              variant="outline"
              size="sm"
              onClick={async () => {
                (await copyText(content)) ? (setCopied(true), toast("success", "Content copied to clipboard.")) : toast("error", "Clipboard is blocked in this context.");
              }}
            >
              {copied ? <IconCheck className="h-3.5 w-3.5 text-onboarded" /> : <IconCopy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy content"}
            </Btn>
          </div>
        </div>

        {url && (
          <a
            href={url}
            download={filename}
            className="flex items-center justify-center gap-2 rounded-lg border border-pine-500/40 bg-pine-50 px-4 py-2.5 text-[13px] font-semibold text-pine-700 transition-colors hover:bg-pine-100"
          >
            <IconDownload className="h-4 w-4" />
            Download {filename} directly
            <span className="font-mono text-[10.5px] font-medium text-ink3">(or right-click → “Save link as…”)</span>
          </a>
        )}

        <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-white p-4 font-mono text-[11.5px] leading-relaxed text-ink2">
          {content}
        </pre>
      </div>
    </Modal>
  );
}

/* ---------------- recruitment statuses ---------------- */

export const STATUSES = ["Open", "Shortlisting", "Interviews", "Offer", "On Hold", "Cancelled"] as const;
export type RecStatus = (typeof STATUSES)[number];

export const STATUS_META: Record<RecStatus, { cls: string; dot: string; hex: string }> = {
  Open: { cls: "bg-open/12 text-open ring-open/30", dot: "bg-open", hex: "#3d7ea6" },
  Shortlisting: { cls: "bg-short/12 text-short ring-short/30", dot: "bg-short", hex: "#c07f22" },
  Interviews: { cls: "bg-interview/12 text-interview ring-interview/30", dot: "bg-interview", hex: "#8a5a9e" },
  Offer: { cls: "bg-offer/12 text-offer ring-offer/30", dot: "bg-offer", hex: "#2f8f83" },
  "On Hold": { cls: "bg-hold/12 text-hold ring-hold/30", dot: "bg-hold", hex: "#78857a" },
  Cancelled: { cls: "bg-cancel/12 text-cancel ring-cancel/30", dot: "bg-cancel", hex: "#b4553f" },
};
export const ONBOARDED_HEX = "#2e7d4f";

export function StatusPill({ status }: { status: RecStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {status}
    </span>
  );
}

/* ---------------- animated number ---------------- */

export function AnimatedNumber({ value, className = "" }: { value: number; className?: string }) {
  const [disp, setDisp] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) {
      setDisp(to);
      return;
    }
    const t0 = performance.now();
    const dur = 700;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(from + (to - from) * e));
      if (p < 1) raf = requestAnimationFrame(step);
      else prev.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{disp}</span>;
}

/* ---------------- spinner & progress ---------------- */

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Bar({ pct }: { pct: number }) {
  return (
    <div className="scanbar h-2 w-full overflow-hidden rounded-full bg-pine-100">
      <div
        className="h-full rounded-full bg-pine-600 transition-all duration-500"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
      <span />
    </div>
  );
}

/* ---------------- empty state ---------------- */

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-line2 bg-white text-ink3">
        {icon}
      </div>
      <h4 className="font-display text-[15px] font-semibold text-ink">{title}</h4>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink3">{desc}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
