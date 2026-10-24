import { recipeSteps, type Recipe } from "./types";

/** Client-only: jsPDF is loaded on demand so it stays out of the main bundle. */
export async function exportRecipeToPdf(r: Recipe): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const margin = 20;
  const pageW = doc.internal.pageSize.getWidth();
  const lineHeight = 7;
  const maxW = pageW - margin * 2;
  const wrap = (text: string): string[] => doc.splitTextToSize(text, maxW);
  let y = 20;

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  const titleLines = wrap(r.title || "Untitled Recipe");
  doc.text(titleLines, margin, y);
  y += titleLines.length * lineHeight + 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const meta: string[] = [];
  if (r.total_time != null) meta.push(`Total time: ${r.total_time} minutes`);
  if (r.yields) meta.push("Yields: " + r.yields);
  if (r.host) meta.push("Source: " + r.host);
  if (meta.length) {
    doc.text(meta.join("  •  "), margin, y);
    y += lineHeight + 10;
  }
  if (r.source_url) {
    doc.setFont("helvetica", "bold");
    doc.text("Reference URL:", margin, y);
    y += lineHeight;
    doc.setFont("helvetica", "normal");
    const urlLines = wrap(r.source_url);
    doc.text(urlLines, margin, y);
    y += urlLines.length * lineHeight + 10;
  }

  const section = (heading: string, items: string[], gap: number) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(heading, margin, y);
    y += lineHeight + 4;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    for (const item of items) {
      const lines = wrap(item);
      if (y + lines.length * lineHeight > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, margin, y);
      y += lines.length * lineHeight + gap;
    }
  };

  section("Ingredients", (r.ingredients ?? []).map((i) => "• " + i), 2);
  y += 6;
  section("Instructions", recipeSteps(r).map((s, i) => `${i + 1}. ${s}`), 4);

  doc.save((r.title || "recipe").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".pdf");
}
