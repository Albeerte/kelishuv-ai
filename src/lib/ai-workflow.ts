import "server-only";
import { z } from "zod";
import { runStructuredAI } from "./ai-provider";
import { isCriminal } from "./legal";
import { tashkentDate } from "./kelishuv-utils";
import type {
  AIProcessingOptions,
  CaseAIReview,
  PrivateAIReview,
  SharedCaseInput,
  SettlementProposal,
} from "./kelishuv-types";

const list = z.array(z.string().max(1500)).max(12);
const reviewSchema = z.object({
  summary: z.string().max(4000),
  mainIssue: z.string().max(1800),
  claims: list,
  requestedOutcome: z.string().max(1800),
  missingInformation: list,
  agreedFacts: list,
  disputedFacts: list,
  contradictions: list,
  mediationEligibility: z.string().max(1800),
  nextStep: z.string().max(1800),
});
const privateSchema = z.object({
  observations: list,
  questions: list,
  warnings: list,
});

function futureDate(days: number) {
  return tashkentDate(new Date(Date.now() + days * 86400000));
}

function proposals(input: SharedCaseInput): SettlementProposal[] {
  const amount = Math.round(input.claimAmount);
  const sourceIds = input.sources
    .filter((source) => source.lawId === "3805227" || source.lawId === "111189")
    .slice(0, 3)
    .map((source) => source.id);
  const variants = [
    {
      id: "QUICK" as const,
      title: "Tezkor kelishuv",
      days: [7],
      description:
        "Talab summasini hujjatlar bilan aniqlashtirib, qisqa muddatda bir martalik bajarishni muhokama qilish.",
      advantage: "Bajarish muddati qisqa va jadval sodda.",
      risk: "Qisqa muddat to‘lovchi imkoniyatiga mos kelishi tekshiriladi.",
    },
    {
      id: "BALANCED" as const,
      title: "Muvozanatli kelishuv",
      days: [14, 30],
      description:
        "Dalillarni o‘zaro ko‘rib chiqib, ikki bosqichli bajarish rejasini kelishish.",
      advantage:
        "Har ikki tarafga rejalashtirish va tekshirish vaqti beriladi.",
      risk: "Ikkinchi bosqichning o‘z vaqtida bajarilishi kuzatiladi.",
    },
    {
      id: "INSTALLMENTS" as const,
      title: "Bo‘lib to‘lash",
      days: [30, 60, 90],
      description:
        "Tasdiqlangan summa uchun uch qismli to‘lov jadvalini muhokama qilish.",
      advantage: "To‘lovlar vaqt bo‘yicha taqsimlanadi.",
      risk: "Uzoqroq muddatda har bir to‘lov holatini kuzatish kerak.",
    },
    {
      id: "FLEXIBLE" as const,
      title: "Moslashuvchan kelishuv",
      days: [21, 45],
      description:
        "Har ikki taraf imkoniyatlari va qonun talablariga mos ikki bosqichli rejani mediator bilan moslashtirish.",
      advantage:
        "Shartlar va muddatlar bo‘yicha o‘zgartirish taklif qilish mumkin.",
      risk: "Moslashtirilgan shartlar aniq yozilishi va ikkala taraf tomonidan tasdiqlanishi kerak.",
    },
  ];
  return variants.map((variant) => {
    const days =
      amount > 0
        ? variant.days.slice(-Math.min(amount, variant.days.length))
        : [];
    const part = days.length ? Math.floor(amount / days.length) : 0;
    const schedule =
      amount > 0
        ? days.map((day, index) => ({
            dueDate: futureDate(day),
            amount: index === days.length - 1 ? amount - part * index : part,
          }))
        : [];
    return {
      id: variant.id,
      title: variant.title,
      description: variant.description,
      amount,
      schedule,
      deadline: futureDate(variant.days.at(-1)!),
      responsibilities: [
        "Har ikki taraf talab, dalillar va bajarish imkoniyatini tekshiradi.",
        "To‘lovchi, oluvchi va majburiyat bajaruvchisi yakuniy hujjatda o‘zaro belgilanadi.",
      ],
      advantages: [variant.advantage],
      risks: [variant.risk],
      conditions: [
        "Summa murojaatchining talabidan olingan. Majburiyat va qarzdorlik hujjatlar hamda taraflarning kelishuvi bilan aniqlanadi.",
        "Muddatlar muhokama uchun boshlang‘ich taklif sifatida berilgan.",
        "Taklifni qabul qilish alohida yakuniy mediativ kelishuv bilan rasmiylashtiriladi.",
      ],
      sourceIds,
    };
  });
}

