/**
 * ═══════════════════════════════════════════════════════════════
 *  Academic Research Summary Engine  ·  v2.0
 *  ─────────────────────────────────
 *  Generates clean academic-style research summaries that:
 *  - Produce UNIFIED SCIENTIFIC NARRATIVES, not PubMed abstract excerpts
 *  - Synthesize multi-source evidence into coherent research overviews
 *  - Merge overlapping findings naturally into one narrative voice
 *  - Avoid copying phrases from journal abstracts
 *  - Read like concise scholarly evidence synthesis / research intelligence
 *  - Classify evidence tiers accurately with nuanced strength assessment
 *  - Preserve scientific neutrality and uncertainty without robotic phrasing
 *  - Use neutral pharmacovigilance language for FDA data
 *
 *  Style: narrative review / research synthesis / scientific intelligence
 *  NOT: clinical decision support / abstract extraction / PubMed aggregation
 *
 *  Uses HuggingFace Inference API (free) with local fallback.
 * ═══════════════════════════════════════════════════════════════
 */

/* ─── HuggingFace Configuration ─── */
const HF_MODELS = [
  "mistralai/Mistral-7B-Instruct-v0.2",
  "google/flan-t5-large",
  "facebook/bart-large-cnn",
];

const HF_KEY = (import.meta as any).env?.VITE_HF_API_KEY as string | undefined;

/* ═══════════════════════════════════════════════
   SECTION 1 — EVIDENCE CLASSIFICATION SYSTEM
   ═══════════════════════════════════════════════ */

type StudyTier =
  | "Meta-analysis"
  | "Systematic Review"
  | "Randomized Clinical Trial"
  | "Cohort Study"
  | "Case Report"
  | "Animal Study"
  | "In Vitro Study"
  | "Mechanistic Study";

const TIER_WEIGHT: Record<StudyTier, number> = {
  "Meta-analysis": 8,
  "Systematic Review": 7,
  "Randomized Clinical Trial": 6,
  "Cohort Study": 5,
  "Case Report": 4,
  "Animal Study": 3,
  "In Vitro Study": 2,
  "Mechanistic Study": 1,
};

function classifyStudyTier(studyType: string, title: string, abstract: string): StudyTier {
  const t = (title + " " + abstract).toLowerCase();
  const st = studyType.toLowerCase();

  if (st.includes("meta-analysis") || t.includes("meta-analysis") || t.includes("meta analysis")) return "Meta-analysis";
  if (st.includes("systematic review") || t.includes("systematic review")) return "Systematic Review";
  if (st.includes("randomized controlled") || st.includes("rct") || /\brct\b/.test(t) || t.includes("randomized controlled trial") || t.includes("randomised controlled trial")) return "Randomized Clinical Trial";
  if (st.includes("cohort") || t.includes("cohort study") || t.includes("prospective study") || t.includes("retrospective study")) return "Cohort Study";
  if (st.includes("case report") || st.includes("case study") || t.includes("case report") || t.includes("case series")) return "Case Report";
  if (st.includes("animal") || /\brat\b/.test(t) || /\bmice\b/.test(t) || /\bin vivo\b/.test(t) || /\bcanine\b/.test(t) || /\bporcine\b/.test(t) || /\bmurine\b/.test(t)) return "Animal Study";
  if (st.includes("in vitro") || t.includes("in vitro") || t.includes("cell line") || t.includes("hepg2") || t.includes("caco-2") || t.includes("hepatic microsome")) return "In Vitro Study";
  return "Mechanistic Study";
}

/**
 * Count studies by category for the Evidence Profile.
 */
function buildEvidenceProfile(tiers: StudyTier[]): {
  human: number;
  animal: number;
  mechanistic: number;
  reviews: number;
} {
  return {
    human: tiers.filter((t) =>
      ["Randomized Clinical Trial", "Cohort Study", "Case Report"].includes(t)
    ).length,
    animal: tiers.filter((t) => t === "Animal Study").length,
    mechanistic: tiers.filter((t) =>
      ["In Vitro Study", "Mechanistic Study"].includes(t)
    ).length,
    reviews: tiers.filter((t) =>
      ["Meta-analysis", "Systematic Review"].includes(t)
    ).length,
  };
}

/**
 * More nuanced overall evidence assessment.
 * Returns one of: "Strong", "Moderate", "Limited", "Very Limited"
 */
function assessOverallEvidence(
  tiers: StudyTier[],
  evidenceLevels: string[]
): "Strong" | "Moderate" | "Limited" | "Very Limited" {
  const profile = buildEvidenceProfile(tiers);
  const highEvidenceCount = evidenceLevels.filter((e) => e === "High").length;
  const modEvidenceCount = evidenceLevels.filter((e) => e === "Moderate").length;

  // Strong: has reviews + multiple high-quality studies
  if (profile.reviews >= 1 && highEvidenceCount >= 2) return "Strong";
  if (profile.reviews >= 1 && (highEvidenceCount >= 1 || modEvidenceCount >= 3)) return "Strong";

  // Moderate: either reviews exist or multiple human studies with decent evidence
  if (profile.reviews >= 1) return "Moderate";
  if (profile.human >= 3 && (highEvidenceCount >= 1 || modEvidenceCount >= 2)) return "Moderate";
  if (profile.human >= 2 && highEvidenceCount >= 1) return "Moderate";
  if (highEvidenceCount >= 2) return "Moderate";

  // Limited: some human evidence but not robust
  if (profile.human >= 1) return "Limited";
  if (profile.animal >= 2 || profile.mechanistic >= 3) return "Limited";

  // Very Limited: only preclinical / mechanistic
  return "Very Limited";
}

