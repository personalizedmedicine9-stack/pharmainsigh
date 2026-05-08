import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf,
  Search,
  FlaskConical,
  Zap,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

import type { PharmacologyResponse } from "../types";

interface Props {
  onSearch: (herb: string) => Promise<PharmacologyResponse | null>;
}

interface MechanismItem {
  name: string;
  pmids?: string[];
}

interface ActionItem {
  name: string;
  pmids?: string[];
  mechanisms?: MechanismItem[];
}

const EVIDENCE_STYLES: Record<string, string> = {
  High: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  Moderate: "bg-amber-100 text-amber-800 border border-amber-200",
  Low: "bg-rose-100 text-rose-800 border border-rose-200",
  "No Evidence": "bg-slate-100 text-slate-500 border border-slate-200",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  High: "bg-blue-100 text-blue-800 border border-blue-200",
  Moderate: "bg-sky-100 text-sky-800 border border-sky-200",
  Low: "bg-slate-100 text-slate-500 border border-slate-200",
};

const EXAMPLE_HERBS = [
  "St. John's Wort",
  "Ginkgo biloba",
  "Turmeric",
  "Ginseng",
  "Milk Thistle",
  "Garlic",
];

export default function PharmacologyPanel({
  onSearch,
}: Props) {
  const [herb, setHerb] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] =
    useState<PharmacologyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSubmit = async (herbName: string) => {
    if (!herbName.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(false);
    setHerb(herbName);

    try {
       const data = await onSearch(herbName.trim());

console.log("FULL API RESPONSE:", data);

if (!data) {
  setError("Search failed. Please try again.");
} else {
  setResult(data);
}
    } catch {
      setError("Search failed. Please try again.");
    }

    setLoading(false);
    setSearched(true);
  };

  const handleFormSubmit = (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    handleSubmit(herb);
  };

  // ✅ normalize backend old/new
  const normalizeActions = (
    items: any[]
  ): ActionItem[] => {
    return (items || []).map((item) => {
      if (typeof item === "string") {
        return {
          name: item,
          pmids: [],
          mechanisms: [],
        };
      }

      return {
        name: item.name || "Unknown",
        pmids: item.pmids || [],
        mechanisms: (item.mechanisms || []).map(
          (m: any) => ({
            name:
              typeof m === "string"
                ? m
                : m.name || "Unknown",
            pmids:
              typeof m === "string"
                ? []
                : m.pmids || [],
          })
        ),
      };
    });
  };

  const actions = normalizeActions(
    result?.pharmacological_actions || []
  );

  return (
    <div className="space-y-6">

      {/* Search form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">

        <div className="flex items-center gap-3 mb-5">

          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <Leaf
              size={18}
              className="text-white"
            />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Pharmacology Search
            </h2>

            <p className="text-slate-400 text-sm">
              Enter an herb to explore its
              pharmacological profile from
              PubMed
            </p>
          </div>

        </div>

        <form
          onSubmit={handleFormSubmit}
          className="space-y-4"
        >

          <div className="flex flex-col gap-2">

            <label className="flex items-center gap-2 text-base font-semibold text-slate-600 uppercase tracking-wide">
              <Leaf
                size={15}
                className="text-emerald-500"
              />

              Herb Name
            </label>

            <input
              type="text"
              value={herb}
              onChange={(e) =>
                setHerb(e.target.value)
              }
              placeholder="e.g. Turmeric, Ginkgo biloba, St. John's Wort…"
              required
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all shadow-sm"
            />

          </div>

          <button
            type="submit"
            disabled={
              loading || !herb.trim()
            }
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
          >

            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Searching PubMed…
              </>
            ) : (
              <>
                <Search size={18} />
                Search Pharmacological Profile
              </>
            )}

          </button>

        </form>

        {/* Example herbs */}
        <div className="mt-5">

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Quick examples
          </p>

          <div className="flex flex-wrap gap-2">

            {EXAMPLE_HERBS.map((h) => (
              <button
                key={h}
                onClick={() =>
                  handleSubmit(h)
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
              >

                <Leaf
                  size={12}
                  className="text-emerald-400"
                />

                {h}

              </button>
            ))}

          </div>

        </div>

      </div>

      {/* Error */}
      <AnimatePresence>

        {error && (
          <motion.div
            initial={{
              opacity: 0,
              y: -8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl"
          >

            <AlertTriangle
              size={18}
              className="text-rose-500 flex-shrink-0 mt-0.5"
            />

            <p className="text-rose-700 text-base">
              {error}
            </p>

          </motion.div>
        )}

      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>

        {searched && result && (
          <motion.div
            initial={{
              opacity: 0,
              y: 16,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="space-y-4"
          >

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">

                <div>

                  <div className="flex items-center gap-2 mb-1">
                    <FlaskConical
                      size={18}
                      className="text-emerald-600"
                    />

                    <h3 className="text-lg font-bold text-slate-800">
                      {result.herb}
                    </h3>
                  </div>

                  <p className="text-slate-400 text-sm">
                    Pharmacological profile —
                    PubMed literature analysis
                  </p>

                </div>

                <div className="flex flex-wrap items-center gap-2">

                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      EVIDENCE_STYLES[
                        result.evidence_level
                      ]
                    }`}
                  >
                    {result.evidence_level}{" "}
                    Evidence
                  </span>

                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      CONFIDENCE_STYLES[
                        result.confidence
                      ]
                    }`}
                  >
                    {result.confidence}{" "}
                    Confidence
                  </span>

                  {result.sourcesUsed
                    ?.length > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white">

                      <Zap size={10} />

                      PubMed

                    </span>
                  )}

                </div>

              </div>

              {/* No evidence */}
              {result.evidence_level ===
                "No Evidence" && (
                <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">

                  <AlertTriangle
                    size={18}
                    className="text-slate-400 flex-shrink-0 mt-0.5"
                  />

                  <p className="text-slate-500 text-base">
                    No pharmacological
                    evidence found in
                    PubMed for this herb.
                  </p>

                </div>
              )}

              {/* Actions */}
              {result.evidence_level !==
                "No Evidence" && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">

                  <div className="flex items-center gap-2 mb-4">

                    <CheckCircle
                      size={16}
                      className="text-emerald-600"
                    />

                    <span className="font-semibold text-emerald-800 text-base">
                      Pharmacological
                      Actions &
                      Mechanisms
                    </span>

                  </div>

                  {actions.length > 0 ? (

                    <div className="space-y-4">

                      {actions.map(
                        (
                          action,
                          index
                        ) => (
                          <div
                            key={index}
                            className="bg-white border border-emerald-200 rounded-xl p-3"
                          >

                            {/* Action */}
                            <div className="flex flex-wrap items-center gap-2">

                              <span className="px-2.5 py-1 bg-emerald-100 border border-emerald-200 rounded-lg text-sm text-emerald-800 font-medium capitalize">
                                {action.name}
                              </span>

                              {action.pmids
                                ?.length >
                                0 && (
                                <div className="flex flex-wrap gap-2">

                                  {action.pmids.map(
                                    (
                                      pmid
                                    ) => (
                                      <a
                                        key={
                                          pmid
                                        }
                                        href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs underline text-emerald-700"
                                      >
                                        PMID:
                                        {
                                          pmid
                                        }
                                      </a>
                                    )
                                  )}

                                </div>
                              )}

                            </div>

                            {/* Mechanisms */}
                            {action
                              .mechanisms
                              ?.length >
                              0 && (
                              <div className="mt-3 ml-2 space-y-2">

                                {action.mechanisms.map(
                                  (
                                    mech,
                                    mechIndex
                                  ) => (
                                    <div
                                      key={
                                        mechIndex
                                      }
                                      className="border-l-2 border-blue-200 pl-3"
                                    >

                                      <div className="flex flex-wrap items-center gap-2">

                                        <span className="text-xs text-slate-500">
                                          Mechanism:
                                        </span>

                                        <span className="px-2 py-0.5 bg-blue-100 border border-blue-200 rounded text-xs text-blue-800 uppercase">
                                          {
                                            mech.name
                                          }
                                        </span>

                                      </div>

                                      {mech
                                        .pmids
                                        ?.length >
                                        0 && (
                                        <div className="flex flex-wrap gap-2 mt-1">

                                          {mech.pmids.map(
                                            (
                                              pmid
                                            ) => (
                                              <a
                                                key={
                                                  pmid
                                                }
                                                href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs underline text-blue-700"
                                              >
                                                PMID:
                                                {
                                                  pmid
                                                }
                                              </a>
                                            )
                                          )}

                                        </div>
                                      )}

                                    </div>
                                  )
                                )}

                              </div>
                            )}

                          </div>
                        )
                      )}

                    </div>

                  ) : (
                    <p className="text-emerald-700 text-sm italic">
                      No specific actions
                      extracted from
                      literature.
                    </p>
                  )}

                </div>
              )}

            </div>

            {/* Disclaimer */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 leading-relaxed">

              <strong>
                Research use only.
              </strong>{" "}

              Pharmacological data is
              extracted from PubMed
              literature. Do not use
              for clinical
              decision-making.

            </div>

          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}