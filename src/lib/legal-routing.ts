import { isCriminal } from "./legal";
import type {
  Answer,
  DisputeType,
  ForumOption,
  LegalGuidance,
  RoutingFacts,
} from "./types";

export const DEFAULT_ROUTING_FACTS: Readonly<RoutingFacts> = Object.freeze({
  publicAuthority: "UNKNOWN",
  bothBusinesses: "UNKNOWN",
  arbitrationAgreement: "UNKNOWN",
  internationalCommercial: "UNKNOWN",
  thirdPartyRights: "UNKNOWN",
});

const LAWS = {
  mediation: {
    lawId: "3805227",
    title: "Mediatsiya to‘g‘risida, O‘RQ-482 (20.10.2025 tahriri)",
    url: "https://lex.uz/docs/-3805227",
  },
  domesticArbitration: {
    lawId: "1072079",
    title: "Hakamlik sudlari to‘g‘risida, O‘RQ-64 (24.07.2026 tahriri)",
    url: "https://lex.uz/docs/-1072079",
  },
  internationalArbitration: {
    lawId: "5294106",
    title: "Xalqaro tijorat arbitraji to‘g‘risida, O‘RQ-674",
    url: "https://lex.uz/docs/-5294106",
  },
  civil: {
    lawId: "111189",
    title: "Fuqarolik kodeksi, birinchi qism",
    url: "https://lex.uz/docs/-111189",
  },
  civilProcedure: {
    lawId: "3517337",
    title: "Fuqarolik protsessual kodeksi",
    url: "https://lex.uz/docs/-3517337",
  },
  economicProcedure: {
    lawId: "3523891",
    title: "Iqtisodiy protsessual kodeksi",
    url: "https://lex.uz/docs/-3523891",
  },
  administrativeProcedure: {
    lawId: "3527353",
    title: "Ma’muriy sud ishlarini yuritish to‘g‘risidagi kodeks",
    url: "https://lex.uz/docs/-3527353",
  },
  labor: {
    lawId: "6257288",
    title: "Mehnat kodeksi",
    url: "https://lex.uz/docs/-6257288",
  },
  family: {
    lawId: "104720",
    title: "Oila kodeksi",
    url: "https://lex.uz/docs/-104720",
  },
  land: {
    lawId: "152653",
    title: "Yer kodeksi",
    url: "https://lex.uz/docs/-152653",
  },
} as const;

function citation(law: keyof typeof LAWS, article: string) {
  return { ...LAWS[law], article };
}

function answer(value: unknown): Answer {
  return value === "YES" || value === "NO" ? value : "UNKNOWN";
}

