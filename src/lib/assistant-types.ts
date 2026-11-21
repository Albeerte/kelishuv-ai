export type AssistantUsage = { limit: number; used: number; remaining: number };
export type AssistantSource = {
  id: string;
  title: string;
  article: string;
  summary: string;
  url: string;
  editionDate?: string;
  verifiedAt: string;
  originalLanguage: "uz";
  kind?: "LAW" | "COURT_PRACTICE" | "PLENUM";
  snapshotDate?: string;
  current?: boolean;
};
export type AssistantReply = {
  answer: string;
  steps: string[];
  sources: AssistantSource[];
  links: { title: string; href: string }[];
  mode: string;
  usage?: AssistantUsage;
  retrieval?: {
    documents: number;
    articles: number;
    semantic: boolean;
    live: boolean;
    courtSources: number;
  };
};
export type AssistantRequestRecord = {
  id: string;
  subject: string;
  requestId: string;
  hash: string;
  attemptId: string;
  status: "PENDING" | "COMPLETE" | "FAILED";
  startedAt: string;
  completedAt?: string;
  reply?: AssistantReply;
};
