import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Microscope, Database, AlertTriangle, Globe, Beaker, Leaf, ShieldCheck, FlaskConical, Info, ExternalLink, FileText, Sparkles } from "lucide-react";
import { generateInteractionPDF } from "./utils/pdfExport";
import { generateInteractionSummary } from "./utils/aiSummary";
import SearchForm from "./components/SearchForm";
import StudyCard from "./components/StudyCard";
import ResultsSummary from "./components/Summary";
import FilterBar, { type SortType } from "./components/FilterBar";
import SearchHistory from "./components/SearchHistory";
import PharmacologyPanel from "./components/PharmacologyPanel";
import { supabase } from "./lib/supabase";
import type { StudyResult, SearchResponse, SearchHistoryEntry, FdaDrugData, PharmacologyResponse } from "./types";

type AppMode = "interaction" | "pharmacology";
type FilterType = "All" | "High" | "Moderate" | "Low";

const EVIDENCE_RANK: Record<string, number> = { High: 0, Moderate: 1, Low: 2 };
const JOURNAL_RANK: Record<string, number> = { "High-impact journal": 0, "Medium-impact journal": 1, "Low/uncertain quality": 2 };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const API_SOURCES = [
  { name: "PubMed", desc: "Biomedical Literature", color: "bg-blue-500" },
  { name: "CrossRef", desc: "DOI Resolution", color: "bg-indigo-500" },
  { name: "OpenAlex", desc: "Citation Metrics", color: "bg-violet-500" },
  { name: "OpenFDA", desc: "Drug Safety Labels", color: "bg-amber-500" },
];

const EXAMPLE_SEARCHES = [
  { drug: "Warfarin", herb: "St. John's Wort" },
  { drug: "Cyclosporine", herb: "Ginkgo biloba" },
  { drug: "Metformin", herb: "Ginseng" },
  { drug: "Atorvastatin", herb: "Garlic" },
  { drug: "Tacrolimus", herb: "Curcumin" },
];

const ACTIVE_COMPOUNDS = [
  { name: "Curcumin", herbs: ["turmeric", "curcuma longa"], category: "Curcuminoids" }, { name: "Turmerone", herbs: ["turmeric", "curcuma longa"], category: "Sesquiterpenes" }, { name: "Gingerol", herbs: ["ginger", "zingiber officinale"], category: "Phenols" }, { name: "Shogaol", herbs: ["ginger", "zingiber officinale"], category: "Phenols" }, { name: "Zingerone", herbs: ["ginger", "zingiber officinale"], category: "Phenols" }, { name: "Hypericin", herbs: ["st. john's wort", "hypericum perforatum"], category: "Anthraquinones" }, { name: "Hyperforin", herbs: ["st. john's wort", "hypericum perforatum"], category: "Phthalides" }, { name: "Ginsenosides (Rb1, Rg1)", herbs: ["ginseng", "panax ginseng"], category: "Saponins" }, { name: "Allicin", herbs: ["garlic", "allium sativum"], category: "Sulfur Compounds" }, { name: "S-allyl cysteine", herbs: ["garlic", "allium sativum"], category: "Sulfur Compounds" }, { name: "Silymarin", herbs: ["milk thistle", "silybum marianum"], category: "Flavonolignans" }, { name: "Silibinin", herbs: ["milk thistle", "silybum marianum"], category: "Flavonolignans" }, { name: "Ginkgolides", herbs: ["ginkgo biloba", "ginkgo"], category: "Terpenoids" }, { name: "Bilobalide", herbs: ["ginkgo biloba", "ginkgo"], category: "Terpenoids" }, { name: "Quercetin", herbs: ["onion", "apple", "capers", "berries"], category: "Flavonoids" }, { name: "Rutin", herbs: ["apple", "buckwheat", "citrus"], category: "Flavonoids" }, { name: "Epigallocatechin gallate (EGCG)", herbs: ["green tea", "camellia sinensis"], category: "Catechins" }, { name: "L-theanine", herbs: ["green tea", "camellia sinensis"], category: "Amino Acids" }, { name: "Berberine", herbs: ["berberine", "berberis vulgaris", "goldenseal"], category: "Alkaloids" }, { name: "Withanolides", herbs: ["ashwagandha", "withania somnifera"], category: "Steroidal Lactones" }, { name: "Withaferin A", herbs: ["ashwagandha", "withania somnifera"], category: "Steroidal Lactones" }, { name: "Kavalactones", herbs: ["kava", "piper methysticum"], category: "Lactones" }, { name: "Glycyrrhizin", herbs: ["licorice", "glycyrrhiza glabra"], category: "Saponins" }, { name: "Glabridin", herbs: ["licorice", "glycyrrhiza glabra"], category: "Flavonoids" }, { name: "Echinacoside", herbs: ["echinacea", "echinacea purpurea"], category: "Phenylpropanoids" }, { name: "Valerenic acid", herbs: ["valerian", "valeriana officinalis"], category: "Sesquiterpenes" }, { name: "Vincamine", herbs: ["valerian", "vinca minor"], category: "Alkaloids" }, { name: "Flavonoids", herbs: ["*"], category: "Polyphenols" }, { name: "Alkaloids", herbs: ["*"], category: "Alkaloids" }, { name: "Terpenes", herbs: ["*"], category: "Terpenoids" }, { name: "Tannins", herbs: ["*"], category: "Polyphenols" }, { name: "Essential Oils", herbs: ["*"], category: "Volatile Compounds" },
];

