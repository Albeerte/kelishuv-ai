import type { CaseRecord, DisputeType, LegalSource } from "./types";

export type Locale = "uz" | "uz-Cyrl" | "ru";
export type AIProvider = "OLLAMA" | "OPENAI_COMPATIBLE" | "RULES";
export type AIProcessingConsent = {
  local: boolean;
  external: boolean;
  at: string;
  version: string;
};
export type PartyPosition = {
  userId: string;
  sharedStatement: string;
  confidentialStatement: string;
  consent: AIProcessingConsent;
  updatedAt: string;
};
export type DocumentExtraction = {
  status: "EXTRACTED" | "REVIEW_REQUIRED";
  text: string;
  method:
    "TEXT" | "PDF_TEXT" | "DOCX_TEXT" | "LOCAL_VISION" | "EXTERNAL_VISION";
  provider: AIProvider;
  model?: string;
  names: string[];
  dates: string[];
  amounts: number[];
  obligations: string[];
  deadlines: string[];
  clauses: string[];
  visibleSignatures: string[];
  warnings: string[];
  extractedAt: string;
  verified: false;
};
export type ProposalKind = "QUICK" | "BALANCED" | "INSTALLMENTS" | "FLEXIBLE";
export type SettlementProposal = {
  id: ProposalKind;
  title: string;
  description: string;
  amount: number;
  schedule: { dueDate: string; amount: number }[];
  deadline: string;
  responsibilities: string[];
  advantages: string[];
  risks: string[];
  conditions: string[];
  sourceIds: string[];
};
export type CaseAIReview = {
  id: string;
  inputHash: string;
  createdAt: string;
  provider: AIProvider;
  model: string;
  category: DisputeType;
  mainIssue: string;
  summary: string;
  claims: string[];
  requestedOutcome: string;
  missingInformation: string[];
  agreedFacts: string[];
  disputedFacts: string[];
  timeline: { date: string; event: string; evidenceId?: string }[];
  contradictions: string[];
  mediationEligibility: string;
  nextStep: string;
  proposals: SettlementProposal[];
  sourceIds: string[];
  warnings: string[];
};
export type PrivateAIReview = {
  id: string;
  userId: string;
  inputHash: string;
  createdAt: string;
  provider: AIProvider;
  model: string;
  observations: string[];
  questions: string[];
  warnings: string[];
};
export type ProposalDecision = {
  userId: string;
  reviewId: string;
  proposalId: ProposalKind;
  decision: "ACCEPT" | "REJECT" | "CHANGES";
  note: string;
  at: string;
};
export type SharedCaseInput = {
  type: DisputeType;
  description: string;
  claimAmount: number;
  statements: {
    userId: string;
    role: "FIRST_PARTY" | "SECOND_PARTY";
    text: string;
  }[];
  evidence: { id: string; name: string; text: string }[];
  sources: LegalSource[];
};
export type AIProcessingOptions = {
  localConsent: boolean;
  externalConsent: boolean;
  locale?: Locale;
  beforeDispatch?: (local: boolean) => Promise<void>;
};
export type AIProviderStatus = {
  provider: AIProvider;
  model: string;
  available: boolean;
  local: boolean;
  message: string;
};