/**
 * Nuanced evidence strength description for pharmacology.
 * Considers number of actions, their scores, and the quality spread.
 */
function assessPharmacologyEvidence(
  actions: { name: string; score?: number; pmids?: string[]; mechanisms?: { name: string; pmids?: string[] }[] }[]
): { strength: "Strong" | "Moderate" | "Limited" | "Very Limited"; description: string } {
  const strong = actions.filter((a) => (a.score ?? 0) >= 80);
  const moderate = actions.filter((a) => (a.score ?? 0) >= 50 && (a.score ?? 0) < 80);
  const weak = actions.filter((a) => (a.score ?? 0) < 50);

  const totalPmids = new Set(actions.flatMap((a) => a.pmids ?? [])).size;
  const withMechanisms = actions.filter((a) => (a.mechanisms?.length ?? 0) > 0).length;

  if (strong.length >= 2) {
    return {
      strength: "Strong",
      description: `${strong.length} well-supported pharmacological action(s) with substantial clinical or review-level evidence. ${withMechanisms} action(s) have documented molecular mechanisms.`
    };
  }
  if (strong.length >= 1 || moderate.length >= 3) {
    return {
      strength: "Moderate",
      description: `${strong.length} well-supported and ${moderate.length} moderately supported action(s) identified. Evidence derives from a mix of clinical and preclinical sources covering ${totalPmids} PubMed reference(s).`
    };
  }
  if (moderate.length >= 1 || weak.length >= 3) {
    return {
      strength: "Limited",
      description: `${moderate.length} moderately supported and ${weak.length} preliminary action(s) identified, primarily from preclinical or observational evidence. Further validation through well-designed clinical studies is warranted.`
    };
  }
  return {
    strength: "Very Limited",
    description: `Only ${weak.length} preliminary pharmacological action(s) identified, supported by limited evidence. The current literature base is insufficient for definitive conclusions.`
  };
}

/* ═══════════════════════════════════════════════
   SECTION 2 — SEMANTIC RELEVANCE FILTERING
   ═══════════════════════════════════════════════ */

const DIRECT_INTERACTION_SIGNALS = [
  "interaction", "coadministration", "co-administration", "co-prescription",
  "combination therapy", "concomitant use", "drug-herb", "drug-drug",
  "adverse reaction", "potentiation", "antagonism", "synergis",
  "contraindication", "precaution",
];

const PK_SIGNALS = [
  "cyp3a4", "cyp2d6", "cyp2c9", "cyp2c19", "cyp1a2", "cyp2e1",
  "cytochrome p450", "p-glycoprotein", "pgp", "abc transporter",
  "bioavailability", "clearance", "half-life", "auc", "cmax",
  "metabolism", "inhibition", "induction", "substrate", "inhibitor",
  "enzyme", "first-pass", "intestinal absorption",
];

const PD_SIGNALS = [
  "anticoagulant", "antiplatelet", "coagulation", "bleeding", "inr",
  "prothrombin", "thrombin", "platelet aggregation", "clotting",
  "antihypertensive", "blood pressure", "hypoglycemic", "glucose",
  "immunosuppressant", "rejection", "sedative", "cns depression",
  "serotonin syndrome", "serotonergic", "sympathomimetic",
  "receptor binding", "receptor antagonist", "receptor agonist",
  "dose-dependent", "concentration-dependent",
];

const IRRELEVANCE_SIGNALS = [
  "adherence", "compliance", "tablet dissolution", "tablet formulation",
  "dissolution test", "quality control", "stability study",
  "patient satisfaction", "survey", "questionnaire",
  "cost-effectiveness", "economic evaluation", "healthcare utilization",
  "self-medication practice", "prevalence study", "knowledge attitude",
  "ethnobotanical survey", "traditional use survey",
];

function scoreSemanticRelevance(
  title: string,
  abstract: string,
  drug: string,
  herb: string,
  aliases: string[]
): number {
  const text = (title + " " + abstract).toLowerCase();
  const drugL = drug.toLowerCase();
  const herbL = herb.toLowerCase();

  let score = 0;

  const drugMentioned = text.includes(drugL);
  const herbMentioned = text.includes(herbL) || aliases.some((a) => text.includes(a.toLowerCase()));
  if (drugMentioned && herbMentioned) score += 50;
  if (drugMentioned) score += 15;
  if (herbMentioned) score += 15;

  for (const signal of DIRECT_INTERACTION_SIGNALS) {
    if (text.includes(signal)) { score += 8; break; }
  }
  for (const signal of PK_SIGNALS) {
    if (text.includes(signal)) { score += 6; break; }
  }
  for (const signal of PD_SIGNALS) {
    if (text.includes(signal)) { score += 5; break; }
  }
  for (const signal of IRRELEVANCE_SIGNALS) {
    if (text.includes(signal)) { score -= 20; break; }
  }
  if (!drugMentioned && !herbMentioned) score -= 30;

  return score;
}