const PHARM_ACTIONS = ["anti-inflammatory", "antioxidant", "antimicrobial", "antifungal", "antiviral", "anticoagulant", "antiplatelet", "antidiabetic", "antihypertensive", "anticancer", "hepatoprotective", "neuroprotective", "cardioprotective", "immunomodulatory", "anxiolytic", "sedative", "analgesic", "antipyretic", "adaptogenic", "antispasmodic", "diuretic", "expectorant", "astringent", "estrogenic"];
const MECH_KEYWORDS = ["nf-kb", "nf-κb", "cyp3a4", "cyp2d6", "cyp2c9", "cyp2c19", "cyp1a2", "p-glycoprotein", "cox-2", "cox-1", "tnf-alpha", "il-6", "il-1", "mtor", "pi3k", "mapk", "erk", "jak-stat", "nrf2", "apoptosis", "autophagy", "oxidative stress", "free radical", "ros", "nitric oxide", "no synthase", "serotonin reuptake", "monoamine oxidase", "acetylcholinesterase", "hmg-coa", "ppar", "amp kinase", "ampk"];
const HERB_ALIASES_FRONT: Record<string, string[]> = { "ginkgo biloba": ["ginkgo", "EGb 761"], "ginseng": ["panax ginseng", "asian ginseng", "korean ginseng", "american ginseng", "ginsenoside"], "curcumin": ["curcumin", "turmeric", "curcuma longa", "diferuloylmethane"], "st. john's wort": ["hypericum perforatum", "saint john's wort", "hypericin", "hyperforin", "st john wort"], "garlic": ["allium sativum", "allicin"], "echinacea": ["echinacea purpurea", "echinacea angustifolia", "coneflower"], "valerian": ["valeriana officinalis"], "milk thistle": ["silybum marianum", "silymarin"], "kava": ["piper methysticum", "kavalactone"], "black cohosh": ["actaea racemosa", "cimicifuga"], "ginger": ["zingiber officinale", "gingerol"], "licorice": ["glycyrrhiza glabra", "glycyrrhizin"], "green tea": ["camellia sinensis", "epigallocatechin", "egcg"], "berberine": ["berberis vulgaris"], "ashwagandha": ["withania somnifera", "withanolide"] };
const HIGH_IMPACT_JOURNALS = ["new england journal of medicine", "nejm", "lancet", "jama", "bmj", "nature", "science", "cell", "annals of internal medicine", "circulation", "journal of the american college of cardiology", "clinical pharmacology", "british journal of clinical pharmacology", "european journal of clinical pharmacology", "drug metabolism", "pharmacotherapy", "journal of clinical pharmacology", "phytomedicine", "journal of ethnopharmacology", "clinical pharmacokinetics", "drug safety", "british journal of pharmacology"];
const MEDIUM_IMPACT_JOURNALS = ["plos", "evidence-based complementary", "complementary therapies", "alternative medicine", "integrative medicine", "herbal medicine", "natural product", "phytotherapy", "pharmacognosy", "frontiers in pharmacology", "molecules", "nutrients", "international journal of molecular sciences", "biomedicines"];

function expandHerbFront(herb: string): string[] {
  const lower = herb.toLowerCase();
  for (const [canonical, aliases] of Object.entries(HERB_ALIASES_FRONT)) {
    if (lower.includes(canonical) || aliases.some((a) => lower.includes(a.toLowerCase()))) return [canonical, ...aliases];
  }
  return [herb];
}

