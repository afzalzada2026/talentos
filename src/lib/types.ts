export type ProviderId = "groq" | "gemini" | "openrouter" | "cerebras" | "nararouter";

export interface Settings {
  provider: ProviderId;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface CandidateSummary {
  cvName: string;
  candidateName: string;
  currentTitle: string;
  currentOrg: string;
  relevantExp: string;
  qualifications: string;
  email: string;
  phone: string;
  score: number;
  why: string;
}

export interface CvBlock {
  name: string;
  text: string;
}

export const LEVELS = [
  "Intern / Trainee",
  "Entry Level (L1)",
  "Associate (L2)",
  "Senior (L3)",
  "Lead / Principal (L4)",
  "Assistant Manager (M1)",
  "Manager (M2)",
  "Senior Manager (M3)",
  "Head / Director",
  "Executive (C-Suite)",
] as const;

export interface JDLibItem {
  id: string;
  title: string;
  division: string;
  level: string;
  md: string;
  at: string;
}