export function assessLegalRoutes(
  type: DisputeType,
  description: string,
  input: Partial<RoutingFacts> = DEFAULT_ROUTING_FACTS,
): LegalGuidance {
  const facts: RoutingFacts = {
    publicAuthority: answer(input.publicAuthority),
    bothBusinesses: answer(input.bothBusinesses),
    arbitrationAgreement: answer(input.arbitrationAgreement),
    internationalCommercial: answer(input.internationalCommercial),
    thirdPartyRights: answer(input.thirdPartyRights),
  };
  const text = description.toLocaleLowerCase().replace(/[’‘`ʻʼ]/g, "'");
  const criminalSignal = isCriminal(description);
  const employmentOrFamily = type === "MEHNAT" || type === "OILA";
  const landSignal =
    /(?:^|[^a-z])yer(?:ni|ga|da|dan|ning)?(?=$|[^a-z])|uchastka|kadastr/.test(text);
  const buildingOwnershipSignal =
    /bino|inshoot|imorat|uyga|uyning/.test(text) &&
    /egalik|mulk huquq/.test(text) &&
    /belgila|tan ol/.test(text);
  const excludedProperty = landSignal || buildingOwnershipSignal;

  let mediationAvailability: ForumOption["availability"] = "POSSIBLE";
  let mediationReason =
    "Nizo doirasi tasdiqlansa, har ikki tarafning ixtiyoriy roziligi bilan mediator jalb qilish mumkin.";
  if (facts.thirdPartyRights === "YES") {
    mediationAvailability = "UNSUITABLE";
    mediationReason =
      "Ishtirok etmayotgan uchinchi shaxslar yoki jamoat manfaatlariga daxldor nizo Mediatsiya qonunining 3-moddasida chiqarilgan.";
  } else if (criminalSignal) {
    mediationAvailability = "REVIEW";
    mediationReason =
      "Tavsifda jinoyat yoki xavfsizlikka oid so‘zlar bor. Alohida fuqarolik talabini va mediatsiya doirasini yurist tekshirishi kerak.";
  } else if (facts.publicAuthority === "YES" || type === "YER_MULK" || type === "BOSHQA") {
    mediationAvailability = "REVIEW";
    mediationReason =
      "Talabning xususiy-huquqiy doirasi, davlat organining vakolati va boshqa shaxslar manfaatlariga ta’siri tekshirilishi kerak.";
  } else if (facts.thirdPartyRights === "UNKNOWN" || facts.publicAuthority === "UNKNOWN") {
    mediationAvailability = "CONDITIONAL";
    mediationReason =
      "Taraflarning roziligi hamda uchinchi shaxslar va jamoat manfaatlariga ta’siri aniqlangach mediatsiya imkoniyati baholanadi.";
  }

  let negotiationAvailability: ForumOption["availability"] = "POSSIBLE";
  let negotiationReason =
    "Taraflar talab va dalillarni yozma almashib, qonunga mos shartlar haqida bevosita muzokara qilishi mumkin.";
  if (criminalSignal || facts.publicAuthority === "YES" || facts.thirdPartyRights === "YES") {
    negotiationAvailability = "REVIEW";
    negotiationReason =
      "Talabning huquqiy tabiati, vakolat va boshqa shaxslarning huquqlariga ta’siri tekshirilgach kelishuv shartlari baholanadi.";
  } else if (facts.publicAuthority === "UNKNOWN" || facts.thirdPartyRights === "UNKNOWN" || type === "BOSHQA") {
    negotiationAvailability = "CONDITIONAL";
  }

  let court =
    "Taraflar maqomi va talab mazmuni aniqlangach fuqarolik yoki iqtisodiy sudga taalluqlilik tekshiriladi.";
  let courtAvailability: ForumOption["availability"] = "REVIEW";
  if (criminalSignal) {
    court =
      "Jinoyat yoki xavfsizlik alomatlari bo‘yicha vakolatli organ va yurist bahosi kerak. Fuqarolik talabi alohida aniqlanadi.";
  } else if (facts.publicAuthority === "YES") {
    court =
      "Davlat organining qarori yoki harakati nizolashilsa ma’muriy sud ehtimoli bor. Xususiy-huquqiy talab uchun fuqarolik yoki iqtisodiy sud mezonlari tekshiriladi.";
  } else if (facts.publicAuthority === "NO" && employmentOrFamily) {
    courtAvailability = "CONDITIONAL";
    court =
      "Mehnat yoki oilaviy talab bo‘yicha fuqarolik ishlari sudi ehtimoli bor. Maxsus tartib va hududiy tegishlilik tekshiriladi.";
  } else if (facts.publicAuthority === "NO" && facts.bothBusinesses === "YES") {
    courtAvailability = "CONDITIONAL";
    court =
      "Yuridik shaxslar yoki YTTlarning iqtisodiy talabi bo‘lsa iqtisodiy sud ehtimoli bor. IPK 25-moddasidagi shartlar tekshiriladi.";
  } else if (facts.publicAuthority === "NO" && facts.bothBusinesses === "NO") {
    courtAvailability = "CONDITIONAL";
    court =
      "Kamida bir taraf fuqaro bo‘lgan xususiy talabda fuqarolik ishlari sudi ehtimoli bor. YTT maqomi va qonundagi maxsus taalluqlilik tekshiriladi.";
  }

  let domesticAvailability: ForumOption["availability"] = "CONDITIONAL";
  let domesticReason =
    "Ruxsat etilgan fuqarolik yoki iqtisodiy nizo va uni qamrab oluvchi yozma hakamlik bitimi bo‘lishi kerak.";
  if (employmentOrFamily || excludedProperty || facts.publicAuthority === "YES") {
    domesticAvailability = "UNSUITABLE";
    domesticReason =
      "O‘RQ-64 5 va 9-moddalaridagi cheklovlar qo‘llanadi. Mehnat, oila, yer, bino-inshoot egaligini belgilash va davlat subyektlariga oid cheklangan nizolar hakamlikka berilmaydi.";
  } else if (criminalSignal || facts.thirdPartyRights === "YES" || type === "YER_MULK" || type === "BOSHQA") {
    domesticAvailability = "REVIEW";
    domesticReason =
      "Nizo predmeti hakamlik vakolatiga kirishi alohida tekshirilishi kerak. Yer va bino-inshootga egalikni belgilashga doir 2026-yilgi cheklovlar hisobga olinadi.";
  } else if (facts.arbitrationAgreement === "YES" && facts.publicAuthority === "NO" && facts.thirdPartyRights === "NO") {
    domesticAvailability = "POSSIBLE";
    domesticReason =
      "Ko‘rsatilgan yozma bitim haqiqiyligi, nizoni qamrashi va taraflar maqomi tasdiqlansa, hakamlik yo‘li ko‘rib chiqilishi mumkin.";
  }

  let internationalAvailability: ForumOption["availability"] = "CONDITIONAL";
  let internationalReason =
    "Tijorat nizosi, O‘RQ-674 4-moddasidagi xalqaro bog‘liqlik va 12-moddadagi yozma arbitraj kelishuvi tekshirilishi kerak.";
  if (employmentOrFamily || facts.internationalCommercial === "NO") {
    internationalAvailability = "UNSUITABLE";
    internationalReason =
      "Ushbu yo‘l uchun 4-moddadagi xalqaro tijorat doirasi talab etiladi. Kiritilgan nizo turi yoki javob bu shartni tasdiqlamaydi.";
  } else if (criminalSignal || facts.publicAuthority === "YES" || facts.thirdPartyRights === "YES" || type === "YER_MULK" || type === "QOSHNI" || type === "BOSHQA") {
    internationalAvailability = "REVIEW";
    internationalReason =
      "Tijorat doirasi, xalqaro bog‘liqlik, taraflar vakolati va nizoning arbitrajda ko‘rilishi bo‘yicha individual tekshiruv kerak.";
  } else if (facts.internationalCommercial === "YES" && facts.arbitrationAgreement === "YES" && facts.publicAuthority === "NO" && facts.thirdPartyRights === "NO") {
    internationalAvailability = "POSSIBLE";
    internationalReason =
      "Xalqaro tijorat aloqasi va yozma kelishuv ko‘rsatilgan. Kelishuv haqiqiyligi, arbitraj joyi va vakolat tekshirilgach ushbu yo‘l ko‘rib chiqiladi.";
  }

  const negotiationRequirements = [
    "Talab predmeti, dalillar va taklif qilinayotgan bajarish shartlarini aniqlash.",
    "Qonundagi majburiy huquqlar va maxsus rasmiylashtirish talablariga rioya qilish.",
  ];
  const negotiationSources = [citation("civil", "234, 236, 354-moddalar")];
  const courtSources = [
    citation("civilProcedure", "26, 33–35-moddalar"),
    citation("economicProcedure", "25-modda"),
    citation("administrativeProcedure", "26–27-moddalar"),
  ];
  if (type === "OILA") {
    negotiationRequirements.push("Aliment kelishuvi uchun yozma shakl va notarial tasdiq talabini tekshirish.");
    negotiationSources.push(citation("family", "96, 131-moddalar"));
  }
  if (type === "MEHNAT") {
    courtSources.push(citation("labor", "542, 543, 545-moddalar"));
  }
  if (type === "YER_MULK" || excludedProperty) {
    courtSources.push(citation("land", "89-modda"));
  }

  const questions: string[] = [];
  if (facts.publicAuthority === "UNKNOWN") {
    questions.push("Taraflardan biri davlat organi, davlat tashkiloti, davlat ishtirokidagi korxona yoki mahalla organimi?");
  }
  if (facts.bothBusinesses === "UNKNOWN" && !employmentOrFamily) {
    questions.push("Har ikkala taraf yuridik shaxs yoki ro‘yxatdan o‘tgan YTTmi va talab iqtisodiy faoliyatdan kelib chiqqanmi?");
  }
  if (facts.thirdPartyRights === "UNKNOWN") {
    questions.push("Nizo mediatsiyada ishtirok etmayotgan uchinchi shaxslar yoki jamoat manfaatlariga daxldormi?");
  }
  if (facts.arbitrationAgreement === "UNKNOWN" && !employmentOrFamily && !excludedProperty) {
    questions.push("Aynan ushbu nizoni qamrab oluvchi yozma hakamlik yoki arbitraj kelishuvi mavjudmi?");
  }
  if (facts.internationalCommercial === "UNKNOWN" && !employmentOrFamily) {
    questions.push("Nizo tijorat xususiyatidami va korxonalar, ijro joyi yoki nizo predmeti bir nechta davlat bilan bog‘liqmi?");
  }
  if (facts.publicAuthority === "YES") {
    questions.push("Talab davlat organining qarori yoki harakatini nizolashga oidmi, yoxud xususiy shartnomaviy talabmi?");
  }
  if (type === "YER_MULK") {
    questions.push("Talab yer huquqi, kadastr yoki bino-inshootga egalikni belgilashga oidmi, yoxud boshqa mulkiy talabmi?");
  }
  if (type === "BOSHQA" || !description.trim()) {
    questions.push("Qaysi huquq buzilgan, kimga nisbatan qanday natija talab qilinmoqda va bunga qaysi hujjatlar asos bo‘ladi?");
  }
  if (criminalSignal) {
    questions.push("Tavsifdagi jinoyat yoki xavfsizlik alomati va unga qo‘shimcha fuqarolik talabi yurist tomonidan baholanganmi?");
  }

  return {
    checkedAt: "2026-11-20",
    version: "2026.11.20",
    court,
    summary: criminalSignal
      ? "Tavsifdagi jinoyat yoki xavfsizlik alomatlari individual tekshiruvni talab qiladi. Ko‘rsatilgan yo‘llar bo‘yicha huquqiy doira avval aniqlanadi."
      : "Yo‘llar tanlangan nizo turi va javoblarga asoslangan dastlabki bahodir. Aniq vakolat, rozilik va hujjatlar har bir yo‘l shartlari bo‘yicha tekshiriladi.",
    options: [
      {
        id: "MEDIATION",
        title: "Mediator bilan kelishuv",
        availability: mediationAvailability,
        reason: mediationReason,
        requirements: [
          "Ikki tarafning ixtiyoriy roziligi va mediatorni o‘zaro kelishib tanlashi.",
          "16 va 20-moddalardagi yozma kelishuvlarni rasmiylashtirish.",
          "Reyestrdagi faol mediator, maxfiylik va ma’lumot ulashish roziligi.",
          "Odatda 30 kun, o‘zaro rozilik bilan yana 30 kungacha. Ijro jarayonida ko‘pi bilan 15 kun.",
          "Yakuniy mediativ kelishuvni taraflar imzolashi va mediator tasdiqlashi.",
        ],
        nextSteps: [
          "Mediatorga yuborishga rozilikni har ikki akkauntda qayd eting.",
          "Mos mediatorni tanlang va yozma jarayon kelishuvini rasmiylashtiring.",
          "Talab va dalillarni ko‘rib chiqib, kelishilgan shartlarni yozma hujjatga kiriting.",
        ],
        sources: [citation("mediation", "3, 6–7, 12, 16, 18–20, 22–23, 29-moddalar")],
      },
      {
        id: "NEGOTIATION",
        title: "Bevosita muzokara",
        availability: negotiationAvailability,
        reason: negotiationReason,
        requirements: negotiationRequirements,
        nextSteps: [
          "Talabnoma va dalillar nusxalarini tayyorlang.",
          "Javob muddatini tegishli qonun yoki shartnomadan tekshiring.",
          "Qabul qilingan shartlar va ijro muddatini yozma rasmiylashtiring.",
        ],
        sources: negotiationSources,
      },
      {
        id: "COURT",
        title: "Davlat sudiga murojaat",
        availability: courtAvailability,
        reason: court,
        requirements: [
          "Talab mazmuni, taraflarning huquqiy maqomi va maxsus sudga taalluqlilikni tekshirish.",
          "Javobgar manzili, ko‘chmas mulk joylashuvi va hududiy tegishlilik qoidalarini aniqlash.",
          "Da’vo muddati, sudgacha tartib, davlat boji va imtiyozlarni talab turiga qarab tekshirish.",
        ],
        nextSteps: [
          "Da’vo predmeti, talab summasi va taraflar maqomini hujjatlar bilan aniqlang.",
          "Tegishli sud va murojaat tartibini tekshirib, ariza va ilovalarni tayyorlang.",
        ],
        sources: courtSources,
      },
      {
        id: "DOMESTIC_ARBITRATION",
        title: "Hakamlik sudi",
        availability: domesticAvailability,
        reason: domesticReason,
        requirements: [
          "5 va 9-moddalardagi subyekt hamda nizo predmeti cheklovlaridan o‘tish.",
          "11–13-moddalarga mos, aynan nizoni qamrab oluvchi yozma hakamlik bitimi.",
          "Tanlangan hakamlik sudi, uning qoidalari va bitim haqiqiyligini tekshirish.",
        ],
        nextSteps: [
          "Shartnomadagi hakamlik sharti yoki alohida bitimni yuklang.",
          "Vakolat va 2026-yil 24-iyuldan amal qiluvchi cheklovlarni tekshiring.",
          "Hakamlik bitimi bo‘lmasa, uni tuzish imkoniyatini ikki taraf bilan muhokama qiling.",
        ],
        sources: [citation("domesticArbitration", "5, 9, 11–13-moddalar")],
      },
      {
        id: "INTERNATIONAL_ARBITRATION",
        title: "Xalqaro tijorat arbitraji",
        availability: internationalAvailability,
        reason: internationalReason,
        requirements: [
          "4-moddaga mos tijorat nizosi va xalqaro bog‘liqlik.",
          "12-moddaga mos yozma arbitraj kelishuvi, shu jumladan saqlab qayta foydalanish mumkin bo‘lgan elektron qayd.",
          "Arbitraj joyi, tanlangan qoidalar, taraflar vakolati va majburiy qonun talablarini tekshirish.",
        ],
        nextSteps: [
          "Arbitraj kelishuvi va xalqaro tijorat aloqasini tasdiqlovchi hujjatlarni yig‘ing.",
          "Vakolat, arbitraj joyi va xarajatlarni mutaxassis bilan baholang.",
        ],
        sources: [citation("internationalArbitration", "4, 12-moddalar")],
      },
    ],
    questions,
  };
}
