import JSZip from "jszip";

/**
 * Reads a .docx entirely in the browser (a .docx is a ZIP of XML).
 * Returns Markdown-ish text that preserves the document's structure:
 * headings become #/##, numbered/bulleted paragraphs become list items,
 * tabs and line breaks are kept — so an AI can mirror the format exactly.
 */
export async function extractDocxText(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("That file isn't a valid .docx document.");
  const xml = await docFile.async("string");

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Could not parse the document inside the .docx.");
  }

  const paras = Array.from(doc.getElementsByTagName("w:p"));
  const lines: string[] = [];

  for (const p of paras) {
    // Style → heading prefix
    let prefix = "";
    const pStyle = p.getElementsByTagName("w:pStyle")[0];
    const styleVal = pStyle?.getAttribute("w:val") ?? "";
    const hm = /heading\s*(\d)/i.exec(styleVal);
    if (hm) prefix = "#".repeat(Math.max(1, Math.min(4, Number(hm[1])))) + " ";
    else if (/^title$/i.test(styleVal)) prefix = "# ";
    else if (/subtitle/i.test(styleVal)) prefix = "### ";

    // Numbering → bullet
    const isBullet = !prefix && p.getElementsByTagName("w:numPr").length > 0;

    // Runs → text
    let text = "";
    for (const node of Array.from(p.childNodes)) {
      if (node.nodeName === "w:r") {
        for (const child of Array.from(node.childNodes)) {
          if (child.nodeName === "w:t") text += child.textContent ?? "";
          else if (child.nodeName === "w:tab") text += "\t";
          else if (child.nodeName === "w:br") text += "\n";
        }
      } else if (node.nodeName === "w:hyperlink") {
        text += node.textContent ?? "";
      }
    }

    lines.push((prefix + (isBullet ? "- " : "") + text).trimEnd());
  }

  const out = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!out) throw new Error("The .docx appears to contain no readable text (scanned/image-only files aren't supported).");
  return out;
}
