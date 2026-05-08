export type EvidenceLevel = "High" | "Moderate" | "Low";
export type JournalQuality = "High-impact journal" | "Medium-impact journal" | "Low/uncertain quality";
export type RelevanceLabel = "HIGH" | "MEDIUM" | "LOW";
export type SeverityLevel = "Major" | "Moderate" | "Minor" | "Unknown";
export type InteractionType = "Pharmacokinetic" | "Pharmacodynamic" | "Mixed" | "Unknown";
export type ClinicalRelevance = "Human Clinical" | "Animal/In Vitro" | "Unknown";
export type EvidenceConsistency = "Consistent" | "Conflicting" | "Insufficient";
export type ConfidenceLevel = "High" | "Moderate" | "Low";

export interface StudyResult {
  title: string;
  source: "PubMed";
  pubmedLink: string;
  pmid: string;
  doi?: string;
  doiLink?: string;
  journal: string;
  pubYear: string;
  authors: string[];
  abstract: string;
  citationCount: number;
  studyType: string;
  evidenceLevel: EvidenceLevel;
  journalQuality: JournalQuality;
  relevanceLabel: RelevanceLabel;
  relevanceScore: number;
  compositeScore: number;
  fdaWarnings: string[];
  // Extended fields
  severity: SeverityLevel;
  interactionType: InteractionType;
  clinicalRelevance: ClinicalRelevance;
  confidence: ConfidenceLevel;
}

export interface FdaDrugData {
  warnings: string[];
  interactions: string[];
  brandNames: string[];
}

export interface SearchResponse {
  results: StudyResult[];
  total: number;
  sourcesUsed: string[];
  fdaData: FdaDrugData | null;
  topCitationCount: number;
  fromCache: boolean;
  evidenceConsistency?: EvidenceConsistency;
  noEvidenceMessage?: string;
  error?: string;
}

interface PharmacologyResponse {
  herb: string;
  pharmacological_actions: { name: string; pmids: string[]; score: number; mechanisms: { name: string; pmids: string[] }[] }[];
  active_compounds: { name: string; category: string; pmids: string[] }[];
  evidence_level: "High" | "Moderate" | "Low" | "No Evidence";
  confidence: "High" | "Moderate" | "Low";
  sourcesUsed: string[];
  noEvidenceMessage?: string;
  error?: string;
}
export interface SearchHistoryEntry {
  id: string;
  drug: string;
  herb: string;
  results_count: number;
  searched_at: string;
  sources_used: string[];
  top_citation_count: number;
  has_fda_data: boolean;
}