export type SignerRole = "FIRST_PARTY" | "SECOND_PARTY" | "MEDIATOR";
export type AgreementKind = "PROCEDURE" | "SETTLEMENT";
export type AgreementParty = {
  userId: string;
  role: SignerRole;
  fullName: string;
  phone: string;
  address: string;
  identityDetails: string;
};
export type SignatureBox = {
  role: SignerRole;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type AgreementTerms = {
  language?: string;
  durationDays?: number;
  feeTerms?: string;
  confidentiality?: string;
  subject: string;
  agreedTerms: string;
  totalAmount: number;
  currency: "UZS";
  place: string;
  date: string;
  paymentSchedule: {
    id: string;
    amount: number;
    dueDate: string;
    payerId: string;
    payeeId: string;
    description: string;
  }[];
  obligations: {
    id: string;
    title: string;
    dueDate: string;
    assigneeId: string;
    beneficiaryId: string;
  }[];
  responsibilities: string;
  conditions: string;
  sourceIds: string[];
};
export type AgreementReviewReceipt = {
  id: string;
  userId: string;
  contentHash: string;
  pagesSeen: number[];
  at: string;
};
export type AgreementSignature = {
  id: string;
  userId: string;
  role: SignerRole;
  fullName: string;
  method: "HANDWRITTEN";
  pngStorageKey: string;
  imageHash: string;
  contentHash: string;
  reviewReceiptId: string;
  signedAt: string;
  consentVersion: string;
  strokeCount: number;
  pointCount: number;
  canvasWidth: number;
  canvasHeight: number;
};
export type AgreementValidation = {
  field: string;
  severity: "REQUIRED" | "REVIEW";
  message: string;
};
export type AgreementVersion = {
  id: string;
  number: number;
  createdAt: string;
  createdBy: string;
  kind: AgreementKind;
  templateVersion?: 2;
  terms: AgreementTerms;
  participants: AgreementParty[];
  boxes: SignatureBox[];
  contentHash: string;
  pdfHash: string;
  docxHash: string;
  pageCount: number;
  pdfStorageKey: string;
  docxStorageKey: string;
  status: "DRAFT" | "SIGNING" | "SIGNED" | "SUPERSEDED";
  signatures: AgreementSignature[];
  reviews: AgreementReviewReceipt[];
  validation: AgreementValidation[];
  supersededAt?: string;
  lockedAt?: string;
};
export type Agreement = {
  id: string;
  caseId: string;
  kind: AgreementKind;
  createdAt: string;
  createdBy: string;
  currentVersionId: string;
  versions: AgreementVersion[];
};
export type SignatureCapture = {
  dataUrl: string;
  strokeCount: number;
  pointCount: number;
  width: number;
  height: number;
};
export type PaymentReport = {
  id: string;
  versionId?: string;
  requestId: string;
  obligationId: string;
  amount: number;
  reference: string;
  evidenceDocumentId?: string;
  reportedBy: string;
  reportedAt: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  reviewedBy?: string;
  reviewedAt?: string;
  note?: string;
};
export type ExecutionObligation = {
  id: string;
  agreementId: string;
  versionId: string;
  caseId: string;
  type: "PAYMENT" | "ACTION";
  title: string;
  assigneeId: string;
  beneficiaryId: string;
  amount: number;
  dueDate: string;
  status: "PENDING" | "REPORTED" | "COMPLETED";
  reportedAt?: string;
  completedAt?: string;
};
export type CaseExecution = {
  agreementId: string;
  versionId: string;
  obligations: ExecutionObligation[];
  reports: PaymentReport[];
  reminderKeys: string[];
  createdAt: string;
  followup?: {
    requestedBy: string;
    path: "RENEGOTIATE" | "COURT_INFORMATION";
    note: string;
    at: string;
  };
};
export type CaseMessage = {
  id: string;
  requestId?: string;
  senderId: string;
  recipientId?: string;
  visibility: "PARTIES" | "PRIVATE";
  body: string;
  createdAt: string;
};
export type AuditEvent = {
  id: string;
  caseId?: string;
  agreementId?: string;
  versionId?: string;
  actorId: string;
  action: string;
  at: string;
  contentHash?: string;
  artifactHash?: string;
  previousHash?: string;
  hash: string;
  details: Record<string, string | number | boolean>;
};
export type CaseWorkspace = {
  case: CaseRecord;
  participants: AgreementParty[];
  agreements: Agreement[];
  execution?: CaseExecution;
  messages: CaseMessage[];
  aiStatus: AIProviderStatus;
  aiStale: boolean;
  myPosition?: PartyPosition;
  canMediate: boolean;
};
