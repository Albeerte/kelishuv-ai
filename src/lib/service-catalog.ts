import type { TemplateId } from "./service-types";

export const DOCUMENT_TARIFFS: {
  id: TemplateId;
  title: string;
  price: number;
  description: string;
}[] = [
  {
    id: "DEMAND",
    title: "Talabnoma",
    price: 19000,
    description:
      "Qarshi tarafga talab va taklifni yozma bayon qilish. AI bilan to‘ldirish va DOCX fayl.",
  },
  {
    id: "MEDIATION",
    title: "Mediatsiya uchun ariza",
    price: 29000,
    description:
      "Mediatorga murojaat, nizo bayoni va ilovalar. AI bilan to‘ldirish va DOCX fayl.",
  },
  {
    id: "COURT",
    title: "Da’vo arizasi loyihasi",
    price: 49000,
    description:
      "Talablar va dalillarni tartiblash. Mutaxassis ko‘rigi uchun AI loyihasi va DOCX fayl.",
  },
];

export function normalizePhone(value: string) {
  if (!/^[+\d\s()-]+$/.test(value)) return "";
  const digits = value.replace(/\D/g, "");
  const phone = digits.length === 9 ? `998${digits}` : digits;
  return /^998\d{9}$/.test(phone) ? `+${phone}` : "";
}

export const EMPTY_IDENTITY_FIELDS = {
  firstName: "",
  lastName: "",
  middleName: "",
  birthDate: "",
  address: "",
  documentNumber: "",
};