const HERB_ALIAS_MAP: Record<string, string[]> = {
  "honey": ["bee product", "propolis", "royal jelly", "bee venom", "apitherapy", "mel"],
  "warfarin": ["coumadin", "anticoagulant", "vitamin k antagonist"],
  "garlic": ["allium sativum", "allicin", "alliin", "aged garlic extract"],
  "ginger": ["zingiber officinale", "gingerol", "shogaol"],
  "ginkgo": ["ginkgo biloba", "egb 761", "ginkgolide"],
  "ginseng": ["panax ginseng", "ginsenoside", "asian ginseng", "korean ginseng"],
  "st. john's wort": ["hypericum perforatum", "hypericin", "hyperforin", "st john wort"],
  "curcumin": ["turmeric", "curcuma longa", "diferuloylmethane"],
  "milk thistle": ["silybum marianum", "silymarin", "silibinin"],
  "echinacea": ["echinacea purpurea", "echinacea angustifolia", "coneflower"],
  "valerian": ["valeriana officinalis", "valerenic acid"],
  "kava": ["piper methysticum", "kavalactone"],
  "licorice": ["glycyrrhiza glabra", "glycyrrhizin"],
  "green tea": ["camellia sinensis", "egcg", "epigallocatechin"],
  "berberine": ["berberis vulgaris", "coptis", "goldenseal"],
  "ashwagandha": ["withania somnifera", "withanolide"],
};

