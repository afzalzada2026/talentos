import type { CvBlock } from "./types";

/**
 * Splits one merged .txt file (e.g. produced by onefileapp.com) into individual CVs.
 * Detects header lines such as:
 *   ===== Adeel_Khan_CV.pdf =====
 *   ----- resume_sarah.docx -----
 *   File: bilal_cv.txt
 *   [===] Nadia_Hussain_CV.pdf [===]
 *   -----\nImran Sheikh\n-----
 * Falls back to a user-supplied separator (plain text or /regex/).
 */

const PURE_RULE = /^[=\-#*~_—–]{4,}[ \t]*$/;

const FILE_LINE =
  /^[ \t]*[=\-#*~_—–[\]]{0,10}[ \t]*(?:file(?:name)?\s*[:\-]\s*)?([^=\n]+?\.(?:pdf|docx?|txt|rtf|odt|pages))(?:[ \t]*\([^)]*\))?[ \t]*[=\-#*~_—–[\]]{0,10}[ \t]*$/i;

const RULED_NAME =
  /^[ \t]*(?:={3,}|-{3,}|#{3,}|\*{3,}|~{3,}|_{3,})[ \t]+([^=\-#*~_\n][^\n]{1,110}?)[ \t]+(?:={3,}|-{3,}|#{3,}|\*{3,}|~{3,}|_{3,})[ \t]*$/;

function cleanName(s: string): string {
  return s
    .replace(/^[=\-#*~_—–[\]\s]+/, "")
    .replace(/[=\-#*~_—–[\]\s]+$/, "")
    .replace(/^file(name)?\s*[:\-]\s*/i, "")
    .trim();
}

export interface SplitResult {
  blocks: CvBlock[];
  method: string;
}

export function splitCvs(text: string, custom?: string): SplitResult {
  const norm = text.replace(/\r\n?/g, "\n");
  if (!norm.trim()) return { blocks: [], method: "empty" };

  // 1) custom separator (plain string or /regex/flags)
  if (custom && custom.trim()) {
    let parts: string[] = [norm];
    const c = custom.trim();
    const rx = c.match(/^\/(.+)\/([gimsuy]*)$/);
    if (rx) {
      try {
        parts = norm.split(new RegExp(rx[1], rx[2]));
      } catch {
        parts = [norm];
      }
    } else {
      parts = norm.split(c);
    }
    const blocks = parts
      .map((p, i) => ({ name: `Candidate ${i + 1}`, text: p.trim() }))
      .filter((b) => b.text.length > 40);
    return { blocks, method: blocks.length > 1 ? "custom separator" : "single block" };
  }

  // 2) auto-detect header lines
  const lines = norm.split("\n");
  const cuts: { idx: number; name: string; consumed: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.length > 180) continue;

    const fm = ln.match(FILE_LINE);
    if (fm) {
      const name = cleanName(ln);
      if (name) {
        cuts.push({ idx: i, name, consumed: 1 });
        continue;
      }
    }

    const rm = ln.match(RULED_NAME);
    if (rm) {
      const name = cleanName(rm[1]);
      if (name && name.length <= 120) {
        cuts.push({ idx: i, name, consumed: 1 });
        continue;
      }
    }

    // name sandwiched between two rule lines
    if (PURE_RULE.test(ln) && i + 2 < lines.length) {
      const mid = lines[i + 1].trim();
      if (mid && mid.length <= 90 && PURE_RULE.test(lines[i + 2])) {
        cuts.push({ idx: i, name: cleanName(mid) || `Candidate ${cuts.length + 1}`, consumed: 3 });
        i += 2;
      }
    }
  }

  if (cuts.length === 0) {
    return { blocks: [{ name: "Candidate 1", text: norm.trim() }], method: "single block" };
  }

  const blocks: CvBlock[] = [];
  for (let k = 0; k < cuts.length; k++) {
    const start = cuts[k].idx + cuts[k].consumed;
    const end = k + 1 < cuts.length ? cuts[k + 1].idx : lines.length;
    const body = lines.slice(start, end).join("\n").trim();
    if (body.length > 30) blocks.push({ name: cuts[k].name, text: body });
  }

  return { blocks, method: cuts.length === 1 ? "single block" : "auto-detected headers" };
}
