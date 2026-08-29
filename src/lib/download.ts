/* Export helpers: Markdown → HTML, Word (.doc), PDF (via print), CSV, TXT/MD, clipboard. */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** Compact Markdown → HTML (headings, lists, tables, quotes, hr, inline styles). */
export function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  let html = "";
  let list: "ul" | "ol" | null = null;
  let table = false;
  let tableHeaded = false;
  let para: string[] = [];

  const closeList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };
  const closeTable = () => {
    if (table) {
      html += "</tbody></table>";
      table = false;
      tableHeaded = false;
    }
  };
  const flushPara = () => {
    if (para.length) {
      closeList();
      closeTable();
      html += `<p>${inline(para.join(" "))}</p>`;
      para = [];
    }
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) {
      flushPara();
      closeList();
      closeTable();
      continue;
    }
    if (/^```/.test(t)) {
      flushPara();
      closeList();
      closeTable();
      continue;
    }
    const h = t.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushPara();
      closeList();
      closeTable();
      const l = h[1].length;
      html += `<h${l}>${inline(h[2])}</h${l}>`;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushPara();
      closeList();
      closeTable();
      html += "<hr/>";
      continue;
    }
    if (t.startsWith("|") && t.endsWith("|")) {
      flushPara();
      closeList();
      const cells = t.slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (!table) {
        html += "<table><tbody>";
        table = true;
      }
      const tag = !tableHeaded ? "th" : "td";
      tableHeaded = true;
      html += `<tr>${cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("")}</tr>`;
      continue;
    }
    const q = t.match(/^>\s?(.*)$/);
    if (q) {
      flushPara();
      closeList();
      closeTable();
      html += `<blockquote>${inline(q[1])}</blockquote>`;
      continue;
    }
    const ol = t.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      closeTable();
      if (list !== "ol") {
        closeList();
        html += "<ol>";
        list = "ol";
      }
      html += `<li>${inline(ol[1])}</li>`;
      continue;
    }
    const ul = t.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      flushPara();
      closeTable();
      if (list !== "ul") {
        closeList();
        html += "<ul>";
        list = "ul";
      }
      html += `<li>${inline(ul[1])}</li>`;
      continue;
    }
    closeList();
    closeTable();
    para.push(t);
  }
  flushPara();
  closeList();
  closeTable();
  return html;
}

/** True when the app runs inside an iframe (preview sandboxes may block downloads). */
export function inFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function makeBlobUrl(content: string, mime: string): string {
  return URL.createObjectURL(new Blob([content], { type: mime + ";charset=utf-8" }));
}

/**
 * Downloads a text file — returns true when delivered directly.
 * Returns false inside an iframe (preview sandboxes silently block
 * programmatic saves), so the caller can show the grab-your-file fallback.
 */
export function smartDownload(filename: string, content: string, mime: string): boolean {
  if (inFrame()) return false;
  downloadBlob(filename, new Blob([content], { type: mime + ";charset=utf-8" }));
  return true;
}

/** Copies formatted HTML + plain text to the clipboard — pastes straight into MS Word. */
export async function copyRichText(html: string, plain: string): Promise<boolean> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch {
    return copyText(plain);
  }
}

const DOC_STYLES = `body{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:11pt;color:#1c1c1c;line-height:1.5;margin:24px}
h1{font-size:17pt;margin:14pt 0 6pt}h2{font-size:13pt;border-bottom:1pt solid #999;padding-bottom:2pt;margin:13pt 0 5pt}
h3{font-size:11.5pt;margin:10pt 0 4pt}p{margin:5pt 0}ul,ol{margin:5pt 0 5pt 20pt}li{margin:2.5pt 0}
table{border-collapse:collapse;width:100%}th,td{border:1pt solid #999;padding:4pt 6pt;font-size:10.5pt}
hr{border:none;border-top:1pt solid #bbb;margin:12pt 0}blockquote{border-left:3pt solid #c98a2d;margin:8pt 0;padding:2pt 10pt;color:#444}`;

/** Full MS-Word-compatible HTML document for a Markdown source. */
export function docFileContent(md: string, title: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(
    title
  )}</title><style>${DOC_STYLES}</style></head><body>${mdToHtml(md)}</body></html>`;
}

export function saveAsDoc(md: string, filename: string, title: string) {
  downloadBlob(filename, new Blob(["\ufeff", docFileContent(md, title)], { type: "application/msword;charset=utf-8" }));
}

export function saveText(md: string, filename: string, mime: string) {
  downloadBlob(filename, new Blob([md], { type: mime + ";charset=utf-8" }));
}

export function printPdf(md: string, title: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${DOC_STYLES.replace(
      "margin:24px",
      "margin:32px"
    )}body{font-size:12px}h1{font-size:22px}h2{font-size:15px}h3{font-size:13px}</style></head><body>${mdToHtml(
      md
    )}</body></html>`
  );
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 2000);
  }, 80);
}

/** Serialises rows to a CSV string (Excel-safe: BOM handled by callers, quoting included). */
export function toCsv(rows: (string | number)[][]): string {
  const q = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(q).join(",")).join("\r\n");
}

export function exportCSV(filename: string, rows: (string | number)[][]) {
  downloadBlob(filename, new Blob(["\ufeff" + toCsv(rows)], { type: "text/csv;charset=utf-8" }));
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "document"
  );
}