function getAliases(term: string): string[] {
  const lower = term.toLowerCase();
  for (const [key, aliases] of Object.entries(HERB_ALIAS_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return aliases;
  }
  return [];
}

/* ═══════════════════════════════════════════════
   SECTION 3 — LANGUAGE CALIBRATION
   ═══════════════════════════════════════════════ */

const OVERSTATEMENT_TERMS: Record<string, string> = {
  "clinically proven": "reported in clinical studies",
  "confirmed interaction": "reported interaction",
  "significant interaction": "potential interaction",
  "definite interaction": "possible interaction",
  "established interaction": "described interaction",
  "fda warning": "fda-associated safety signal",
  "fda alert": "fda-associated safety observation",
  "fda major": "fda-associated safety signal",
  "dangerous combination": "combination discussed in the literature",
  "contraindicated": "caution described in the literature",
  "must be avoided": "has been discussed with caution in the literature",
  "proven effect": "reported effect",
  "clear evidence": "some evidence",
  "strong evidence": "moderate-to-strong evidence",
  "well-established": "previously reported",
  "it is known that": "available evidence suggests that",
  "it has been demonstrated": "studies have reported",
  "clearly shows": "suggests",
  "undoubtedly": "possibly",
  "undisputed": "generally reported",
  // PubMed abstract-style phrases to avoid
  "we present the first case": "a case has been described",
  "the recommendation was": "the study discussed",
  "patients with confirmed": "individuals with",
  "in this study, we": "the study",
  "our findings suggest": "the findings suggest",
  "we investigated": "the investigation examined",
  "we report": "the report describes",
  "we found that": "the study found that",
  "we demonstrate": "the study demonstrates",
  "we show that": "the results indicate that",
  "our results demonstrate": "the results indicate",
  "our study demonstrates": "the study indicates",
  "this is the first study": "the study",
  "to the best of our knowledge": "according to available literature",
  "to our knowledge": "according to available literature",
  "this study aimed to": "this study examined",
  "the aim of this study": "this study examined",
  "background:": "",
  "conclusion:": "",
  "results:": "",
  "methods:": "",
};

function calibrateLanguage(text: string, evidenceStrength: string): string {
  if (evidenceStrength === "Strong") return text;

  let calibrated = text;
  for (const [overstated, appropriate] of Object.entries(OVERSTATEMENT_TERMS)) {
    const regex = new RegExp(overstated, "gi");
    calibrated = calibrated.replace(regex, appropriate);
  }
  return calibrated;
}

/* ═══════════════════════════════════════════════
   SECTION 4 — ABSTRACT-STYLE PHRASE SCRUBBING
   ═══════════════════════════════════════════════ */

/**
 * Detects and removes PubMed abstract-style phrases that make
 * summaries sound like raw abstract extraction rather than synthesis.
 */
function scrubAbstractStyle(text: string): string {
  let cleaned = text;

  // Remove PubMed section headers
  cleaned = cleaned.replace(/^(BACKGROUND|OBJECTIVE|METHODS?|RESULTS?|CONCLUSIONS?|AIM|PURPOSE|INTRODUCTION|DISCUSSION):\s*/gim, "");

  // Remove first-person research phrases
  cleaned = cleaned.replace(/\b(?:we|our|us)\s+(?:present|report|describe|investigated|examined|evaluated|assessed|analyzed|conducted|performed|observed|found|show|demonstrate|confirm|propose|suggest)\b/gi, (match) => {
    const replacement: Record<string, string> = {
      "we present": "a study presents",
      "we report": "a study reports",
      "we describe": "a study describes",
      "we investigated": "an investigation examined",
      "we examined": "an examination evaluated",
      "we evaluated": "an evaluation assessed",
      "we assessed": "an assessment examined",
      "we analyzed": "an analysis examined",
      "we conducted": "a study conducted",
      "we performed": "a study performed",
      "we observed": "observations indicated",
      "we found": "findings indicated",
      "we show": "results indicate",
      "we demonstrate": "results demonstrate",
      "we confirm": "results support",
      "we propose": "the study proposes",
      "we suggest": "the study suggests",
      "our present": "a study presents",
      "our report": "a study reports",
      "our findings": "the findings",
      "our results": "the results",
      "our study": "the study",
      "our analysis": "the analysis",
      "our investigation": "the investigation",
      "our observation": "the observation",
      "our data": "the data",
    };
    return replacement[match.toLowerCase()] || "the study";
  });

  // Remove "first case/first study" boastful phrases
  cleaned = cleaned.replace(/\b(?:this is the first|to (?:the best of )?our knowledge,?\s*(?:this is )?(?:the first)?)\b/gi, "a");

  // Clean up double spaces from replacements
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return cleaned;
}

/* ═══════════════════════════════════════════════
   SECTION 5 — ACADEMIC PROMPT ENGINEERING
   ═══════════════════════════════════════════════ */

/**
 * Build an academic literature-review prompt for interaction summaries.
 * Designed to produce integrated synthesis, NOT abstract extraction.
 */
function buildInteractionPrompt(
  filteredStudies: {
    pmid: string;
    title: string;
    abstract: string;
    evidenceLevel: string;
    tier: StudyTier;
  }[],
  drug: string,
  herb: string,
  profile: { human: number; animal: number; mechanistic: number; reviews: number },
  overallStrength: string
): string {
  const studyTexts = filteredStudies.map((s, i) => {
    const abs = s.abstract.length > 300 ? s.abstract.substring(0, 300) + " [...]" : s.abstract;
    return `[${i + 1}] PMID:${s.pmid} | ${s.tier} | ${s.evidenceLevel} Evidence\nTitle: ${s.title}\nKey points: ${abs}`;
  });

  return `You are writing a UNIFIED SCIENTIFIC EVIDENCE SYNTHESIS for a research evidence aggregation platform. This is NOT a clinical decision-support system — it is a research exploration tool.

TASK: Write a concise, integrated research synthesis of the evidence on the interaction between ${drug} and ${herb}.

CRITICAL WRITING RULES:
1. Write as a SCHOLARLY RESEARCH SYNTHESIS — like the discussion section of a systematic review, NOT like abstract excerpts stitched together.
2. NEVER copy sentences directly from the abstracts. PARAPHRASE everything into your own academic voice.
3. MERGE overlapping findings into unified statements. Do not repeat the same conclusion from multiple studies.
4. Use a SINGLE COHERENT NARRATIVE VOICE throughout. Do not switch between study-by-study descriptions.
5. AVOID PubMed abstract-style phrases: "We present...", "In this study, we...", "Our findings suggest...", "This is the first study to...", "Patients with confirmed...", "The recommendation was..."
6. Frame findings as collective evidence: "Multiple studies report...", "The available evidence suggests...", "Preclinical data indicate...", "Clinical observations have documented..."
7. Preserve uncertainty with appropriate hedging: "may", "appears to", "suggests", "preliminary data indicate", "limited evidence"
8. NEVER convert "possible" into "confirmed" or "likely" without strong human evidence.
9. Distinguish human clinical evidence from preclinical (animal/in vitro) findings naturally within the narrative.
10. Do NOT generate clinical recommendations — this is a research overview only.
11. Be concise and professionally structured. 3-5 sentences maximum for the synthesis paragraph.
12. Remove any duplicated or redundant evidence descriptions.
13. Discuss ONLY studies directly relevant to ${drug} and ${herb}.

EVIDENCE CONTEXT:
- Human Studies: ${profile.human}
- Animal Studies: ${profile.animal}
- Mechanistic Studies: ${profile.mechanistic}
- Reviews: ${profile.reviews}
- Overall Evidence Strength: ${overallStrength}

STUDIES:
${studyTexts.join("\n\n")}

OUTPUT FORMAT:
Write a single concise integrated synthesis paragraph (3-5 sentences) that reads as natural academic prose — NOT a list of abstract excerpts. Then provide the evidence profile.

Evidence Profile:
- Human Studies: ${profile.human}
- Animal Studies: ${profile.animal}
- Mechanistic Studies: ${profile.mechanistic}
- Reviews: ${profile.reviews}

Overall Evidence Strength: ${overallStrength}`;
}

/**
 * Build an academic literature-review prompt for pharmacology summaries.
 * Designed to produce integrated synthesis, NOT abstract extraction.
 */
function buildPharmacologyPrompt(
  actions: { name: string; score?: number; pmids?: string[]; mechanisms?: { name: string; pmids?: string[] }[] }[],
  herb: string
): string {
  const actionTexts = actions.slice(0, 12).map((a) => {
    const strength = (a.score ?? 0) >= 80 ? "Well-supported" : (a.score ?? 0) >= 50 ? "Moderately supported" : "Preliminary";
    const mechStr = a.mechanisms?.map((m) => `${m.name}`).join("; ") ?? "not yet elucidated";
    const pmidCount = a.pmids?.length ?? 0;
    return `- ${a.name} [${strength}, score: ${a.score ?? 0}, ${pmidCount} PubMed ref(s)]\n  Mechanisms: ${mechStr}`;
  });

  const strong = actions.filter((a) => (a.score ?? 0) >= 80).length;
  const moderate = actions.filter((a) => (a.score ?? 0) >= 50 && (a.score ?? 0) < 80).length;
  const weak = actions.filter((a) => (a.score ?? 0) < 50).length;
  const totalRefs = new Set(actions.flatMap((a) => a.pmids ?? [])).size;

  return `You are writing a UNIFIED SCIENTIFIC EVIDENCE SYNTHESIS for a phytochemical evidence aggregation platform. This is NOT a clinical decision-support system.

TASK: Write a concise, integrated research synthesis of the pharmacological profile of ${herb} based on the retrieved PubMed evidence.

CRITICAL WRITING RULES:
1. Write as a SCHOLARLY RESEARCH SYNTHESIS — like a concise review article, NOT like abstract excerpts.
2. NEVER copy phrases from journal abstracts. PARAPHRASE everything into academic prose.
3. MERGE overlapping findings into unified statements.
4. Use a SINGLE COHERENT NARRATIVE VOICE throughout.
5. AVOID PubMed abstract-style: "We present...", "Our findings suggest...", "This study aimed to..."
6. Frame findings as collective evidence: "The available literature reports...", "Evidence suggests...", "Multiple investigations have documented..."
7. Preserve uncertainty: "may", "appears to", "preliminary data suggest", "further validation is warranted"
8. Distinguish in vitro vs. in vivo vs. clinical findings naturally.
9. Do NOT generate clinical recommendations.
10. Be concise and professionally structured. 3-5 sentences maximum.
11. Group related actions together naturally (e.g., anti-inflammatory and antioxidant can be discussed together).

PHARMACOLOGICAL ACTIONS:
${actionTexts.join("\n\n")}

Total PubMed references covering these actions: ${totalRefs}

OUTPUT FORMAT:
Write a single concise integrated synthesis paragraph (3-5 sentences) that reads as natural academic prose. Then provide the evidence profile.

Evidence Profile:
- Well-supported Actions: ${strong}
- Moderately Supported: ${moderate}
- Preliminary: ${weak}

Overall Evidence Strength: ${strong > 0 ? "Moderate-to-Strong" : moderate > 0 ? "Moderate" : "Limited"}`;
}

/* ═══════════════════════════════════════════════
   SECTION 6 — HUGGINGFACE API LAYER
   ═══════════════════════════════════════════════ */

async function queryHuggingFace(model: string, prompt: string, isSummarization: boolean): Promise<string | null> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (HF_KEY) headers["Authorization"] = `Bearer ${HF_KEY}`;

  const body = isSummarization
    ? { inputs: prompt, parameters: { max_new_tokens: 500, min_length: 80 } }
    : { inputs: prompt, parameters: { max_new_tokens: 500, temperature: 0.15, top_p: 0.85 } };

  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.error?.includes("loading") || err.error?.includes("currently loading")) {
        await new Promise((r) => setTimeout(r, 15000));
        const retry = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (!retry.ok) return null;
        const data = await retry.json();
        return extractText(data, isSummarization);
      }
      return null;
    }

    const data = await res.json();
    return extractText(data, isSummarization);
  } catch {
    return null;
  }
}

