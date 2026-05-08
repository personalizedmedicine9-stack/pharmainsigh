import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FlaskConical, AlertTriangle, CheckCircle, Atom, ExternalLink, Info, FileText, Sparkles } from "lucide-react";
import { generatePharmacologyPDF } from "../utils/pdfExport";
import { generatePharmacologySummary } from "../utils/aiSummary";
import type { PharmacologyResponse } from "../types";

interface Props { onSearch: (herb: string) => Promise<PharmacologyResponse | null>; }
interface MechanismItem { name: string; pmids?: string[]; }
interface ActionItem { name: string; pmids?: string[]; score?: number; mechanisms?: MechanismItem[]; }

const EXAMPLE_HERBS = ["St. John's Wort", "Ginkgo biloba", "Turmeric", "Ginseng", "Milk Thistle", "Garlic"];
const GENERIC_CLASSES = ["Flavonoids", "Alkaloids", "Terpenes", "Tannins", "Essential Oils"];

export default function PharmacologyPanel({ onSearch }: Props) {
  const [herb, setHerb] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PharmacologyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  const actions = useMemo<ActionItem[]>(() => {
    return (result?.pharmacological_actions || []).map((item: any) => {
      if (typeof item === "string") return { name: item, pmids: [], score: 0, mechanisms: [] };
      return {
        name: item.name || "Unknown", pmids: item.pmids || [], score: item.score || 0,
        mechanisms: (item.mechanisms || []).map((m: any) => ({ name: typeof m === "string" ? m : m.name || "Unknown", pmids: typeof m === "string" ? [] : m.pmids || [] })),
      };
    });
  }, [result?.pharmacological_actions]);

  const handleSubmit = async (herbName: string) => {
    if (!herbName.trim()) return;
    let isCancelled = false;
    setLoading(true); setError(null); setResult(null); setSearched(false); setHerb(herbName);
    setSummary(null); setSummaryError(null);
    try {
       const data = await onSearch(herbName.trim());
       if (isCancelled) return;
       if (!data) setError("Failed to fetch data."); else setResult(data);
    } catch { if (!isCancelled) setError("Network error."); } 
    finally { if (!isCancelled) { setLoading(false); setSearched(true); } }
  };

  const handleFormSubmit = (e: React.FormEvent) => { e.preventDefault(); handleSubmit(herb); };

  // Professional PDF Export with hyperlinked sources + AI summary
  const handleExportPDF = () => {
    if (!result) return;
    generatePharmacologyPDF({
      herb: result.herb,
      pharmacological_actions: actions.map((a) => ({
        name: a.name,
        pmids: a.pmids,
        score: a.score,
        mechanisms: a.mechanisms?.map((m) => ({ name: m.name, pmids: m.pmids })),
      })),
      active_compounds: result.active_compounds ?? [],
      evidence_level: result.evidence_level,
      confidence: result.confidence,
      sourcesUsed: result.sourcesUsed,
    }, summary);
  };

  const handleGenerateSummary = async () => {
    if (!actions || actions.length === 0) return;
    setLoadingSummary(true); setSummaryError(null); setSummary(null);
    try {
      const { text } = await generatePharmacologySummary(
        actions.map((a) => ({
          name: a.name,
          score: a.score,
          pmids: a.pmids,
          mechanisms: a.mechanisms?.map((m) => ({ name: m.name, pmids: m.pmids })),
        })),
        result?.herb ?? ""
      );
      setSummary(text);
    } catch (err: any) {
      setSummaryError(err.message || "An error occurred while generating summary.");
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <div className="space-y-6 w-full font-sans">
      <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6 pb-5 border-b-2 border-gray-100">
          <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-sm"><FlaskConical size={24} /></div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Pharmacological Actions & Phytochemistry</h2>
            <p className="text-gray-500 text-sm font-semibold mt-1">Analyze biochemical activities and active compounds via PubMed literature mining</p>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Natural Product Name (Common or Latin)</label>
            <input type="text" value={herb} onChange={(e) => setHerb(e.target.value)} placeholder="e.g. Panax Ginseng, Curcuma longa, Ginkgo biloba…" required className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-900 text-base placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-emerald-600 transition-all font-semibold" />
          </div>
          <button type="submit" disabled={loading || !herb.trim()} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg text-base tracking-wide uppercase">
            {loading ? (<><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analyzing Literature…</>) : (<><Search size={18} /> Run Analysis</>)}
          </button>
        </form>

        <div className="mt-6 bg-emerald-900 border-2 border-emerald-800 p-5 rounded-xl shadow-xl">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-emerald-300 mt-0.5 flex-shrink-0" />
            <div className="text-base text-emerald-200 leading-relaxed">
              <span className="font-bold text-white">Phytochemical Analysis Protocol: </span> 
              Enter the <strong className="text-white">Natural Product Name</strong>. The engine mines PubMed for pharmacological actions (e.g., anti-inflammatory), specific active compounds (e.g., Curcumin), and molecular mechanisms (e.g., COX-2 inhibition). Results are ranked by an evidence scoring algorithm.
            </div>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Examples</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_HERBS.map((h) => (
              <button key={h} type="button" onClick={() => handleSubmit(h)} className="px-3.5 py-1.5 bg-gray-100 hover:bg-emerald-50 border-2 border-gray-200 hover:border-emerald-600 rounded-lg text-sm text-gray-600 hover:text-emerald-700 transition-all font-bold">{h}</button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl shadow-sm">
            <AlertTriangle size={18} className="text-red-600 mt-0.5" /><p className="text-red-800 text-base font-bold">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {searched && result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
            
            {actions.length > 0 && (
              <div className="no-print flex flex-col sm:flex-row gap-3">
                <button onClick={handleExportPDF} className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-white border-2 border-gray-300 hover:border-gray-900 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
                  <FileText size={18} /> Export as PDF Report
                </button>
                <button onClick={handleGenerateSummary} disabled={loadingSummary} className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 rounded-xl text-sm font-bold text-white transition-all shadow-sm">
                  {loadingSummary ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating Evidence-Based Findings…</>
                  ) : (
                    <><Sparkles size={18} /> Generate Evidence-Based Findings (Free)</>
                  )}
                </button>
              </div>
            )}

            <AnimatePresence>
              {summary && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="no-print bg-green-50 border border-green-200 rounded-xl shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="px-6 pt-5 pb-3 flex items-center gap-2 border-b border-green-200">
                    <Sparkles size={18} className="text-green-700" />
                    <h4 className="text-base font-bold text-black uppercase tracking-wider">Pharmacological Findings Summary</h4>
                  </div>
                  <div className="px-6 py-4 space-y-4">
                    {(() => {
                      const parts = summary.split(/Evidence Profile:/i);
                      const synthesisText = parts[0]?.trim() || "";
                      const profileText = parts[1]?.trim() || "";
                      return (
                        <>
                          {/* Synthesis text */}
                          <div className="text-black text-sm leading-relaxed font-medium">
                            {synthesisText}
                          </div>

                          {/* Phytochemical Profile — rendered dynamically from result data */}
                          {(() => {
                            const specificCompounds = (result?.active_compounds ?? []).filter(c => !GENERIC_CLASSES.includes(c.name));
                            const broadClasses = (result?.active_compounds ?? []).filter(c => GENERIC_CLASSES.includes(c.name));
                            const allMechanisms = actions.flatMap(a => a.mechanisms ?? []).map(m => m.name);

                            if (specificCompounds.length === 0 && broadClasses.length === 0 && allMechanisms.length === 0) return null;

                            return (
                              <div className="pt-3 border-t border-green-200">
                                <div className="text-xs font-bold text-green-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <Atom size={13} className="text-green-700" />
                                  Phytochemical Profile
                                </div>
                                <div className="space-y-2">
                                  {/* Major Active Compounds */}
                                  {specificCompounds.length > 0 && (
                                    <div>
                                      <span className="text-xs font-bold text-black">Major Active Compounds: </span>
                                      <span className="text-xs text-black font-medium">
                                        {specificCompounds.map(c => c.name).join(" · ")}
                                      </span>
                                    </div>
                                  )}
                                  {/* Key Phytochemical Classes */}
                                  {broadClasses.length > 0 && (
                                    <div>
                                      <span className="text-xs font-bold text-black">Key Phytochemical Classes: </span>
                                      <span className="text-xs text-black font-medium">
                                        {broadClasses.map(c => c.name).join(" · ")}
                                      </span>
                                    </div>
                                  )}
                                  {/* Representative Bioactive Constituents (from mechanisms) */}
                                  {allMechanisms.length > 0 && (
                                    <div>
                                      <span className="text-xs font-bold text-black">Representative Bioactive Constituents: </span>
                                      <span className="text-xs text-black font-medium">
                                        {[...new Set(allMechanisms)].slice(0, 8).join(" · ")}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Evidence Profile */}
                          {profileText && (
                            <div className="pt-3 border-t border-green-200">
                              <div className="text-xs font-bold text-green-800 uppercase tracking-wider mb-2">Evidence Profile</div>
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
              <div className="flex items-start gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl"><AlertTriangle size={16} className="text-red-500 mt-0.5" /><p className="text-red-700 text-sm font-bold">{summaryError}</p></div>
            )}

            <div ref={reportRef} id="pdf-report" className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b-2 border-gray-100">
                <div>
                  <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{result.herb}</h3>
                  <p className="text-gray-400 text-sm font-bold mt-1 uppercase tracking-widest">Peer-reviewed biochemical analysis</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 text-sm font-bold tracking-wider ${result.evidence_level === "High" ? "bg-emerald-50 text-emerald-800 border-emerald-300" : result.evidence_level === "Moderate" ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-gray-100 text-gray-500 border-gray-300"}`}>
                    <CheckCircle size={14} /> {result.evidence_level} EVIDENCE
                  </div>
                  <div className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 text-sm font-bold tracking-wider ${result.confidence === "High" ? "bg-emerald-600 text-white border-emerald-700" : result.confidence === "Moderate" ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-gray-200 text-gray-600 border-gray-300"}`}>
                    <CheckCircle size={14} /> {result.confidence} CONFIDENCE
                  </div>
                </div>
              </div>

              {result.evidence_level === "No Evidence" ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <AlertTriangle size={40} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-bold text-lg">{result.noEvidenceMessage || "No evidence found."}</p>
                </div>
              ) : (
                <div className="space-y-10 pt-6">
                  
                  {result.active_compounds && result.active_compounds.length > 0 && (
                    <div>
                      {result.active_compounds.filter(c => !GENERIC_CLASSES.includes(c.name)).length > 0 && (
                        <>
                          <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 uppercase tracking-widest">
                            <Atom size={16} className="text-emerald-600" /> Specific Active Compounds
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {result.active_compounds.filter(c => !GENERIC_CLASSES.includes(c.name)).map((comp, index) => (
                              <div key={index} className="relative p-5 bg-white border-2 border-gray-200 rounded-xl group hover:border-emerald-600 hover:shadow-xl transition-all duration-200 overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-emerald-600"></div>
                                <div className="pl-3">
                                  <div className="font-bold text-gray-900 text-base mb-2">{comp.name}</div>
                                  <div className="inline-flex items-center px-3 py-1 bg-emerald-900 text-white rounded text-xs font-bold tracking-wider mb-3">{comp.category}</div>
                                  {comp.pmids && comp.pmids.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                      {comp.pmids.map((pmid) => (
                                        <a key={pmid} href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-700 hover:text-emerald-900 hover:underline font-semibold font-mono flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded">
                                          <ExternalLink size={11}/>PMID: {pmid}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {result.active_compounds.filter(c => GENERIC_CLASSES.includes(c.name)).length > 0 && (
                        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-4">
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Broad Chemical Classes Also Detected</p>
                          <div className="flex flex-wrap gap-2">
                            {result.active_compounds.filter(c => GENERIC_CLASSES.includes(c.name)).map((comp, index) => (
                              <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
                                <span className="text-sm font-bold text-gray-600">{comp.name}</span>
                                <span className="text-xs text-gray-400 font-mono font-semibold">({comp.pmids?.length || 0} refs)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 uppercase tracking-widest">
                        <CheckCircle size={16} className="text-emerald-600" /> Actions & Mechanisms
                      </h4>
                      <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-md border-2 border-gray-200 font-mono font-bold hidden sm:block">
                        ALGO: TYPE(50) + SAMPLE(30) + JOURNAL(20)
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      {actions.length > 0 ? actions.map((action, index) => (
                        <div key={index} className={`bg-white border-2 border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-200 border-l-8 ${action.score >= 80 ? "border-l-emerald-600" : action.score >= 50 ? "border-l-emerald-300" : "border-l-gray-300"}`}>
                          
                          <div className="p-6 flex items-start gap-6">
                            <div className="relative w-20 h-20 flex-shrink-0 bg-gray-50 rounded-xl border-2 border-gray-100 flex items-center justify-center">
                              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f3f4f6" strokeWidth="2.5" />
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={`${action.score || 0}, 100`} className={action.score >= 80 ? "text-emerald-600" : action.score >= 50 ? "text-emerald-400" : "text-gray-300"} strokeLinecap="round" />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-gray-500">{action.score}</span>
                            </div>

                            <div className="flex-1 min-w-0 pt-1">
                              <div className="flex flex-wrap items-center gap-4 mb-4">
                                <span className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-lg font-bold capitalize">{action.name}</span>
                                <span className={`text-sm font-bold px-3 py-1.5 rounded-lg tracking-wider ${action.score >= 80 ? "bg-emerald-600 text-white" : action.score >= 50 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                  {action.score >= 80 ? "STRONG" : action.score >= 50 ? "MODERATE" : "WEAK"}
                                </span>
                              </div>
                              {action.pmids?.length > 0 && (
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  {action.pmids.map((pmid) => (
                                    <a key={pmid} href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noopener noreferrer" className="text-base text-emerald-700 hover:text-emerald-900 hover:underline font-semibold font-mono flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md">
                                      <ExternalLink size={13}/>{pmid}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {action.mechanisms?.length > 0 && (
                            <div className="px-6 pb-6 ml-20 border-t-2 border-gray-100 pt-5 bg-gray-50/50">
                              <div className="space-y-3">
                                {action.mechanisms.map((mech, mechIndex) => (
                                  <div key={mechIndex} className="flex items-center gap-4 bg-white p-4 rounded-xl border-2 border-gray-100 hover:border-gray-200 transition-colors">
                                    <span className="text-xs font-bold text-gray-400 uppercase w-16 flex-shrink-0">MECH</span>
                                    <span className="text-base text-gray-800 font-bold font-mono uppercase">{mech.name}</span>
                                    <div className="ml-auto flex gap-3">
                                      {mech.pmids?.slice(0, 2).map((pmid) => (
                                        <a key={pmid} href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-700 hover:underline font-semibold font-mono flex items-center gap-1"><ExternalLink size={11}/>{pmid}</a>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )) : (
                        <p className="text-gray-500 text-base italic bg-gray-50 p-8 rounded-xl text-center font-semibold border-2 border-dashed border-gray-300">No specific actions extracted.</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="border-t-2 border-gray-100 pt-4 mt-10 text-center">
                    <p className="text-xs text-gray-400 font-bold">Generated by PharmaInsight (Dr. Mahmoud Mostafa) · Data: NCBI PubMed · Research Use Only</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}