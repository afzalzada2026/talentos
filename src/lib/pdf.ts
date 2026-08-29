/** Extracts selectable text from a PDF entirely in the browser.
 *  pdf.js is loaded lazily so it never slows the initial app load. */
export async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  // Bundle the worker as an app asset so extraction works offline, with no CDN.
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const line = (tc.items as Array<{ str?: string }>)
      .map((it) => it.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) text += line + "\n";
  }
  const out = text.trim();
  if (!out) throw new Error("No selectable text in this PDF — scanned/image-only PDFs aren't supported. Paste the JD text instead.");
  return out;
}
