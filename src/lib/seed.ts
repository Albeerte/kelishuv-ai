import { randomUUID, scryptSync } from "node:crypto";
import { analyzeLocal, mediationFee } from "./legal";
import type { AppData, CaseRecord, DisputeType, Role } from "./types";

export function hashPassword(password: string) {
  const salt = randomUUID();
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
const now = () => new Date().toISOString();
export function seedData(): AppData {
  const createdAt = now();
  const user = (id: string, fullName: string, role: Role) => ({
    id,
    fullName,
    email: `${id}@demo.medimatch.uz`,
    role,
    phone: "",
    region: "Toshkent shahri",
    city: "Toshkent",
    passwordHash: "",
    isActive: true,
    createdAt,
  });
  const makeCase = (
    id: string,
    number: string,
    title: string,
    type: DisputeType,
    description: string,
    claimAmount: number,
    status: CaseRecord["status"],
    age: number,
  ): CaseRecord => {
    const date = new Date(Date.now() - age * 86400000).toISOString();
    return {
      id,
      number,
      title,
      userId: "demo-citizen",
      type,
      description,
      claimAmount,
      region: "Toshkent shahri",
      status,
      analysis: analyzeLocal(description, type, claimAmount),
      documents: [],
      history: [
        {
          status: "SOLUTIONS_READY",
          note: "Dastlabki tahlil tayyorlandi",
          at: date,
        },
        { status, note: "Namuna nizo holati", at: date },
      ],
      createdAt: date,
      updatedAt: date,
      demo: true,
    };
  };
  const cases = [
    makeCase(
      "case-1042",
      "MM-1042",
      "Ish haqi o‘z vaqtida to‘lanmagan",
      "MEHNAT",
      "Ish beruvchim oxirgi ikki oy uchun ish haqimni to‘lamadi. Mehnat shartnomam va bank hujjatlarim mavjud. Ish beruvchi bilan kelishib, ish haqimni undirmoqchiman.",
      8500000,
      "SESSION_SCHEDULED",
      2,
    ),
    makeCase(
      "case-1038",
      "MM-1038",
      "Ijara shartnomasi bo‘yicha kelishmovchilik",
      "SHARTNOMA",
      "Uy ijarasi yakunlangandan keyin garov pulini qaytarish bo‘yicha kelishmovchilik yuzaga keldi. Ijara shartnomasi va to‘lov cheki mavjud.",
      3000000,
      "SOLUTIONS_READY",
      5,
    ),
    makeCase(
      "case-1021",
      "MM-1021",
      "Sifatsiz mahsulot uchun pulni qaytarish",
      "ISTE_MOLCHI",
      "Sotib olingan mahsulotda nuqson bor edi. Sotuvchi bilan mediatsiya orqali pulni qaytarish bo‘yicha kelishuvga erishildi.",
      2400000,
      "RESOLVED",
      12,
    ),
  ];
  cases[0].mediatorId = "mediator-1";
  cases[0].chosenSolution = "MEDIATION";
  cases[2].mediatorId = "mediator-2";
  cases[2].chosenSolution = "MEDIATION";
  const fee = mediationFee(cases[0].claimAmount);
  const nextDay = new Date(Date.now() + 86400000);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nextDay);
  return {
    version: 1,
    users: [
      user("demo-citizen", "Azizbek Karimov", "CITIZEN"),
      user("demo-respondent", "Ikkinchi taraf (namuna)", "CITIZEN"),
      user("demo-mediator", "Dilshod Rahimov", "MEDIATOR"),
      user("demo-admin", "Administrator", "ADMIN"),
    ],
    cases,
    mediators: [
      {
        id: "mediator-1",
        userId: "demo-mediator",
        name: "Dilshod Rahimov",
        title: "Professional mediator",
        image: "/images/mediator-dilshod.jpg",
        region: "Toshkent shahri",
        specializations: ["MEHNAT", "SHARTNOMA", "BIZNES"],
        rating: 4.9,
        casesResolved: 127,
        experience: 8,
        hourlyRate: 150000,
        certNumber: "DEMO-MD-001",
        isOnline: true,
        bio: "Mehnat va shartnoma nizolari bo‘yicha tomonlarga o‘zaro kelishuv topishda yordam beradi. Tushunarli muloqot va manfaatlarga asoslangan yondashuv.",
        languages: ["O‘zbek", "Rus"],
        demo: true,
      },
      {
        id: "mediator-2",
        userId: "demo-mediator-2",
        name: "Malika Usmonova",
        title: "Professional mediator",
        image: "/images/mediator-malika.jpg",
        region: "Toshkent shahri",
        specializations: ["OILA", "ISTE_MOLCHI", "SHARTNOMA"],
        rating: 4.9,
        casesResolved: 98,
        experience: 6,
        hourlyRate: 120000,
        certNumber: "DEMO-MD-002",
        isOnline: true,
        bio: "Oilaviy va iste’molchilar nizolari bo‘yicha muzokaralar. Har bir tomonning fikrini tinglab, barqaror kelishuvga erishishga ko‘maklashadi.",
        languages: ["O‘zbek", "Rus", "Ingliz"],
        demo: true,
      },
      {
        id: "mediator-3",
        userId: "demo-mediator-3",
        name: "Sardor Abdullayev",
        title: "Professional mediator",
        image: "/images/mediator-sardor.jpg",
        region: "Samarqand",
        specializations: ["YER_MULK", "QOSHNI", "BIZNES"],
        rating: 4.8,
        casesResolved: 84,
        experience: 7,
        hourlyRate: 180000,
        certNumber: "DEMO-MD-003",
        isOnline: false,
        bio: "Mol-mulk, tadbirkorlik va qo‘shnichilik nizolari bo‘yicha mediatsiya sessiyalari. Onlayn hamda yuzma-yuz uchrashuvlar.",
        languages: ["O‘zbek", "Rus"],
        demo: true,
      },
    ],
    sessions: [
      {
        id: "session-demo",
        caseId: cases[0].id,
        mediatorId: "mediator-1",
        scheduledAt: `${date}T14:00:00+05:00`,
        duration: 60,
        type: "ONLINE",
        status: "SCHEDULED",
        notes: "Ish haqi bo‘yicha birinchi muhokama",
        fee: fee.total,
        platformFee: fee.platformFee,
        mediatorFee: fee.mediatorFee,
        paid: false,
        room: `medimatch-${randomUUID()}`,
      },
    ],
    notifications: [
      {
        id: randomUUID(),
        userId: "demo-citizen",
        title: "Mediatsiya sessiyasi belgilandi",
        body: "Dilshod Rahimov bilan uchrashuv tafsilotlarini ko‘ring.",
        href: "/dashboard/cases/case-1042",
        read: false,
        createdAt,
      },
    ],
  };
}
