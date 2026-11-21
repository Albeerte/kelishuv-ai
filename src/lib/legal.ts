import legalData from "@/data/legal-data.json";
import articleCatalog from "@/data/legal-articles.json";
import { COMMISSION_PERCENT } from "./mediation";
import type { Analysis, CourtCosts, DisputeType, LegalSource } from "./types";
import { TYPE_LABELS } from "./types";

export const DISCLAIMER =
  "KELISHUV AI huquqiy ma’lumot beradi. Individual yuridik maslahat uchun malakali advokatga murojaat qiling. Xarajat va muddatlar taxminiy.";
export const LEGAL_SOURCES: LegalSource[] = [
  ...(articleCatalog.sources as LegalSource[]),
  ...(legalData.sources as LegalSource[]).filter(
    (source) => source.id === "court-fee",
  ),
];
export const REQUIRED_DOCS = legalData.documents as Record<
  DisputeType,
  string[]
>;

function normalizeUzbek(text: string) {
  return text.toLocaleLowerCase().replace(/[’‘`ʻʼ]/g, "'");
}
export function isCriminal(description: string) {
  return /qotillik|o'g'rilik|zo'ravonlik|jinoiy|tahdid|қотиллик|ўғирлик|зўравонлик|жиноий|таҳдид|убийств|краж|насили|угроз|уголовн/.test(
    normalizeUzbek(description),
  );
}
export function classify(description: string): DisputeType {
  const text = normalizeUzbek(description);
  const patterns: [DisputeType, RegExp][] = [
    [
      "MEHNAT",
      /maosh|ish haqi|ishdan|mehnat|xodim|ish beruvchi|ta'til|маош|иш ҳақи|ишдан|меҳнат|ходим|зарплат|трудов|работодател|уволен/,
    ],
    [
      "OILA",
      /ajrash|aliment|nikoh|farzand|er-xotin|oilaviy|ажраш|алимент|никоҳ|фарзанд|оилавий|развод|семейн/,
    ],
    [
      "ISTE_MOLCHI",
      /sifatsiz|kafolat|nuqson|do'kon|xarid|tovar|сифатсиз|кафолат|нуқсон|дўкон|харид|товар|потребител|гаранти/,
    ],
    [
      "YER_MULK",
      /kadastr|uchastka|(?:^|[^\p{L}])yer\s|mulk huquqi|кадастр|участка|(?:^|[^\p{L}])ер\s|мулк ҳуқуқи|земел|земл|недвижим/u,
    ],
    ["QOSHNI", /qo'shni|shovqin|suv oq|chegara|қўшни|шовқин|сув оқ|сосед|шум/],
    [
      "BIZNES",
      /sherik|biznes|kompaniya|investitsiya|шерик|бизнес|компания|инвестиц|партн/,
    ],
    [
      "SHARTNOMA",
      /shartnoma|qarz|to'lov|ijara|шартнома|қарз|тўлов|ижара|договор|долг|оплат|аренд/,
    ],
  ];
  return patterns.find(([, pattern]) => pattern.test(text))?.[0] ?? "BOSHQA";
}

export function courtCosts(
  amount: number,
  type: DisputeType | "FUQAROLIK" | "IQTISODIY",
  bhm = 440000,
): CourtCosts {
  const exempt = type === "MEHNAT" || type === "ISTE_MOLCHI";
  const economic = type === "IQTISODIY" || type === "BIZNES";
  const stateFee = exempt
    ? 0
    : Math.max(Math.round(amount * (economic ? 0.02 : 0.04)), bhm);
  const lawyerFee = Math.round(amount * 0.1);
  const expertFee = amount > 5000000 ? 500000 : 0;
  const transportFee = 100000;
  return {
    stateFee,
    lawyerFee,
    expertFee,
    transportFee,
    total: stateFee + lawyerFee + expertFee + transportFee,
    bhm,
    exempt,
    source: "https://lex.uz/docs/-4680944",
    estimated: true,
  };
}

export function mediationFee(amount: number) {
  const total = amount < 5000000 ? 200000 : amount < 20000000 ? 400000 : 800000;
  return {
    total,
    platformFee: Math.round((total * COMMISSION_PERCENT) / 100),
    mediatorFee: total - Math.round((total * COMMISSION_PERCENT) / 100),
  };
}

export function searchLaws(query: string, type?: DisputeType) {
  const words = normalizeUzbek(query).split(/\s+/).filter(Boolean);
  return LEGAL_SOURCES.filter((law) => !type || law.types.includes(type))
    .map((law) => ({
      law,
      score: words.reduce(
        (sum, word) =>
          sum +
          (normalizeUzbek(
            [
              law.title,
              law.summary,
              law.content || "",
              law.lawNumber,
              ...law.keywords,
            ].join(" "),
          ).includes(word)
            ? 1
            : 0),
        0,
      ),
    }))
    .filter((item) => !words.length || item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.law);
}

export function analyzeLocal(
  description: string,
  type: DisputeType,
  amount: number,
): Analysis {
  const costs = courtCosts(amount, type);
  const criminal = isCriminal(description);
  const candidates = searchLaws(description, type);
  const primaryLaw: Partial<Record<DisputeType, string>> = {
    MEHNAT: "6257288",
    SHARTNOMA: "111189",
    QOSHNI: "111189",
    OILA: "104720",
    ISTE_MOLCHI: "4704",
    BIZNES: "111189",
    YER_MULK: "152653",
  };
  const substantive = candidates.filter(
    (source) =>
      !["3805227", "1072079", "5294106"].includes(source.lawId || "") &&
      source.id !== "court-fee",
  );
  const specific = (
    substantive.length
      ? substantive
      : LEGAL_SOURCES.filter(
          (source) =>
            source.types.includes(type) &&
            !["3805227", "1072079"].includes(source.lawId || "") &&
            source.id !== "court-fee",
        )
  ).sort(
    (a, b) =>
      Number(b.lawId === primaryLaw[type]) -
      Number(a.lawId === primaryLaw[type]),
  );
  const mediationSource = LEGAL_SOURCES.find(
    (source) => source.lawId === "3805227" && source.articleNumber === "3",
  )!;
  return {
    classification: type,
    mode: "local",
    criminal,
    summary: criminal
      ? "Tavsifda jinoyat yoki xavfsizlikka oid alomatlar bor. Holatni vakolatli organ va malakali advokat bilan baholang. Quyidagi umumiy fuqarolik yechimlari ushbu holatga avtomatik tatbiq etilmaydi."
      : `${TYPE_LABELS[type]} bo‘yicha dastlabki yo‘nalishlar tayyorlandi. Hujjat va dalillarni to‘plang, so‘ng vaziyatingizga mos yo‘lni tanlang. Yakuniy huquqiy baho tomonlarning hujjatlari asosida beriladi.`,
    sources: [...specific.slice(0, 2), mediationSource],
    solutions: [
      {
        type: "MEDIATION",
        title: "Mediatsiya",
        description:
          "Xolis mediator ko‘magida har ikki tomon uchun maqbul kelishuvga erishing.",
        duration: "2–8 hafta",
        cost: mediationFee(amount).total,
        advantages: [
          "Tomonlarning ixtiyoriy roziligi",
          "Maxfiy muhokama",
          "Munosabatlarni saqlash imkoniyati",
        ],
        consideration:
          "Har ikki tomon jarayonda ishtirok etishga rozilik bildirishi kerak.",
        steps: [
          "Mos mediatorni tanlang",
          "Tomonlarning roziligini oling",
          "Sessiyani belgilang",
          "Kelishuvni yozma rasmiylashtiring",
        ],
      },
      {
        type: "NEGOTIATION",
        title: "Sudgacha kelishuv",
        description:
          "Talabnoma orqali ikkinchi tomon bilan bevosita kelishishga harakat qiling.",
        duration: "1–4 hafta",
        cost: 0,
        advantages: [
          "Hujjat narxi tanlangan tarifda oldindan ko‘rsatiladi",
          "Talablar yozma qayd etiladi",
        ],
        consideration: "Javob muddati shartnoma va talab turiga bog‘liq.",
        steps: [
          "Talabnomani tayyorlang",
          "Dalillar nusxalarini ilova qiling",
          "Topshirilganini tasdiqlovchi hujjatni saqlang",
        ],
      },
      {
        type: "COURT",
        title: "Sud orqali hal etish",
        description:
          "Vakolatli sudga da’vo arizasi bilan murojaat qilishga tayyorlaning.",
        duration: "3–18 oy",
        cost: costs.total,
        advantages: [
          "Talabni sud tartibida ko‘rib chiqish",
          "Qarorni majburiy ijro etish imkoniyati",
        ],
        consideration:
          "Sudlovga tegishlilik, imtiyozlar va da’vo muddati advokat bilan tekshiriladi.",
        steps: [
          "Hujjatlarni to‘plang",
          "Sudlovga tegishlilikni tekshiring",
          "Da’vo arizasini tayyorlang",
          "Davlat boji va imtiyozlarni aniqlang",
        ],
      },
    ],
    documents: REQUIRED_DOCS[type],
    costs,
    disclaimer: DISCLAIMER,
  };
}

export async function analyze(
  description: string,
  type: DisputeType,
  amount: number,
): Promise<Analysis> {
  const local = analyzeLocal(description, type, amount);
  if (local.criminal || !process.env.FASTAPI_URL) return local;
  const response = await fetch(`${process.env.FASTAPI_URL}/ai/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Key": process.env.AI_SERVICE_KEY || "",
    },
    body: JSON.stringify({
      description,
      dispute_type: type,
      claim_amount: amount,
    }),
    signal: AbortSignal.timeout(45000),
  }).catch(() => null);
  if (!response?.ok) return local;
  const data = await response.json().catch(() => null);
  if (
    data?.mode === "rag" &&
    typeof data.summary === "string" &&
    Array.isArray(data.source_ids)
  ) {
    const sources = LEGAL_SOURCES.filter((source) =>
      data.source_ids.includes(source.id),
    );
    if (sources.length)
      return { ...local, summary: data.summary, sources, mode: "rag" };
  }
  return local;
}