function extractText(data: any, isSummarization: boolean): string | null {
  if (Array.isArray(data)) {
    if (data[0]?.summary_text) return data[0].summary_text;
    if (data[0]?.generated_text) {
      const txt = data[0].generated_text;
      if (!isSummarization && txt.includes("\n")) {
        const parts = txt.split("\n").filter((l: string) => l.trim().length > 20);
        if (parts.length > 0) return parts.join("\n");
      }
      return txt;
    }
  }
  if (typeof data === "string") return data;
  if (data?.generated_text) return data.generated_text;
  return null;
}

/* ═══════════════════════════════════════════════
   SECTION 7 — LOCAL FALLBACK ENGINE (v2)
   Integrated Scientific Synthesis — NOT Abstract Extraction
   ═══════════════════════════════════════════════ */

/**
 * Extract key THEMES from study abstracts — not raw sentences.
 * Groups findings by topic to enable synthesis rather than extraction.
 */
function extractResearchThemes(
  studies: { title: string; abstract: string; pmid: string; tier: StudyTier }[],
  drug: string,
  herb: string,
  aliases: string[]
): {
  interactionFindings: string[];
  pkFindings: string[];
  pdFindings: string[];
  preclinicalFindings: string[];
  reviewConclusions: string[];
} {
  const themes = {
    interactionFindings: [] as string[],
    pkFindings: [] as string[],
    pdFindings: [] as string[],
    preclinicalFindings: [] as string[],
    reviewConclusions: [] as string[],
  };

  for (const study of studies) {
    const text = (study.abstract || study.title).toLowerCase();
    const sentences = (study.abstract || study.title)
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.length > 30);

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();

      // Skip irrelevant sentences
      if (IRRELEVANCE_SIGNALS.some((sig) => lower.includes(sig))) continue;

      // Skip abstract-style opening/closing phrases
      if (/^(background|objective|aim|purpose|methods?):/i.test(sentence.trim())) continue;
      if (/^(in this study,?\s*we|we (present|report|describe|investigated|aimed))/i.test(sentence.trim())) continue;

      const mentionsDrug = lower.includes(drug.toLowerCase());
      const mentionsHerb = lower.includes(herb.toLowerCase()) || aliases.some((a) => lower.includes(a.toLowerCase()));
      const hasInteraction = DIRECT_INTERACTION_SIGNALS.some((sig) => lower.includes(sig));
      const hasPK = PK_SIGNALS.some((sig) => lower.includes(sig));
      const hasPD = PD_SIGNALS.some((sig) => lower.includes(sig));
      const isPreclinical = study.tier === "Animal Study" || study.tier === "In Vitro Study" || study.tier === "Mechanistic Study";
      const isReview = study.tier === "Meta-analysis" || study.tier === "Systematic Review";

      if (!mentionsDrug && !mentionsHerb && !hasInteraction && !hasPK && !hasPD) continue;

      // Categorize
      if (isReview && (hasInteraction || mentionsDrug || mentionsHerb)) {
        themes.reviewConclusions.push(sentence.trim());
      } else if (hasInteraction) {
        themes.interactionFindings.push(sentence.trim());
      } else if (hasPK) {
        themes.pkFindings.push(sentence.trim());
      } else if (hasPD) {
        themes.pdFindings.push(sentence.trim());
      } else if (isPreclinical && (mentionsDrug || mentionsHerb)) {
        themes.preclinicalFindings.push(sentence.trim());
      }
    }
  }

  // Deduplicate within each category (60% word overlap threshold)
  for (const key of Object.keys(themes) as (keyof typeof themes)[]) {
    const items = themes[key];
    const unique: string[] = [];
    for (const item of items) {
      const isDuplicate = unique.some((existing) => {
        const overlap = item.split(" ").filter((w) => existing.toLowerCase().includes(w.toLowerCase())).length;
        return overlap / item.split(" ").length > 0.6;
      });
      if (!isDuplicate && unique.length < 4) {
        unique.push(item);
      }
    }
    themes[key] = unique;
  }

  return themes;
}

