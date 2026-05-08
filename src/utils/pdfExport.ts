import jsPDF from "jspdf";
import type { StudyResult, FdaDrugData } from "../types";

/* ─── Color palette ─── */
const C = {
  dark: [17, 24, 39] as const,
  blue: [37, 99, 235] as const,
  emerald: [5, 150, 105] as const,
  amber: [217, 119, 6] as const,
  rose: [220, 50, 50] as const,
  gray: [107, 114, 128] as const,
  lightGray: [156, 163, 175] as const,
  bg: [248, 250, 252] as const,
  white: [255, 255, 255] as const,
  separator: [229, 231, 235] as const,
  darkBg: [30, 41, 59] as const,
  gold: [217, 164, 6] as const,
};

/* ─── Helper: hex colour for setFillColor / setTextColor ─── */
function rgb(c: readonly [number, number, number]) {
  return c as [number, number, number];
}

/* ═══════════════════════════════════════════
   INTERACTION REPORT PDF
   ═══════════════════════════════════════════ */
export function generateInteractionPDF(
  results: StudyResult[],
  drug: string,
  herb: string,
  sourcesUsed: string[],
  fdaData: FdaDrugData | null,
  topCitationCount: number,
  aiSummary?: string | null
) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 15; // margin
  const cw = pw - 2 * m; // content width
  let y = 0;
  let page = 1;

  /* ── helpers ── */
  const newPage = () => {
    doc.addPage();
    page++;
    y = m;
  };

  const need = (h: number) => {
    if (y + h > ph - 22) {
      addFooter();
      newPage();
      return true;
    }
    return false;
  };

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(...rgb(C.lightGray));
    doc.text(`Page ${page}`, pw / 2, ph - 8, { align: "center" });
    doc.text("PharmaInsight · Research Use Only", pw - m, ph - 8, { align: "right" });
  };

  /* ── 1. HEADER BAR ── */
  doc.setFillColor(...rgb(C.dark));
  doc.rect(0, 0, pw, 42, "F");

  doc.setFontSize(20);
  doc.setTextColor(...rgb(C.white));
  doc.text("PharmaInsight", m, 16);

  doc.setFontSize(11);
  doc.setTextColor(200, 200, 200);
  doc.text("Drug-Natural Product Interaction Report", m, 26);

  doc.setFontSize(8);
  doc.text(
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    pw - m,
    26,
    { align: "right" }
  );

  y = 50;

  /* ── 2. DRUG + HERB TITLE ── */
  doc.setFontSize(16);
  doc.setTextColor(...rgb(C.dark));
  doc.text(`${drug}  +  ${herb}`, m, y);
  y += 12;

  /* ── 3. OVERVIEW BOX ── */
  doc.setFillColor(...rgb(C.bg));
  doc.roundedRect(m, y, cw, 38, 3, 3, "F");
  doc.setFontSize(10);
  doc.setTextColor(...rgb(C.dark));
  doc.text("Analysis Overview", m + 5, y + 9);

  doc.setFontSize(8.5);
  doc.setTextColor(...rgb(C.gray));
  doc.text(`Data Sources:  ${sourcesUsed.join(", ")}`, m + 5, y + 17);
  doc.text(`Studies Found:  ${results.length}   |   Top Citations:  ${topCitationCount.toLocaleString()}`, m + 5, y + 24);

  const highCount = results.filter((r) => r.evidenceLevel === "High").length;
  const modCount = results.filter((r) => r.evidenceLevel === "Moderate").length;
  const lowCount = results.filter((r) => r.evidenceLevel === "Low").length;
  doc.text(`Evidence Breakdown:  ${highCount} High  |  ${modCount} Moderate  |  ${lowCount} Low`, m + 5, y + 31);
  y += 46;

  /* ── 4. AI-GENERATED EVIDENCE SYNTHESIS ── */
  if (aiSummary && aiSummary.trim().length > 20) {
    // Estimate height needed
    const summaryLines = doc.splitTextToSize(aiSummary.trim(), cw - 10);
    const summaryHeight = summaryLines.length * 3.5 + 20;
    need(Math.min(summaryHeight, 80));

    // Dark background box like the UI
    const boxHeight = Math.min(summaryLines.length * 3.5 + 16, ph - y - 30);
    doc.setFillColor(...rgb(C.darkBg));
    doc.roundedRect(m, y, cw, Math.max(boxHeight, 25), 3, 3, "F");

    // Gold accent header
    doc.setFontSize(9.5);
    doc.setTextColor(...rgb(C.gold));
    doc.text("Evidence-Based Research Synthesis", m + 5, y + 7);

    // Summary text
    doc.setFontSize(7.5);
    doc.setTextColor(200, 210, 220);
    const maxLines = Math.floor((boxHeight - 16) / 3.5);
    const displayLines = summaryLines.slice(0, maxLines);
    doc.text(displayLines, m + 5, y + 13);

    y += Math.max(boxHeight, 25) + 6;
  }

  /* ── 5. FDA ALERT ── */
  if (fdaData) {
    need(34);
    doc.setFillColor(255, 251, 235);
    doc.roundedRect(m, y, cw, 32, 3, 3, "F");
    doc.setDrawColor(...rgb(C.amber));
    doc.setLineWidth(0.4);
    doc.roundedRect(m, y, cw, 32, 3, 3, "S");

    doc.setFontSize(9.5);
    doc.setTextColor(...rgb(C.amber));
    doc.text("FDA-Associated Safety Signal", m + 5, y + 8);

    doc.setFontSize(7.5);
    doc.setTextColor(120, 53, 15);
    doc.text("Potential interaction-related safety signals were identified from FDA-associated", m + 5, y + 14);
    doc.text("pharmacovigilance data; however, clinical significance and causality remain incompletely established.", m + 5, y + 19);

    if (fdaData.brandNames.length > 0) {
      doc.text(`FDA-Listed Brand Names: ${fdaData.brandNames.join(", ")}`, m + 5, y + 25);
    }
    y += 32;
  }

  /* ── 6. STUDY RESULTS ── */
  results.forEach((study, idx) => {
    need(55); // ensure room

    // --- Study number + title ---
    doc.setFontSize(10.5);
    doc.setTextColor(...rgb(C.dark));
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(`${idx + 1}. ${study.title}`, cw - 4);
    doc.text(titleLines, m + 2, y);
    y += titleLines.length * 4.5 + 2;

    // --- Evidence badge ---
    doc.setFont("helvetica", "normal");
    const evColor =
      study.evidenceLevel === "High" ? C.emerald : study.evidenceLevel === "Moderate" ? C.amber : C.rose;
    doc.setFillColor(...rgb(evColor));
    const evLabel = `${study.evidenceLevel} Evidence`;
    const evW = doc.getTextWidth(evLabel) + 6;
    doc.roundedRect(m + 2, y - 3.2, evW, 5, 1, 1, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(C.white));
    doc.text(evLabel, m + 5, y);

    // Study type badge
    const stLabel = study.studyType;
    doc.setFillColor(30, 41, 59);
    const stW = doc.getTextWidth(stLabel) + 6;
    doc.roundedRect(m + 2 + evW + 2, y - 3.2, stW, 5, 1, 1, "F");
    doc.setTextColor(...rgb(C.white));
    doc.text(stLabel, m + 5 + evW + 2, y);
    y += 7;

    // --- Meta ---
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(C.gray));
    const authorsStr =
      study.authors.length > 0
        ? study.authors.slice(0, 3).join(", ") + (study.authors.length > 3 ? " et al." : "")
        : "";
    doc.text(`${study.journal}  |  ${study.pubYear}  |  ${authorsStr}`, m + 2, y);
    y += 5.5;

    // --- PMID (clickable) ---
    doc.setFontSize(8);
    doc.setTextColor(...rgb(C.blue));
    doc.textWithLink(`PMID: ${study.pmid}`, m + 2, y, { url: study.pubmedLink });
    const pmidEndX = m + 2 + doc.getTextWidth(`PMID: ${study.pmid}`);

    // --- DOI (clickable) ---
    if (study.doi && study.doiLink) {
      doc.textWithLink(`DOI: ${study.doi}`, pmidEndX + 6, y, { url: study.doiLink });
    }
    y += 6;

    // --- Abstract (truncated) ---
    if (study.abstract) {
      need(20);
      doc.setFontSize(7);
      doc.setTextColor(...rgb(C.gray));
      const absText = study.abstract.length > 500 ? study.abstract.substring(0, 500) + "..." : study.abstract;
      const absLines = doc.splitTextToSize(absText, cw - 4);
      doc.text(absLines, m + 2, y);
      y += absLines.length * 2.8 + 2;
    }

    // --- Separator ---
    doc.setDrawColor(...rgb(C.separator));
    doc.setLineWidth(0.2);
    doc.line(m, y + 1, pw - m, y + 1);
    y += 5;
  });

  /* ── 7. DISCLAIMER ── */
  need(18);
  doc.setFontSize(6.5);
  doc.setTextColor(...rgb(C.lightGray));
  const disclaimer =
    "Research use only. Data sourced from PubMed (NCBI), CrossRef, OpenAlex, and OpenFDA. " +
    "Results are for informational and scientific research purposes only. " +
    "Do not use for clinical decision-making. Always consult a qualified healthcare professional.";
  const dLines = doc.splitTextToSize(disclaimer, cw);
  doc.text(dLines, m, y);

  addFooter();
  doc.save(`${drug}_${herb}_Interaction_Report.pdf`);
}