function ConsentPopup({ onAccept }: { onAccept: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ duration: 0.3 }} className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border-2 border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-xl text-blue-600"><ShieldCheck size={24} /></div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Clinical Disclaimer</h2>
            <p className="text-xs text-gray-400 font-medium">Please read before proceeding</p>
          </div>
        </div>
        <div className="space-y-3 mb-6">
          {["Not a substitute for professional medical advice.", "Do not use for diagnosing or treating health problems.", "Always consult a healthcare provider for drug interactions."].map((text, i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              {text}
            </div>
          ))}
        </div>
        <button onClick={onAccept} className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3.5 rounded-xl transition-colors shadow-lg hover:shadow-xl">
          I Understand — Enter Platform
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>("interaction");
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<StudyResult[]>([]);
  const [sourcesUsed, setSourcesUsed] = useState<string[]>([]);
  const [fdaData, setFdaData] = useState<FdaDrugData | null>(null);
  const [topCitationCount, setTopCitationCount] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [lastDrug, setLastDrug] = useState("");
  const [lastHerb, setLastHerb] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [filter, setFilter] = useState<FilterType>("All");
  const [sort, setSort] = useState<SortType>("relevance");
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const interactionReportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (localStorage.getItem("research-consent") === "true") setConsentGiven(true); }, []);
  const handleAcceptConsent = () => { localStorage.setItem("research-consent", "true"); setConsentGiven(true); };

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await supabase.from("search_history").select("*").order("searched_at", { ascending: false }).limit(4);
      if (data) setHistory(data as SearchHistoryEntry[]);
    } catch (err) { console.error(err); }
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Professional PDF Export with hyperlinked sources + AI summary
  const handleExportInteractionPDF = () => {
    generateInteractionPDF(results, lastDrug, lastHerb, sourcesUsed, fdaData, topCitationCount, summary);
  };

  const handleSearch = async (drug: string, herb: string) => {
    let isCancelled = false;
    setLoading(true); setError(null); setResults([]); setHasSearched(false); setFilter("All"); setSort("relevance"); setFdaData(null); setSourcesUsed([]); setFromCache(false);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/drug-herb-search`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ drug, herb }) });
      const data: SearchResponse = await res.json();
      if (isCancelled) return;
      if (!res.ok || data.error) { setError(data.error ?? "Error"); return; }
      setResults(data.results); setSourcesUsed(data.sourcesUsed); setFdaData(data.fdaData); setTopCitationCount(data.topCitationCount); setFromCache(data.fromCache ?? false); setLastDrug(drug); setLastHerb(herb); setHasSearched(true);
      await supabase.from("search_history").delete().eq("drug", drug.trim()).eq("herb", herb.trim());
      await supabase.from("search_history").insert({ drug: drug.trim(), herb: herb.trim(), results_count: data.total, sources_used: data.sourcesUsed, top_citation_count: data.topCitationCount, has_fda_data: !!data.fdaData });
      const { data: all } = await supabase.from("search_history").select("id").order("searched_at", { ascending: false });
      if (all && all.length > 4) await supabase.from("search_history").delete().in("id", all.slice(4).map((r: { id: string }) => r.id));
      loadHistory();
    } catch { if (!isCancelled) setError("Network error."); } finally { if (!isCancelled) setLoading(false); }
  };

  const handlePharmacologySearch = async (herb: string): Promise<PharmacologyResponse | null> => {
    try {
      const herbTerms = expandHerbFront(herb);
      const herbQuery = herbTerms.map((t) => `"${t}"[Title/Abstract]`).join(" OR ");
      const query = `(${herbQuery}) AND (pharmacological effects[Title/Abstract] OR mechanism[Title/Abstract] OR biological activity[Title/Abstract])`;
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=30&retmode=json&sort=relevance&tool=DrugHerbPlatform&email=research@example.com`;
      const searchRes = await fetch(searchUrl); if (!searchRes.ok) return null;
      const searchData = await searchRes.json(); const ids: string[] = searchData?.esearchresult?.idlist ?? [];
      if (ids.length === 0) return { herb, pharmacological_actions: [], evidence_level: "No Evidence", confidence: "Low", sourcesUsed: [], noEvidenceMessage: "No evidence found." };
      const fetchRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml&tool=DrugHerbPlatform`); if (!fetchRes.ok) return null;
      const xml = await fetchRes.text(); const articles: any[] = [];
      for (const chunk of xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? []) {
        const pmid = chunk.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] ?? "";
        const title = chunk.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
        const journal = chunk.match(/<ISOAbbreviation>([\s\S]*?)<\/ISOAbbreviation>/)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? chunk.match(/<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
        const abstract = [...chunk.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map(m => m[1].replace(/<[^>]+>/g, "").trim()).join(" ");
        if (pmid && title) articles.push({ pmid, title, abstract, journal });
      }
      const herbLower = herb.trim().toLowerCase();
      const active_compounds = ACTIVE_COMPOUNDS.filter(c => c.herbs.includes("*") || c.herbs.some(h => herbLower.includes(h))).map(c => { 
        const baseName = c.name.split('(')[0].trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${baseName}\\b`, "i"); 
        const matched = articles.filter(a => regex.test(a.title + " " + a.abstract)); 
        return matched.length > 0 ? { name: c.name, category: c.category, pmids: matched.slice(0, 3).map(a => a.pmid) } : null; 
      }).filter(Boolean);

      const scoreArticle = (a: any) => { const t = (a.title + " " + a.abstract).toLowerCase(); const j = a.journal.toLowerCase(); let ts = 5; if (t.includes("meta-analysis") || t.includes("meta analysis")) ts = 50; else if (t.includes("systematic review")) ts = 48; else if (t.includes("randomized controlled") || /\brct\b/.test(t)) ts = 45; else if (t.includes("cohort study") || t.includes("prospective study")) ts = 35; else if (/\brat\b|\bmice\b|\bin vivo\b/.test(t)) ts = 15; let ss = 0; const sm = t.match(/(?:n\s*=\s*)(\d{1,4}(?:,\d{3})*)/i); if (sm) { const n = parseInt(sm[1].replace(/,/g, "")); if (n >= 200) ss = 30; else if (n >= 100) ss = 25; else if (n >= 50) ss = 15; else if (n >= 20) ss = 10; else ss = 5; } let js = 0; if (HIGH_IMPACT_JOURNALS.some(j => j.includes(j))) js = 20; else if (MEDIUM_IMPACT_JOURNALS.some(j => j.includes(j))) js = 10; return ts + ss + js; };

      const actions = PHARM_ACTIONS.map(action => { const regex = new RegExp(`\\b${action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"); const matched = articles.filter(a => regex.test(a.title + " " + a.abstract)); if (matched.length === 0) return null; const score = Math.max(...matched.map(scoreArticle)); const mechanisms = MECH_KEYWORDS.map(m => { const mr = new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"); const mm = matched.filter(a => mr.test(a.title + " " + a.abstract)); return mm.length > 0 ? { name: m, pmids: mm.map(a => a.pmid) } : null; }).filter(Boolean); return { name: action, pmids: matched.slice(0, 3).map(a => a.pmid), score, mechanisms }; }).filter(Boolean);

      const bestScore = actions.length > 0 ? Math.max(...actions.map(a => a.score)) : 0;
      const conf: "High" | "Moderate" | "Low" = bestScore >= 80 ? "High" : bestScore >= 50 ? "Moderate" : "Low";
      let ev: "High" | "Moderate" | "Low" | "No Evidence" = "Low"; if (actions.length === 0) ev = "No Evidence"; else if (bestScore >= 80) ev = "High"; else if (bestScore >= 50) ev = "Moderate";
      return { herb, pharmacological_actions: actions, active_compounds, evidence_level: ev, confidence: conf, sourcesUsed: ["PubMed"] };
    } catch (err) { console.error(err); return null; }
  };

  const sortedFiltered = useMemo(() => results.filter((r) => filter === "All" || r.evidenceLevel === filter).slice().sort((a, b) => { switch (sort) { case "citations": return b.citationCount - a.citationCount; case "evidence": return EVIDENCE_RANK[a.evidenceLevel] - EVIDENCE_RANK[b.evidenceLevel]; case "journal": return JOURNAL_RANK[a.journalQuality] - JOURNAL_RANK[b.journalQuality]; case "year": return (parseInt(b.pubYear) || 0) - (parseInt(a.pubYear) || 0); case "relevance": return b.relevanceScore - a.relevanceScore; default: return b.compositeScore - a.compositeScore; } }), [results, filter, sort]);

  const handleInteractionSummary = async () => {
    if (sortedFiltered.length === 0) return;
    setLoadingSummary(true); setSummaryError(null); setSummary(null);
    try {
      const { text } = await generateInteractionSummary(
        sortedFiltered.slice(0, 10),
        lastDrug,
        lastHerb
      );
      setSummary(text);
    } catch (err: any) {
      setSummaryError(err.message || "An error occurred while generating summary.");
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <>
     <AnimatePresence>{!consentGiven && <ConsentPopup onAccept={handleAcceptConsent} />}</AnimatePresence>
      
      <div className="min-h-screen bg-[#f8fafc] text-gray-900 antialiased">
        <header className="bg-white/90 backdrop-blur-xl border-b-2 border-gray-100 sticky top-0 z-10 shadow-sm">
          <div className="max-w-full md:max-w-5xl lg:max-w-6xl mx-auto px-4 md:px-8 lg:px-12 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shadow-sm"><Microscope size={18} className="text-white" /></div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight text-gray-900">PharmaInsight</h1>
                <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Evidence-Based Intelligence</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              {API_SOURCES.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border-2 border-gray-200 rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${s.color}`}></div>
                  <span className="text-xs font-bold text-gray-700">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </header>

        <main className="max-w-full md:max-w-5xl lg:max-w-6xl mx-auto px-4 md:px-8 lg:px-12 py-10">
          <div className="flex justify-center mb-10">
            <div className="inline-flex p-1.5 bg-white border-2 border-gray-200 rounded-2xl shadow-xl gap-1">
              <button type="button" onClick={() => setAppMode("interaction")} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${appMode === "interaction" ? "bg-red-600 text-white shadow-md" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"}`}>
                <AlertTriangle size={15} /> Drug–Natural Product Interaction
              </button>
              <button type="button" onClick={() => setAppMode("pharmacology")} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${appMode === "pharmacology" ? "bg-emerald-600 text-white shadow-md" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"}`}>
                <FlaskConical size={15} /> Pharmacology & Phytochemistry
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {appMode === "pharmacology" && (
              <motion.div key="pharm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                <PharmacologyPanel onSearch={handlePharmacologySearch} />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {appMode === "interaction" && (
              <motion.div key="int" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                
                <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl p-6 md:p-8 mb-8">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    {API_SOURCES.map((s) => (
                      <div key={s.name} className="bg-gray-50 border-2 border-gray-100 p-4 rounded-xl">
                        <div className="flex items-center gap-2 mb-1"><div className={`w-2 h-2 rounded-full ${s.color}`}></div><span className="text-sm font-bold text-gray-900">{s.name}</span></div>
                        <p className="text-xs text-gray-500 pl-4 font-medium">{s.desc}</p>
                      </div>
                    ))}
                  </div>
                  <SearchForm onSearch={handleSearch} loading={loading} />
                  <div className="mt-6 bg-gray-900 border-2 border-gray-800 p-5 rounded-xl shadow-xl">
                    <div className="flex items-start gap-3">
                      <Info size={18} className="text-white mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-gray-300 leading-relaxed">
                        <span className="font-extrabold text-white">Clinical Protocol: </span> 
                        Enter <strong className="text-white">Generic Drug Name</strong> (e.g., Warfarin) and <strong className="text-white">Natural Product Name</strong> (e.g., Garlic). The engine queries overlapping literature, resolves DOIs, retrieves citations, and identifies FDA-associated safety signals.
                      </div>
                    </div>
                  </div>
                  <SearchHistory history={history} onRerun={handleSearch} />
                </div>

                <AnimatePresence>{error && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-start gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl shadow-sm mb-6"><AlertTriangle size={18} className="text-red-600 mt-0.5" /><p className="text-red-800 text-sm font-bold">{error}</p></motion.div>)}</AnimatePresence>

                <AnimatePresence>
                  {hasSearched && results.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                      
                      <div className="no-print flex flex-col sm:flex-row gap-3 mb-6">
                        <button onClick={handleExportInteractionPDF} className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-white border-2 border-gray-300 hover:border-gray-900 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
                          <FileText size={18} /> Export Interaction PDF
                        </button>
                        <button onClick={handleInteractionSummary} disabled={loadingSummary} className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 rounded-xl text-sm font-bold text-white transition-all shadow-sm">
                          {loadingSummary ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating Evidence-Based Findings…</>
                          ) : (
                            <><Sparkles size={18} /> Generate Evidence-Based Findings</>
                          )}
                        </button>
                      </div>

                      <AnimatePresence>
                        {summary && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="no-print bg-rose-50 border border-rose-200 rounded-xl shadow-sm mb-6 overflow-hidden">
                            <div className="px-6 pt-5 pb-3 flex items-center gap-2 border-b border-rose-200">
                              <Sparkles size={18} className="text-rose-700" />
                              <h4 className="text-base font-bold text-black uppercase tracking-wider">Interaction Findings Summary</h4>
                            </div>
                            <div className="px-6 py-4 space-y-4">
                              {(() => {
                                const parts = summary.split(/Evidence Profile:/i);
                                const synthesisText = parts[0]?.trim() || "";
                                const profileText = parts[1]?.trim() || "";
                                return (
                                  <>
                                    <div className="text-black text-sm leading-relaxed font-medium">
                                      {synthesisText}
                                    </div>
                                    {profileText && (
                                      <div className="pt-3 border-t border-rose-200">
                                        <div className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2">Evidence Profile</div>
                                        <div className="text-black text-xs leading-relaxed whitespace-pre-line font-mono">
                                          {profileText}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {summaryError && (
                        <div className="no-print flex items-start gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl mb-6"><AlertTriangle size={16} className="text-red-500 mt-0.5" /><p className="text-red-700 text-sm font-bold">{summaryError}</p></div>
                      )}

                      <div ref={interactionReportRef} id="interaction-report" className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl p-6 md:p-8">
                        <ResultsSummary results={results} drug={lastDrug} herb={lastHerb} sourcesUsed={sourcesUsed} fdaData={fdaData} topCitationCount={topCitationCount} fromCache={fromCache} />
                        <div className="mt-4 mb-6"><FilterBar results={results} filter={filter} sort={sort} onFilterChange={setFilter} onSortChange={setSort} /></div>
                        <div className="space-y-4">
                          {sortedFiltered.map((study, i) => (
                            <motion.div key={study.pmid} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: i * 0.03 }}><StudyCard study={study} index={i} /></motion.div>
                          ))}
                          {sortedFiltered.length === 0 && (<div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-gray-200 text-sm text-gray-500 font-bold">No studies match the selected filter.</div>)}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {hasSearched && results.length === 0 && !error && (
                  <div className="text-center py-20 bg-white rounded-2xl border-2 border-gray-200 shadow-xl">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Microscope size={28} className="text-gray-300" /></div>
                    <h3 className="text-lg font-black text-gray-700 mb-2">No Evidence Found</h3>
                    <p className="text-sm text-gray-500 max-w-md mx-auto font-medium">No published studies were found for this combination. Try generic names or Latin alternatives.</p>
                  </div>
                )}

                {!hasSearched && !loading && !error && (
                  <div className="space-y-10 mt-4">
                    <div className="text-center py-20 bg-white rounded-3xl border-2 border-gray-200 shadow-2xl overflow-hidden relative">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-50 via-transparent to-transparent"></div>
                      <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2 rounded-full text-xs font-extrabold mb-8 tracking-widest shadow-md">REAL-TIME API INTEGRATION</div>
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight leading-tight">Precision Literature<br/>Mining Engine</h2>
                        <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed mb-10 text-lg font-medium">Evaluate any drug-herb combination against global scientific databases. Instantly retrieve DOI links, citation metrics, and FDA-associated safety data.</p>
                        <div className="flex justify-center gap-4 flex-wrap">
                          <span className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-xs font-extrabold tracking-widest shadow-lg border-2 border-gray-800">ZERO AI HALLUCINATIONS</span>
                          <span className="px-5 py-2.5 bg-white border-2 border-gray-900 text-gray-900 rounded-lg text-xs font-extrabold tracking-widest">EVIDENCE-BASED ONLY</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Clinical Query Examples</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {EXAMPLE_SEARCHES.map(({ drug, herb }) => (
                          <button key={drug + herb} type="button" onClick={() => handleSearch(drug, herb)} className="group bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-md hover:shadow-2xl hover:border-gray-900 transition-all duration-300 text-left">
                            <div className="flex items-center gap-2 mb-2 text-base font-extrabold text-gray-900"><Beaker size={16} className="text-blue-600" />{drug}</div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium"><Leaf size={16} className="text-emerald-500" />{herb}</div>
                            <div className="mt-4 text-xs font-extrabold text-gray-900 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Analyze Interaction <ExternalLink size={12}/></div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="border-t-2 border-gray-100 mt-20 py-8 text-center bg-white">
          <p className="text-xs text-gray-400 font-bold">© {new Date().getFullYear()} PharmaInsight (Dr. Mahmoud Mostafa) · Data: NCBI, CrossRef, OpenAlex, OpenFDA · Research Use Only</p>
        </footer>
      </div>
    </>
  );
}