/**
 * Generate a SYNTHESIZED interaction summary — unified academic narrative.
 * NOT a collection of extracted abstract sentences.
 */
function generateLocalInteractionSummary(
  studies: { title: string; abstract: string; pmid: string; tier: StudyTier; evidenceLevel: string }[],
  drug: string,
  herb: string,
  aliases: string[]
): string {
  const profile = buildEvidenceProfile(studies.map((s) => s.tier));
  const overallStrength = assessOverallEvidence(
    studies.map((s) => s.tier),
    studies.map((s) => s.evidenceLevel)
  );

  const themes = extractResearchThemes(studies, drug, herb, aliases);

  // ── Build unified narrative ──
  let synthesis = "";

  // Opening: Evidence landscape framing
  if (profile.reviews > 0 && profile.human > 0) {
    synthesis += `The interaction between ${drug} and ${herb} has been examined in ${profile.reviews} review(s) alongside ${profile.human} human clinical study/studies, providing a moderately characterized evidence base. `;
  } else if (profile.human > 0) {
    synthesis += `Available evidence for the interaction between ${drug} and ${herb} comprises ${profile.human} human clinical study/studies${profile.animal > 0 ? ` and ${profile.animal} animal investigation(s)` : ""}, though the overall literature remains limited. `;
  } else if (profile.animal > 0 || profile.mechanistic > 0) {
    synthesis += `Direct human clinical evidence for the interaction between ${drug} and ${herb} is currently lacking; the available literature consists primarily of ${profile.animal > 0 ? `${profile.animal} animal study/studies` : ""}${profile.animal > 0 && profile.mechanistic > 0 ? " and " : ""}${profile.mechanistic > 0 ? `${profile.mechanistic} mechanistic investigation(s)` : ""}. `;
  } else {
    synthesis += `The current literature provides limited directly relevant evidence for the interaction between ${drug} and ${herb}. `;
  }

  // Interaction findings synthesis
  if (themes.reviewConclusions.length > 0) {
    synthesis += `Review-level analyses indicate that ${paraphraseFindings(themes.reviewConclusions, drug, herb)}. `;
  }

  if (themes.interactionFindings.length > 0) {
    synthesis += `${paraphraseFindings(themes.interactionFindings, drug, herb)}. `;
  }

  // Pharmacokinetic insights
  if (themes.pkFindings.length > 0) {
    synthesis += `Regarding pharmacokinetic considerations, ${paraphraseFindings(themes.pkFindings, drug, herb)}. `;
  }

  // Pharmacodynamic insights
  if (themes.pdFindings.length > 0) {
    synthesis += `Pharmacodynamic observations suggest that ${paraphraseFindings(themes.pdFindings, drug, herb)}. `;
  }

  // Preclinical context
  if (themes.preclinicalFindings.length > 0) {
    synthesis += `Preclinical data indicate ${paraphraseFindings(themes.preclinicalFindings, drug, herb)}, though these findings require clinical validation. `;
  }

  // Uncertainty preservation
  if (overallStrength === "Very Limited" || overallStrength === "Limited") {
    synthesis += `The current evidence base remains insufficient for definitive conclusions, and well-designed clinical studies are needed to clarify the nature and clinical relevance of this interaction.`;
  } else if (overallStrength === "Moderate") {
    synthesis += `While the available evidence provides some insight, additional rigorous studies would further clarify the interaction profile and its clinical implications.`;
  }

  // Scrub any remaining abstract-style phrases
  synthesis = scrubAbstractStyle(synthesis);

  return `${synthesis}\n\nEvidence Profile:\n- Human Studies: ${profile.human}\n- Animal Studies: ${profile.animal}\n- Mechanistic Studies: ${profile.mechanistic}\n- Reviews: ${profile.reviews}\n\nOverall Evidence Strength: ${overallStrength}`;
}