/* ═══════════════════════════════════════════
   PHARMACOLOGY REPORT PDF
   ═══════════════════════════════════════════ */
interface PharmAction {
  name: string;
  pmids?: string[];
  score?: number;
  mechanisms?: { name: string; pmids?: string[] }[];
}
interface PharmCompound {
  name: string;
  category: string;
  pmids?: string[];
}
interface PharmResult {
  herb: string;
  pharmacological_actions: PharmAction[];
  active_compounds: PharmCompound[];
  evidence_level: string;
  confidence: string;
  sourcesUsed: string[];
}

export function generatePharmacologyPDF(result: PharmResult, aiSummary?: string | null) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 15;
  const cw = pw - 2 * m;
  let y = 0;
  let page = 1;

  const newPage = () => {
    doc.addPage();
    page++;
    y = m;
  };
  const need = (h: number) => {
    if (y + h > ph - 22) {
      addFooter();
      newPage();
      return true;
    }
    return false;
  };
  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(...rgb(C.lightGray));
    doc.text(`Page ${page}`, pw / 2, ph - 8, { align: "center" });
    doc.text("PharmaInsight · Research Use Only", pw - m, ph - 8, { align: "right" });
  };

  /* ── 1. HEADER BAR ── */
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, pw, 42, "F");

  doc.setFontSize(20);
  doc.setTextColor(...rgb(C.white));
  doc.text("PharmaInsight", m, 16);

  doc.setFontSize(11);
  doc.setTextColor(220, 255, 230);
  doc.text("Pharmacology & Phytochemistry Report", m, 26);

  doc.setFontSize(8);
  doc.text(
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    pw - m,
    26,
    { align: "right" }
  );

  y = 50;

  /* ── 2. HERB TITLE + BADGES ── */
  doc.setFontSize(16);
  doc.setTextColor(...rgb(C.dark));
  doc.text(result.herb, m, y);
  y += 10;

  // Evidence + Confidence badges
  const evColor = result.evidence_level === "High" ? C.emerald : result.evidence_level === "Moderate" ? C.amber : C.gray;
  doc.setFillColor(...rgb(evColor));
  const evTxt = `${result.evidence_level} Evidence`;
  const evW = doc.getTextWidth(evTxt) + 8;
  doc.setFontSize(8);
  doc.roundedRect(m, y - 3.2, evW, 6, 1.5, 1.5, "F");
  doc.setTextColor(...rgb(C.white));
  doc.text(evTxt, m + 4, y);

  const confColor = result.confidence === "High" ? C.emerald : result.confidence === "Moderate" ? C.amber : C.gray;
  doc.setFillColor(...rgb(confColor));
  const confTxt = `${result.confidence} Confidence`;
  const confW = doc.getTextWidth(confTxt) + 8;
  doc.roundedRect(m + evW + 4, y - 3.2, confW, 6, 1.5, 1.5, "F");
  doc.text(confTxt, m + evW + 8, y);
  y += 10;

  /* ── 3. AI-GENERATED EVIDENCE SYNTHESIS ── */
  if (aiSummary && aiSummary.trim().length > 20) {
    const summaryLines = doc.splitTextToSize(aiSummary.trim(), cw - 10);
    const boxHeight = Math.min(summaryLines.length * 3.5 + 16, ph - y - 30);
    need(Math.min(boxHeight + 5, 80));

    doc.setFillColor(...rgb(C.darkBg));
    doc.roundedRect(m, y, cw, Math.max(boxHeight, 25), 3, 3, "F");

    doc.setFontSize(9.5);
    doc.setTextColor(...rgb(C.gold));
    doc.text("Evidence-Based Research Synthesis", m + 5, y + 7);

    doc.setFontSize(7.5);
    doc.setTextColor(200, 210, 220);
    const maxLines = Math.floor((boxHeight - 16) / 3.5);
    const displayLines = summaryLines.slice(0, maxLines);
    doc.text(displayLines, m + 5, y + 13);

    y += Math.max(boxHeight, 25) + 6;
  }

  /* ── 4. EVIDENCE PROFILE ── */
  const actions = result.pharmacological_actions;
  const strongActions = actions.filter((a) => (a.score ?? 0) >= 80);
  const moderateActions = actions.filter((a) => (a.score ?? 0) >= 50 && (a.score ?? 0) < 80);
  const weakActions = actions.filter((a) => (a.score ?? 0) < 50);
  const totalRefs = new Set(actions.flatMap((a) => a.pmids ?? [])).size;

  need(40);
  doc.setFillColor(...rgb(C.bg));
  doc.roundedRect(m, y, cw, 35, 3, 3, "F");

  doc.setFontSize(10);
  doc.setTextColor(...rgb(C.dark));
  doc.setFont("helvetica", "bold");
  doc.text("Evidence Profile", m + 5, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...rgb(C.gray));

  // Evidence tiers with colored indicators
  const drawTierRow = (label: string, count: number, color: readonly [number, number, number], rowY: number) => {
    doc.setFillColor(...rgb(color));
    doc.circle(m + 7, rowY - 1, 1.5, "F");
    doc.setTextColor(...rgb(C.dark));
    doc.text(`${label}: ${count}`, m + 12, rowY);
  };

  drawTierRow("Well-supported Actions", strongActions.length, C.emerald, y + 15);
  drawTierRow("Moderately Supported", moderateActions.length, C.amber, y + 21);
  drawTierRow("Preliminary", weakActions.length, C.lightGray, y + 27);

  // Total refs on the right
  doc.setTextColor(...rgb(C.gray));
  doc.text(`Total PubMed Refs: ${totalRefs}`, pw - m - 5, y + 21, { align: "right" });
  doc.text(`Actions Documented: ${actions.length}`, pw - m - 5, y + 27, { align: "right" });

  y += 40;

  /* ── 5. ACTIVE COMPOUNDS ── */
  const specificCompounds = result.active_compounds.filter((c) => !["Flavonoids", "Alkaloids", "Terpenes", "Tannins", "Essential Oils"].includes(c.name));

  if (specificCompounds.length > 0) {
    need(20);
    doc.setFontSize(11);
    doc.setTextColor(...rgb(C.dark));
    doc.setFont("helvetica", "bold");
    doc.text("Active Compounds", m, y);
    y += 7;

    specificCompounds.forEach((comp) => {
      need(16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...rgb(C.dark));
      doc.text(`  ${comp.name}`, m + 2, y);

      // Category badge
      doc.setFillColor(5, 100, 70);
      const catW = doc.getTextWidth(comp.category) + 6;
      doc.roundedRect(m + 4 + doc.getTextWidth(`  ${comp.name}`), y - 3, catW, 5, 1, 1, "F");
      doc.setFontSize(6.5);
      doc.setTextColor(...rgb(C.white));
      doc.text(comp.category, m + 7 + doc.getTextWidth(`  ${comp.name}`), y);
      y += 5;

      // PMID links
      if (comp.pmids && comp.pmids.length > 0) {
        doc.setFontSize(7.5);
        doc.setTextColor(...rgb(C.blue));
        let px = m + 6;
        comp.pmids.forEach((pmid) => {
          const txt = `PMID:${pmid}`;
          const tw = doc.getTextWidth(txt) + 2;
          if (px + tw > pw - m) { px = m + 6; y += 4; need(10); }
          doc.textWithLink(txt, px, y, { url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` });
          px += tw + 4;
        });
        y += 5;
      }
    });
    y += 4;
  }

  /* ── 6. PHARMACOLOGICAL ACTIONS ── */
  if (result.pharmacological_actions.length > 0) {
    need(20);
    doc.setFontSize(11);
    doc.setTextColor(...rgb(C.dark));
    doc.setFont("helvetica", "bold");
    doc.text("Pharmacological Actions & Mechanisms", m, y);
    y += 8;

    result.pharmacological_actions.forEach((action) => {
      need(30);

      // Action name + score
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...rgb(C.dark));
      doc.text(action.name, m + 2, y);

      // Score badge
      const scColor = (action.score ?? 0) >= 80 ? C.emerald : (action.score ?? 0) >= 50 ? C.amber : C.gray;
      doc.setFillColor(...rgb(scColor));
      const scTxt = `Score: ${action.score ?? 0}`;
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const scW = doc.getTextWidth(scTxt) + 6;
      const scX = m + 4 + doc.getTextWidth(action.name) * 1.5;
      if (scX + scW < pw - m) {
        doc.roundedRect(scX, y - 3, scW, 5, 1, 1, "F");
        doc.setTextColor(...rgb(C.white));
        doc.text(scTxt, scX + 3, y);
      }
      y += 5.5;

      // PMID links
      if (action.pmids && action.pmids.length > 0) {
        doc.setFontSize(7.5);
        doc.setTextColor(...rgb(C.blue));
        let px = m + 6;
        action.pmids.forEach((pmid) => {
          const txt = `PMID:${pmid}`;
          const tw = doc.getTextWidth(txt) + 2;
          if (px + tw > pw - m) { px = m + 6; y += 4; need(10); }
          doc.textWithLink(txt, px, y, { url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` });
          px += tw + 4;
        });
        y += 5;
      }

      // Mechanisms
      if (action.mechanisms && action.mechanisms.length > 0) {
        action.mechanisms.forEach((mech) => {
          need(12);
          doc.setFontSize(7.5);
          doc.setTextColor(...rgb(C.gray));
          doc.text(`  Mechanism: ${mech.name}`, m + 6, y);

          if (mech.pmids && mech.pmids.length > 0) {
            let mx = m + 6 + doc.getTextWidth(`  Mechanism: ${mech.name}  `) + 6;
            doc.setTextColor(...rgb(C.blue));
            mech.pmids.slice(0, 2).forEach((pmid) => {
              const txt = `PMID:${pmid}`;
              const tw = doc.getTextWidth(txt) + 2;
              if (mx + tw > pw - m) { mx = m + 6; y += 4; need(10); }
              doc.textWithLink(txt, mx, y, { url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` });
              mx += tw + 4;
            });
          }
          y += 5;
        });
      }

      // Separator
      doc.setDrawColor(...rgb(C.separator));
      doc.setLineWidth(0.15);
      doc.line(m, y + 1, pw - m, y + 1);
      y += 5;
    });
  }

  /* ── 7. DISCLAIMER ── */
  need(16);
  doc.setFontSize(6.5);
  doc.setTextColor(...rgb(C.lightGray));
  const disclaimer =
    "Research use only. Data sourced from PubMed (NCBI). " +
    "Results are for informational and scientific research purposes only. " +
    "Do not use for clinical decision-making. Always consult a qualified healthcare professional.";
  doc.text(doc.splitTextToSize(disclaimer, cw), m, y);

  addFooter();
  doc.save(`${result.herb}_Phytochemical_Analysis.pdf`);
}