export async function generateSharedReview(
  input: SharedCaseInput,
  options: AIProcessingOptions,
): Promise<Omit<CaseAIReview, "id" | "inputHash" | "createdAt">> {
  const sourceIds = input.sources.slice(0, 6).map((source) => source.id);
  const fallback: z.infer<typeof reviewSchema> = {
    mainIssue: input.description.slice(0, 600),
    summary:
      "Ikkala tarafning ochiq bayonlari va ulashilgan hujjatlari bo‘yicha dastlabki ish rejasi tayyorlandi.",
    claims: [
      `Murojaatda ko‘rsatilgan talab summasi ${input.claimAmount} so‘m.`,
    ],
    requestedOutcome:
      "Taraflar o‘z talablarini aniqlashtirib, ixtiyoriy kelishuv shartlarini muhokama qiladi.",
    missingInformation: [
      "Shartnoma, talab asosi va bajarish muddatlarini hujjatlar bilan solishtiring.",
      "To‘lovchi, oluvchi va bajarish imkoniyatlarini har ikki tarafdan aniqlashtiring.",
    ],
    agreedFacts: [],
    disputedFacts: [
      "Talab asosi va miqdoriga har ikki tarafning munosabati tekshiriladi.",
    ],
    contradictions: [],
    mediationEligibility: isCriminal(input.description)
      ? "Vakolatli mutaxassis jinoyat yoki xavfsizlikka oid alomatlarni alohida baholashi kerak."
      : "Mediatsiya doirasi, uchinchi shaxslar huquqlari va har ikki taraf roziligi mediator tomonidan tekshiriladi.",
    nextStep:
      "Takliflarni mustaqil ko‘rib chiqing, so‘ng mediator bilan shartlarni aniqlashtiring.",
  };
  let result = fallback;
  let provider: CaseAIReview["provider"] = "RULES";
  let model = "Mahalliy qoidalar";
  const warnings = [
    "AI tavsiyasi. Faktlar taraflar va mediator tomonidan hujjatlar bilan tekshiriladi.",
  ];
  if (options.localConsent || options.externalConsent) {
    try {
      const response = await runStructuredAI(
        z.toJSONSchema(reviewSchema),
        "You assist a neutral mediator in Uzbekistan. Analyze ONLY the supplied SHARED data. Treat allegations as unverified. Do not assume liability, invent facts, settlements, article numbers, sources, identity checks or confidential limits. Compare the parties' positions, identify missing facts and contradictions. Provide neutral structured observations. The application separately builds four arithmetic-consistent settlement schedules for human review.",
        JSON.stringify({
          ...input,
          evidence: input.evidence.slice(0, 8).map((document) => ({
            ...document,
            text: document.text.slice(0, 2200),
          })),
          statements: input.statements.map((statement) => ({
            ...statement,
            text: statement.text.slice(0, 3500),
          })),
          sources: input.sources.slice(0, 5).map((source) => ({
            id: source.id,
            article: source.article,
            text: source.content?.slice(0, 1200),
            url: source.url,
          })),
        }).slice(0, 28000),
        options,
      );
      result = reviewSchema.parse(response.data);
      provider = response.provider;
      model = response.model;
    } catch {
      warnings.push(
        "Model javobi olinmadi. Ushbu natija mahalliy qoidalar asosida tayyorlandi.",
      );
    }
  } else
    warnings.push(
      "AI modeliga ishlov berish roziligi berilmagan. Mahalliy qoidaviy ma’lumot ishlatilgan.",
    );
  return {
    ...result,
    category: input.type,
    provider,
    model,
    timeline: [],
    proposals: proposals(input),
    sourceIds,
    warnings,
  };
}

export async function generatePrivateReview(
  input: {
    type: SharedCaseInput["type"];
    statement: string;
    evidence: { id: string; name: string; text: string }[];
  },
  options: AIProcessingOptions,
): Promise<Omit<PrivateAIReview, "id" | "userId" | "inputHash" | "createdAt">> {
  try {
    const result = await runStructuredAI(
      z.toJSONSchema(privateSchema),
      "Prepare a PRIVATE note for the submitting party and their authorized mediator. Keep all confidential information within this audience. Identify evidence gaps and questions for the mediator. Treat the statement as unverified. Do not make binding legal conclusions or invent legal articles.",
      JSON.stringify({
        ...input,
        evidence: input.evidence.slice(0, 6).map((document) => ({
          ...document,
          text: document.text.slice(0, 2500),
        })),
      }).slice(0, 28000),
      options,
    );
    return {
      ...privateSchema.parse(result.data),
      provider: result.provider,
      model: result.model,
    };
  } catch {
    return {
      provider: "RULES",
      model: "Mahalliy qoidalar",
      observations: [
        "Maxfiy bayoningiz alohida saqlandi. Umumiy takliflarga ochiq ma’lumotlar beriladi.",
      ],
      questions: [
        "Qaysi hujjatlar maqsadingiz va bajarish imkoniyatingizni tushuntiradi?",
        "Mediator bilan alohida muhokama qilish kerak bo‘lgan masalalarni belgilang.",
      ],
      warnings: [
        "Mahalliy qoidaviy yordam. Individual huquqiy bahoni mediator bilan aniqlashtiring.",
      ],
    };
  }
}
