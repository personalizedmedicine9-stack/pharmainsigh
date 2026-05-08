import { AlertTriangle, Database, FileText, Globe } from "lucide-react";
import type { StudyResult, FdaDrugData } from "../types";

interface SummaryProps {
  results: StudyResult[];
  drug: string;
  herb: string;
  sourcesUsed: string[];
  fdaData: FdaDrugData | null;
  topCitationCount: number;
  fromCache: boolean;
}

export default function ResultsSummary({ results, drug, herb, sourcesUsed, fdaData, topCitationCount, fromCache }: SummaryProps) {
  return (
    <div className="mb-8 bg-white rounded-2xl border-2 border-gray-200 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Analysis Results</h2>
        {fromCache && <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-bold rounded-full">Served from Cache</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-50 p-5 rounded-xl border-2 border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <Database className="text-blue-600" size={20} />
            <h3 className="font-bold text-gray-700">Data Sources</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {sourcesUsed.map((source) => (
              <span key={source} className="px-2 py-1 bg-white border-2 border-gray-200 text-xs font-semibold rounded-md text-gray-600">
                {source}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 p-5 rounded-xl border-2 border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="text-indigo-600" size={20} />
            <h3 className="font-bold text-gray-700">Studies Found</h3>
          </div>
          <p className="text-3xl font-black text-gray-900">{results.length}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Matching articles retrieved</p>
        </div>

        <div className="bg-gray-50 p-5 rounded-xl border-2 border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="text-emerald-600" size={20} />
            <h3 className="font-bold text-gray-700">Top Citations</h3>
          </div>
          <p className="text-3xl font-black text-gray-900">{topCitationCount}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Highest citation count</p>
        </div>
      </div>

      {fdaData && (
        <div className="mt-6 bg-amber-50 border-2 border-amber-200 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-amber-900">FDA-Associated Safety Signal</h4>
            <p className="text-sm text-amber-800 mt-1">Potential interaction-related safety signals were identified from FDA-associated pharmacovigilance data; however, clinical significance and causality remain incompletely established.</p>
          </div>
        </div>
      )}
    </div>
  );
}