/**
 * Paraphrase a set of findings into a more synthesized academic voice.
 * Instead of quoting abstract sentences, merges them into unified statements.
 */
function paraphraseFindings(findings: string[], drug: string, herb: string): string {
  if (findings.length === 0) return "";
  if (findings.length === 1) {
    return scrubSingleFinding(findings[0], drug, herb);
  }

  // For multiple findings, create a merged statement
  const cleaned = findings.map((f) => scrubSingleFinding(f, drug, herb)).filter((f) => f.length > 10);
  if (cleaned.length === 1) return cleaned[0];

  // Join with appropriate connectors
  if (cleaned.length === 2) {
    return `${cleaned[0]}, and ${cleaned[1].charAt(0).toLowerCase()}${cleaned[1].slice(1)}`;
  }

  // For 3+, use the first 2 most relevant and summarize
  return `${cleaned[0]}, and additional findings ${cleaned.slice(1).map((c) => c.charAt(0).toLowerCase() + c.slice(1)).join("; additionally, ")}`;
}

/**
 * Clean a single finding from abstract-style phrasing.
 */
function scrubSingleFinding(finding: string, drug: string, herb: string): string {
  let cleaned = finding;

  // Remove first-person phrases
  cleaned = cleaned.replace(/\b(?:we|our team)\s+(?:present|report|describe|investigated|examined|evaluated|found|show|demonstrate|observed|conducted)\b/gi, "the study");

  // Remove "this is the first study" type phrases
  cleaned = cleaned.replace(/\bthis is the (?:first|initial) (?:study|report|case|investigation|description) (?:to |that )?/gi, "");

  // Remove "to our knowledge" phrases
  cleaned = cleaned.replace(/\bto (?:the best of )?(?:our|the authors') knowledge,?\s*/gi, "");

  // Remove section headers
  cleaned = cleaned.replace(/^(?:BACKGROUND|OBJECTIVE|METHODS?|RESULTS?|CONCLUSIONS?|AIM|PURPOSE):\s*/i, "");

  // Remove "In this study" openings
  cleaned = cleaned.replace(/^in this study,?\s*/i, "");

  // Clean trailing/leading whitespace
  cleaned = cleaned.trim();

  // Ensure it ends with period
  if (cleaned.length > 10 && !/[.!?]$/.test(cleaned)) {
    cleaned += ".";
  }

  return cleaned;
}

/**
 * Generate a SYNTHESIZED pharmacology summary — unified academic narrative.
 * NOT a mechanical action counter.
 */
function generateLocalPharmacologySummary(
  actions: { name: string; score?: number; pmids?: string[]; mechanisms?: { name: string; pmids?: string[] }[] }[],
  herb: string
): string {
  const strong = actions.filter((a) => (a.score ?? 0) >= 80);
  const moderate = actions.filter((a) => (a.score ?? 0) >= 50 && (a.score ?? 0) < 80);
  const weak = actions.filter((a) => (a.score ?? 0) < 50);
  const evidence = assessPharmacologyEvidence(actions);

  const totalRefs = new Set(actions.flatMap((a) => a.pmids ?? [])).size;
  const withMechanisms = actions.filter((a) => (a.mechanisms?.length ?? 0) > 0).length;

  // ── Build unified narrative ──
  let synthesis = "";

  // Opening: Evidence landscape
  if (strong.length > 0) {
    synthesis += `The pharmacological profile of ${herb} is supported by a substantial evidence base spanning ${actions.length} documented action(s) across ${totalRefs} PubMed reference(s). `;
    synthesis += `The most well-characterized activities include ${strong.map((a) => a.name).join(", ")}, which are supported by clinical or review-level evidence. `;
  } else if (moderate.length > 0) {
    synthesis += `The PubMed literature documents ${actions.length} pharmacological action(s) for ${herb} across ${totalRefs} reference(s). `;
    synthesis += `Moderately supported activities include ${moderate.map((a) => a.name).join(", ")}, with evidence deriving from a combination of observational and preclinical studies. `;
  } else {
    synthesis += `The available PubMed literature identifies ${actions.length} pharmacological action(s) for ${herb}, though the current evidence base remains predominantly preliminary. `;
  }

  // Well-supported actions detail
  if (strong.length > 0) {
    const strongWithMechs = strong.filter((a) => (a.mechanisms?.length ?? 0) > 0);
    if (strongWithMechs.length > 0) {
      synthesis += `For the well-supported actions, molecular mechanisms such as ${strongWithMechs.flatMap((a) => a.mechanisms?.map((m) => m.name) ?? []).slice(0, 4).join(", ")} have been documented. `;
    }
  }

  // Moderate actions
  if (moderate.length > 0) {
    synthesis += `Additional activities with moderate evidence support include ${moderate.map((a) => a.name).join(", ")}. `;
  }

  // Preliminary actions — grouped, not listed individually
  if (weak.length > 0) {
    if (weak.length <= 4) {
      synthesis += `Preliminary evidence suggests possible ${weak.map((a) => a.name).join(", ")} activity, though these findings require further validation through well-designed studies. `;
    } else {
      synthesis += `Preliminary evidence suggests a range of additional activities including ${weak.slice(0, 3).map((a) => a.name).join(", ")}, among others, though these findings remain to be confirmed in rigorous clinical settings. `;
    }
  }

  // Mechanistic context
  if (withMechanisms > 0 && withMechanisms < actions.length) {
    synthesis += `Molecular mechanisms have been partially elucidated for ${withMechanisms} of the ${actions.length} documented action(s). `;
  }

  // Closing: evidence quality assessment
  synthesis += evidence.description;

  // Scrub any remaining abstract-style phrases
  synthesis = scrubAbstractStyle(synthesis);

  return `${synthesis}\n\nEvidence Profile:\n- Well-supported Actions: ${strong.length}\n- Moderately Supported: ${moderate.length}\n- Preliminary: ${weak.length}\n\nOverall Evidence Strength: ${evidence.strength}`;
}

/* ═══════════════════════════════════════════════
   SECTION 8 — PUBLIC API
   ═══════════════════════════════════════════════ */

/**
 * Generate an academic research summary for drug-herb interaction results.
 */
export async function generateInteractionSummary(
  results: { title: string; abstract: string; pmid: string; evidenceLevel: string; studyType: string; doi?: string }[],
  drug: string,
  herb: string
): Promise<{ text: string; source: string }> {
  // ── Classify evidence tiers ──
  const classified = results.map((r) => ({
    ...r,
    tier: classifyStudyTier(r.studyType, r.title, r.abstract),
  }));

  // ── Semantic filtering ──
  const herbAliases = getAliases(herb);
  const drugAliases = getAliases(drug);
  const allAliases = [...herbAliases, ...drugAliases];

  const scored = classified.map((r) => ({
    ...r,
    relevanceScore: scoreSemanticRelevance(r.title, r.abstract, drug, herb, allAliases),
  }));

  scored.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    return (TIER_WEIGHT[b.tier] ?? 0) - (TIER_WEIGHT[a.tier] ?? 0);
  });

  const filtered = scored.filter((s) => s.relevanceScore > -10).slice(0, 10);

  // ── Evidence assessment ──
  const profile = buildEvidenceProfile(filtered.map((s) => s.tier));
  const overallStrength = assessOverallEvidence(
    filtered.map((s) => s.tier),
    filtered.map((s) => s.evidenceLevel)
  );

  // ── Try AI generation ──
  const prompt = buildInteractionPrompt(
    filtered.map((s) => ({ pmid: s.pmid, title: s.title, abstract: s.abstract, evidenceLevel: s.evidenceLevel, tier: s.tier })),
    drug,
    herb,
    profile,
    overallStrength
  );

  for (const model of HF_MODELS) {
    const isSumm = model.includes("bart") || model.includes("t5");
    const result = await queryHuggingFace(model, prompt, isSumm);
    if (result && result.length > 80) {
      let calibrated = calibrateLanguage(result, overallStrength);
      calibrated = scrubAbstractStyle(calibrated);
      return { text: calibrated, source: `Evidence-Based Summary (via ${model.split("/")[1]})` };
    }
  }

  // ── Local fallback ──
  return {
    text: generateLocalInteractionSummary(filtered, drug, herb, allAliases),
    source: "Evidence-Based Summary (offline synthesis)",
  };
}

/**
 * Generate an academic research summary for pharmacology/phytochemistry results.
 */
export async function generatePharmacologySummary(
  actions: { name: string; score?: number; pmids?: string[]; mechanisms?: { name: string; pmids?: string[] }[] }[],
  herb: string
): Promise<{ text: string; source: string }> {
  const sorted = [...actions].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const prompt = buildPharmacologyPrompt(sorted, herb);

  for (const model of HF_MODELS) {
    const isSumm = model.includes("bart") || model.includes("t5");
    const result = await queryHuggingFace(model, prompt, isSumm);
    if (result && result.length > 80) {
      const evidenceStrength = sorted[0] && (sorted[0].score ?? 0) >= 80 ? "Moderate-to-Strong" : sorted[0] && (sorted[0].score ?? 0) >= 50 ? "Moderate" : "Limited";
      let calibrated = calibrateLanguage(result, evidenceStrength);
      calibrated = scrubAbstractStyle(calibrated);
      return { text: calibrated, source: `Evidence-Based Summary (via ${model.split("/")[1]})` };
    }
  }

  return {
    text: generateLocalPharmacologySummary(sorted, herb),
    source: "Evidence-Based Summary (offline synthesis)",
  };
}
