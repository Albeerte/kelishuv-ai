import type {
  Agreement,
  AuditEvent,
  CaseAIReview,
  CaseExecution,
  CaseMessage,
  DocumentExtraction,
  PartyPosition,
  PrivateAIReview,
  ProposalDecision,
} from "./kelishuv-types";
import type {
  IdentityCheck,
  MediatorInvoice,
  PaymentTransaction,
  PhoneChallenge,
  ServiceOrder,
  SmsDelivery,
} from "./service-types";
import type { AssistantRequestRecord } from "./assistant-types";
export type Role = "CITIZEN" | "MEDIATOR" | "LAWYER" | "ADMIN" | "ORGANIZATION";
export type DisputeType =
  | "MEHNAT"
  | "SHARTNOMA"
  | "QOSHNI"
  | "OILA"
  | "ISTE_MOLCHI"
  | "BIZNES"
  | "YER_MULK"
  | "BOSHQA";
export type CaseStatus =
  | "SOLUTIONS_READY"
  | "AWAITING_CONSENT"
  | "OPEN_FOR_MEDIATORS"
  | "CONSENT_WITHDRAWN"
  | "MEDIATOR_ASSIGNED"
  | "SESSION_SCHEDULED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "ESCALATED"
  | "CLOSED";
export type SolutionType = "MEDIATION" | "NEGOTIATION" | "COURT";
export type User = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  phoneVerifiedAt?: string;
  region: string;
  city?: string;
  accountType?: "PERSON" | "ORGANIZATION" | "BANK";
  organizationName?: string;
  termsAcceptance?: { version: string; at: string };
  mediatorApplication?: MediatorApplication;
  role: Role;
  passwordHash: string;
  createdAt: string;
  isActive: boolean;
};
export type PublicUser = Omit<User, "passwordHash">;
export type LegalSource = {
  id: string;
  title: string;
  lawNumber: string;
  article: string;
  summary: string;
  url: string;
  types: DisputeType[];
  verifiedAt: string;
  keywords: string[];
  lawId?: string;
  articleNumber?: string;
  content?: string;
  editionDate?: string;
  retrievedAt?: string;
  contentHash?: string;
};
export type Answer = "YES" | "NO" | "UNKNOWN";
export type RoutingFacts = {
  publicAuthority: Answer;
  bothBusinesses: Answer;
  arbitrationAgreement: Answer;
  internationalCommercial: Answer;
  thirdPartyRights: Answer;
};
export type ForumOption = {
  id:
    | "MEDIATION"
    | "NEGOTIATION"
    | "COURT"
    | "DOMESTIC_ARBITRATION"
    | "INTERNATIONAL_ARBITRATION";
  title: string;
  availability: "POSSIBLE" | "CONDITIONAL" | "UNSUITABLE" | "REVIEW";
  reason: string;
  requirements: string[];
  nextSteps: string[];
  sources: { lawId: string; article: string; title: string; url: string }[];
};
export type LegalGuidance = {
  checkedAt: string;
  version: string;
  court: string;
  summary: string;
  options: ForumOption[];
  questions: string[];
};
export type MediatorApplication = {
  revision?: string;
  certNumber: string;
  registryUrl: string;
  specializations: DisputeType[];
  experience: number;
  bio: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
  documents: CaseDocument[];
  reviewNote?: string;
  reviewedAt?: string;
};
export type PartyConsent = {
  userId: string;
  at: string;
  textVersion: string;
  phone: string;
};
export type MediationWorkflow = {
  version: 2;
  invitedEmail?: string;
  invitedPhone?: string;
  smsDeliveryId?: string;
  invitedName?: string;
  invitationHash?: string;
  invitationToken?: string;
  invitationRequestId?: string;
  invitationExpiresAt?: string;
  respondentId?: string;
  respondentStatement?: string;
  initiatorConsent?: PartyConsent;
  respondentConsent?: PartyConsent;
  publishedAt?: string;
  mediatorApprovals: { userId: string; mediatorId: string; at: string }[];
  procedureDocumentId?: string;
  settlementDocumentId?: string;
  calls: {
    id: string;
    mediatorId: string;
    partyId: string;
    outcome: "SPOKE" | "NO_ANSWER" | "SCHEDULED";
    note: string;
    at: string;
  }[];
  agreedPoints?: string;
  disputedPoints?: string;
  actionPlan?: string;
};
export type CasePayment = {
  id: string;
  caseId: string;
  mediatorId: string;
  gross: number;
  commissionPercent: number;
  platformFee: number;
  mediatorNet: number;
  method: "MANUAL";
  reference: string;
  recordedAt: string;
  recordedBy: string;
  commissionStatus: "DUE" | "SETTLED";
  commissionReference?: string;
  commissionConfirmedAt?: string;
  commissionConfirmedBy?: string;
};
export type CourtCosts = {
  stateFee: number;
  lawyerFee: number;
  expertFee: number;
  transportFee: number;
  total: number;
  bhm: number;
  exempt: boolean;
  source: string;
  estimated: true;
};
export type Solution = {
  type: SolutionType;
  title: string;
  description: string;
  duration: string;
  cost: number;
  advantages: string[];
  consideration: string;
  steps: string[];
};
export type Analysis = {
  summary: string;
  mode: "local" | "rag";
  classification: DisputeType;
  sources: LegalSource[];
  solutions: Solution[];
  documents: string[];
  costs: CourtCosts;
  disclaimer: string;
  criminal: boolean;
};
export type CaseDocument = {
  extraction?: DocumentExtraction;
  id: string;
  name: string;
  size: number;
  mime: string;
  uploadedAt: string;
  storageKey: string;
  uploadedBy?: string;
  kind?:
    | "APPLICATION"
    | "EVIDENCE"
    | "PROCEDURE_AGREEMENT"
    | "SETTLEMENT"
    | "CERTIFICATE";
  visibility?: "MEDIATOR_ONLY" | "PARTIES";
};
export type CaseRecord = {
  closure?: {
    id: string;
    kind: "WITHDRAWN" | "SETTLED_EXTERNALLY";
    reason: string;
    requestedBy: string;
    requestedAt: string;
    confirmations: string[];
    status: "PENDING" | "CLOSED" | "DECLINED";
    closedAt?: string;
  };
  creationRequest?: { id: string; hash: string };
  hasPendingAgreement?: boolean;
  journeyVersion?: 3;
  positions?: PartyPosition[];
  aiReview?: CaseAIReview;
  privateReviews?: PrivateAIReview[];
  proposalDecisions?: ProposalDecision[];
  execution?: CaseExecution;
  executionHistory?: CaseExecution[];
  messages?: CaseMessage[];
  id: string;
  number: string;
  title: string;
  userId: string;
  type: DisputeType;
  description: string;
  claimAmount: number;
  region: string;
  city?: string;
  routingFacts?: RoutingFacts;
  guidance?: LegalGuidance;
  mediation?: MediationWorkflow;
  status: CaseStatus;
  chosenSolution?: SolutionType;
  mediatorId?: string;
  analysis: Analysis;
  documents: CaseDocument[];
  history: { status: CaseStatus; note: string; at: string }[];
  createdAt: string;
  updatedAt: string;
  demo?: boolean;
};
export type Mediator = {
  availability?: {
    weekdays: number[];
    startHour: number;
    endHour: number;
    duration: number;
    updatedAt: string;
  };
  id: string;
  userId: string;
  name: string;
  title: string;
  image: string;
  region: string;
  city?: string;
  registryUrl?: string;
  registryCheckedAt?: string;
  specializations: DisputeType[];
  rating: number;
  casesResolved: number;
  experience: number;
  hourlyRate: number;
  certNumber: string;
  isOnline: boolean;
  bio: string;
  languages: string[];
  demo: boolean;
};
export type MediationSession = {
  id: string;
  caseId: string;
  mediatorId: string;
  scheduledAt: string;
  duration: number;
  type: "ONLINE" | "OFFLINE";
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  notes: string;
  fee: number;
  platformFee: number;
  mediatorFee: number;
  paid: boolean;
  rating?: number;
  room: string;
  zoom?: { meetingId: string; joinUrl: string; createdAt: string };
  zoomRequestId?: string;
  zoomAttemptId?: string;
  zoomRequestedAt?: string;
};
export type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
  emailedAt?: string;
  emailClaim?: string;
  emailClaimedAt?: string;
  emailAttempts?: number;
  emailRetryAt?: string;
};
export type AppData = {
  assistantRequests?: AssistantRequestRecord[];
  identityChecks?: IdentityCheck[];
  phoneChallenges?: PhoneChallenge[];
  smsDeliveries?: SmsDelivery[];
  serviceOrders?: ServiceOrder[];
  paymentTransactions?: PaymentTransaction[];
  mediatorInvoices?: MediatorInvoice[];
  agreements?: Agreement[];
  audit?: AuditEvent[];
  settings?: {
    retentionDays: number | null;
    reminderDays: number;
    updatedAt: string;
    updatedBy: string;
  };
  complaints?: {
    id: string;
    userId: string;
    caseId?: string;
    category: "SUPPORT" | "CONFIDENTIALITY" | "MEDIATOR" | "DATA_REQUEST";
    description: string;
    status: "OPEN" | "REVIEWED";
    createdAt: string;
    reviewNote?: string;
  }[];
  version: number;
  users: User[];
  cases: CaseRecord[];
  mediators: Mediator[];
  sessions: MediationSession[];
  notifications: Notification[];
  payments?: CasePayment[];
};
export const TYPE_LABELS: Record<DisputeType, string> = {
  MEHNAT: "Mehnat nizosi",
  SHARTNOMA: "Shartnoma nizosi",
  QOSHNI: "Qo‘shnichilik",
  OILA: "Oilaviy nizo",
  ISTE_MOLCHI: "Iste’molchi huquqlari",
  BIZNES: "Biznes nizosi",
  YER_MULK: "Yer va mol-mulk",
  BOSHQA: "Boshqa masala",
};
export const STATUS_LABELS: Record<CaseStatus, string> = {
  SOLUTIONS_READY: "Yangi",
  AWAITING_CONSENT: "Rozilik kutilmoqda",
  OPEN_FOR_MEDIATORS: "Mediator kutilmoqda",
  CONSENT_WITHDRAWN: "Rozilik qaytarib olindi",
  MEDIATOR_ASSIGNED: "Jarayonda",
  SESSION_SCHEDULED: "Sessiya belgilangan",
  IN_PROGRESS: "Jarayonda",
  RESOLVED: "Yakunlangan",
  ESCALATED: "Sudga yo‘naltirilgan",
  CLOSED: "Yopilgan",
};
export const REGIONS = [
  "Toshkent shahri",
  "Toshkent viloyati",
  "Samarqand",
  "Farg‘ona",
  "Andijon",
  "Namangan",
  "Buxoro",
  "Qashqadaryo",
  "Surxondaryo",
  "Navoiy",
  "Jizzax",
  "Sirdaryo",
  "Xorazm",
  "Qoraqalpog‘iston",
];
