
export interface ApiConfig {
  provider: 'google' | 'openai' | 'claude' | 'deepseek' | 'qwen' | 'custom';
  baseUrl: string;
  apiKey: string;
  textModel: string;
  customTextModel?: string;
}

export interface Chapter {
  title: string;
  content: string;
  summary?: string;
  role?: string;
  purpose?: string;
  suspense?: string;
  twist?: string;
}

export interface StateArchive {
  chapterNum: number;
  title: string;
  globalSummary: string;
  characterState: string;
  chapterSummary: string;
  timestamp: number;
}

export interface GeneratedData {
  dna: string | null;
  globalSummary: string | null; // Dynamic global summary updated via Sync Context
  characters: string | null;
  world: string | null;
  plot: string | null;
  blueprint: string | null;
  state: string | null;
  chapters: Chapter[];
  stateHistory?: StateArchive[];
}

export interface UserInputs {
  topic: string;
  genre: string;
  tone: string;
  ending: string;
  perspective: string;
  numberOfChapters: number;
  wordCount: number;
  customRequirements: string;
  novelTitle: string;
}

export interface StepDefinition {
  id: keyof GeneratedData | 'init' | 'writing';
  title: string;
  icon: any;
  promptKey?: string;
}

export interface ThemeMatch {
  code: string;
  name: string;
  desc: string;
  level: 'highly_recommended' | 'recommended' | 'not_recommended';
  reason: string;
}
