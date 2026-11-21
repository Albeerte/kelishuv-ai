import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "@cantoo/pdf-lib";
import fontkit from "@cantoo/fontkit";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from "docx";
import type {
  AgreementParty,
  AgreementVersion,
  SignatureBox,
  SignerRole,
} from "./kelishuv-types";
import { LEGAL_SOURCES } from "./legal";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 48;
const BODY_WIDTH = PAGE_WIDTH - LEFT * 2;
const BODY_BOTTOM = PAGE_HEIGHT * 0.705;
const ROLES: SignerRole[] = ["FIRST_PARTY", "SECOND_PARTY", "MEDIATOR"];
const ROLE_LABELS: Record<SignerRole, string> = {
  FIRST_PARTY: "Birinchi taraf",
  SECOND_PARTY: "Ikkinchi taraf",
  MEDIATOR: "Mediator",
};
const navy = rgb(0.1, 0.17, 0.26);
const muted = rgb(0.38, 0.44, 0.52);
const border = rgb(0.8, 0.84, 0.88);
const green = rgb(0.15, 0.43, 0.33);
const statusLabel = (version: AgreementVersion) => ({ DRAFT: "Loyiha", SIGNING: "Imzolash jarayonida", SIGNED: "Imzolangan", SUPERSEDED: "Oldingi nusxa" })[version.status];
let fontFiles: Promise<{ regular: Buffer; bold: Buffer }> | undefined;
let formalFontFiles: Promise<{ regular: Buffer; bold: Buffer }> | undefined;

type Block = { kind: "HEADING" | "BODY" | "SMALL" | "DETAILS"; text: string };

function fonts(formal = false) {
  if (formal) {
    formalFontFiles ??= Promise.all([
      readFile(path.join(process.cwd(), "public/fonts/pt-serif/PT_Serif-Web-Regular.ttf")),
      readFile(path.join(process.cwd(), "public/fonts/pt-serif/PT_Serif-Web-Bold.ttf")),
    ]).then(([regular, bold]) => ({ regular, bold }));
    return formalFontFiles;
  }
  fontFiles ??= Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/inter-regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/inter-semibold.ttf")),
  ]).then(([regular, bold]) => ({ regular, bold }));
  return fontFiles;
}

function clean(text: string) {
  return String(text || "")
    .replace(/[\u2011\u2013\u2014]/g, "-")
    // PDF text excludes control characters while retaining tabs and line breaks.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\r/g, "");
}

function safeText(text: string, font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  return Array.from(clean(text), (letter) =>
    letter === "\n" || supported.has(letter.codePointAt(0)!) ? letter : "?",
  ).join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of safeText(text, font).split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      if (font.widthOfTextAtSize(word, size) > width) {
        if (line) lines.push(line);
        line = "";
        for (const letter of word) {
          if (font.widthOfTextAtSize(line + letter, size) > width) {
            lines.push(line);
            line = letter;
          } else line += letter;
        }
      } else if (
        !line ||
        font.widthOfTextAtSize(`${line} ${word}`, size) <= width
      ) {
        line = line ? `${line} ${word}` : word;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
    .format(amount)
    .replace(/,/g, " ");
}

function dateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(date);
}

function partyName(participants: AgreementParty[], userId: string) {
  return (
    participants.find((party) => party.userId === userId)?.fullName || "Taraf"
  );
}

function title(version: AgreementVersion) {
  return version.kind === "PROCEDURE"
    ? "MEDIATSIYA TARTIB-TAOMILINI AMALGA OSHIRISH TO‘G‘RISIDAGI KELISHUV"
    : "MEDIATIV KELISHUV";
}

function agreementDate(value: string) {
  const date = new Date(`${value}T00:00:00+05:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("uz-Latn-UZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tashkent",
  }).format(date);
}

function partyDetails(party: AgreementParty | undefined) {
  return [
    party?.fullName || "________________________",
    `Shaxsni tasdiqlovchi hujjat va rekvizitlar ${party?.identityDetails || "________________________"}`,
    `Manzil ${party?.address || "________________________"}`,
    `Telefon ${party?.phone || "________________________"}`,
  ];
}

function formalBlocks(version: AgreementVersion): Block[] {
  const { terms, participants } = version;
  const first = participants.find((party) => party.role === "FIRST_PARTY");
  const second = participants.find((party) => party.role === "SECOND_PARTY");
  const mediator = participants.find((party) => party.role === "MEDIATOR");
  let number = 0;
  const clause = (text: string): Block => ({
    kind: "BODY",
    text: `${++number}. ${text}`,
  });
  const result: Block[] = [
    {
      kind: "BODY",
      text: `Bir tomondan ${first?.fullName || "________________"}, bundan buyon 1-Taraf, ikkinchi tomondan ${second?.fullName || "________________"}, bundan buyon 2-Taraf, birgalikda Taraflar, mediator ${mediator?.fullName || "________________"} ishtirokida quyidagi mediativ kelishuvni tuzdilar.`,
    },
    { kind: "HEADING", text: "KELISHUV PREDMETI" },
    clause(terms.subject),
    { kind: "HEADING", text: "KELISHUV SHARTLARI VA BAJARISH TARTIBI" },
    clause(terms.agreedTerms),
  ];
  if (terms.totalAmount > 0 || terms.paymentSchedule.length) {
    result.push(clause(`Kelishuv summasi ${money(terms.totalAmount)} ${terms.currency}.`));
    for (const payment of terms.paymentSchedule)
      result.push(clause(
        `${agreementDate(payment.dueDate)} kuni ${partyName(participants, payment.payerId)} tomonidan ${partyName(participants, payment.payeeId)}ga ${money(payment.amount)} ${terms.currency} to‘lanadi. ${payment.description}`,
      ));
  }
  for (const obligation of terms.obligations)
    result.push(clause(
      `${obligation.title}. Mas’ul ${partyName(participants, obligation.assigneeId)}. Manfaatdor taraf ${partyName(participants, obligation.beneficiaryId)}. Bajarish muddati ${agreementDate(obligation.dueDate)}.`,
    ));
  result.push(
    clause(terms.responsibilities || "Taraflar kelishilgan majburiyatlarni belgilangan muddatlarda bajaradi."),
    clause(terms.conditions || "O‘zgartirishlar taraflarning o‘zaro kelishuvi asosida rasmiylashtiriladi."),
    clause(`Jarayon tili ${terms.language || "O‘zbek tili"}. Kelishilgan muddat ${terms.durationDays || 30} kun. Aniq boshlanish, uzaytirish va ijro bosqichidagi maxsus muddatlar mediator tomonidan tekshiriladi.`),
    clause(`Xizmat haqi va xarajatlar. ${terms.feeTerms || "Taraflar bilan alohida yozma kelishiladi."}`),
    clause(`Maxfiylik. ${terms.confidentiality || "Taraf ma’lumoti uning roziligi bilan ulashiladi."}`),
    { kind: "HEADING", text: "IXTIYORIY ROZILIK VA RASMIYLASHTIRISH" },
    clause("Taraflar hujjatning to‘liq mazmuni bilan tanishib, o‘z hisoblaridan mustaqil va ixtiyoriy rozilik bildiradi. Mediator jarayon hamda kelishuvni ko‘rib chiqadi va o‘z tasdig‘ini qayd etadi."),
    clause("Imzolash usuli qo‘lda chizilgan imzo. Hisob, vaqt, hujjat nusxasi va mazmun xeshi qayd etiladi. ERI va shaxsni tekshirish usulining holati platformada alohida ko‘rsatiladi. Huquqiy rasmiylashtirish tegishli qonunchilik va malakali mediator tomonidan baholanadi."),
    ...metadataBlocks(version),
    { kind: "HEADING", text: "TARAFLARNING REKVIZITLARI" },
    { kind: "DETAILS", text: "" },
  );
  return result;
}

function blocks(version: AgreementVersion): Block[] {
  if (version.templateVersion === 2) return formalBlocks(version);
  const { terms, participants } = version;
  const result: Block[] = [
    { kind: "HEADING", text: "1. Taraflar va mediator" },
  ];
  for (const role of ROLES) {
    const party = participants.find((item) => item.role === role);
    result.push({
      kind: "BODY",
      text: `${ROLE_LABELS[role]} - ${party?.fullName || "To‘ldiriladi"}. ${[
        party?.phone && `Telefon ${party.phone}`,
        party?.address && `Manzil ${party.address}`,
        party?.identityDetails && `Rekvizitlar ${party.identityDetails}`,
      ]
        .filter(Boolean)
        .join(". ")}`,
    });
  }
  result.push(
    { kind: "HEADING", text: "2. Nizo predmeti" },
    { kind: "BODY", text: terms.subject },
    { kind: "HEADING", text: "3. Kelishilgan shartlar" },
    { kind: "BODY", text: terms.agreedTerms },
    {
      kind: "BODY",
      text: `Jarayon tili ${terms.language || "O‘zbek tili"}. Kelishilgan muddat ${terms.durationDays || 30} kun. Aniq boshlanish, uzaytirish va ijro bosqichidagi maxsus muddatlar mediator tomonidan tekshiriladi.`,
    },
    {
      kind: "BODY",
      text: `Xizmat haqi va xarajatlar. ${terms.feeTerms || "Taraflar bilan alohida yozma kelishiladi."}`,
    },
    {
      kind: "BODY",
      text: `Maxfiylik. ${terms.confidentiality || "Taraf ma’lumoti uning roziligi bilan ulashiladi."}`,
    },
    { kind: "HEADING", text: "4. To‘lov shartlari va jadvali" },
    {
      kind: "BODY",
      text: `Kelishuv summasi ${money(terms.totalAmount)} ${terms.currency}.`,
    },
  );
  if (terms.paymentSchedule.length) {
    terms.paymentSchedule.forEach((payment, index) => {
      result.push({
        kind: "BODY",
        text: `${index + 1}. ${payment.dueDate} - ${money(payment.amount)} ${terms.currency}. To‘lovchi ${partyName(participants, payment.payerId)}. Qabul qiluvchi ${partyName(participants, payment.payeeId)}. ${payment.description}`,
      });
    });
  } else {
    result.push({
      kind: "BODY",
      text: "To‘lov jadvali mazkur nusxada ko‘rsatilmagan.",
    });
  }
  result.push({ kind: "HEADING", text: "5. Majburiyatlar va muddatlar" });
  if (terms.obligations.length) {
    terms.obligations.forEach((obligation, index) => {
      result.push({
        kind: "BODY",
        text: `${index + 1}. ${obligation.title}. Mas’ul ${partyName(participants, obligation.assigneeId)}. Manfaatdor taraf ${partyName(participants, obligation.beneficiaryId)}. Muddat ${obligation.dueDate}.`,
      });
    });
  } else
    result.push({
      kind: "BODY",
      text: "Taraflar yuqoridagi kelishilgan shartlar va to‘lov jadvaliga rioya qiladi.",
    });
  result.push(
    { kind: "HEADING", text: "6. Mas’uliyat va qo‘shimcha shartlar" },
    {
      kind: "BODY",
      text:
        terms.responsibilities ||
        "Mas’uliyat taraflar kelishuvi va qo‘llanadigan qonunchilik asosida baholanadi.",
    },
    {
      kind: "BODY",
      text:
        terms.conditions ||
        "Qo‘shimcha shartlar mazkur nusxada ko‘rsatilmagan.",
    },
    { kind: "HEADING", text: "7. Ixtiyoriy rozilik va rasmiylashtirish" },
    {
      kind: "BODY",
      text: "Taraflar hujjatning to‘liq mazmuni bilan tanishib, o‘z hisoblaridan mustaqil va ixtiyoriy rozilik bildiradi. Mediator jarayon hamda kelishuvni ko‘rib chiqadi va o‘z tasdig‘ini qayd etadi.",
    },
    {
      kind: "BODY",
      text: "Imzolash usuli qo‘lda chizilgan imzo. Hisob, vaqt, hujjat nusxasi va mazmun xeshi qayd etiladi. ERI va shaxsni tekshirish usulining holati platformada alohida ko‘rsatiladi. Huquqiy rasmiylashtirish tegishli qonunchilik va malakali mediator tomonidan baholanadi.",
    },
  );
  result.push(...metadataBlocks(version));
  return result;
}

function metadataBlocks(version: AgreementVersion): Block[] {
  const result: Block[] = [];
  const sources = version.terms.sourceIds
    .map((id) => LEGAL_SOURCES.find((source) => source.id === id))
    .filter((source) => Boolean(source));
  if (sources.length) {
    result.push({
      kind: "HEADING",
      text: version.templateVersion === 2
        ? "HUQUQIY MANBALAR"
        : "8. Tekshirilgan huquqiy manbalar",
    });
    for (const source of sources) {
      result.push({
        kind: "SMALL",
        text: `${source!.title}. ${source!.article}. Tekshirilgan ${source!.verifiedAt}. ${source!.url}`,
      });
    }
  }
  result.push(
    {
      kind: "SMALL",
      text: `Mazmun SHA-256 ${version.contentHash || "Loyiha xeshi tayyorlanmoqda"}`,
    },
    {
      kind: "SMALL",
      text: `Nusxa identifikatori ${version.id}. Tuzilgan ${dateTime(version.createdAt)} (UTC+5).`,
    },
  );
  return result;
}

export function validateSignatureBoxes(
  boxes: SignatureBox[],
  pageCount: number,
) {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 100)
    throw new Error("PDF sahifalar soni noto‘g‘ri.");
  if (
    boxes.length !== 3 ||
    new Set(boxes.map((box) => box.role)).size !== 3 ||
    boxes.some((box) => !ROLES.includes(box.role))
  )
    throw new Error("Har bir ishtirokchi uchun bittadan imzo joyi kerak.");
  for (const box of boxes) {
    if (
      ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
      !Number.isInteger(box.page) ||
      box.page < 0 ||
      box.page >= pageCount ||
      box.x < 0.04 ||
      box.x + box.width > 0.96 + 0.000001 ||
      box.y < 0.74 ||
      box.y + box.height > 0.94 + 0.000001 ||
      box.width < 0.22 ||
      box.width > 0.3 ||
      box.height < 0.12 ||
      box.height > 0.18
    )
      throw new Error(
        "Imzo joyi sahifaning ajratilgan pastki qismida, belgilangan o‘lchamlarda bo‘lishi kerak.",
      );
  }
  for (let index = 0; index < boxes.length; index++) {
    for (const other of boxes.slice(index + 1)) {
      const box = boxes[index];
      if (
        box.page === other.page &&
        box.x < other.x + other.width &&
        box.x + box.width > other.x &&
        box.y < other.y + other.height &&
        box.y + box.height > other.y
      )
        throw new Error("Imzo joylari bir-birining ustiga tushmoqda.");
    }
  }
}

export async function validateSignaturePng(buffer: Buffer) {
  const magic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    buffer.length < 33 ||
    buffer.length > 2 * 1024 * 1024 ||
    !buffer.subarray(0, 8).equals(magic) ||
    buffer.subarray(12, 16).toString("ascii") !== "IHDR"
  )
    throw new Error("Imzo uchun 2 MB gacha bo‘lgan PNG tasviri kerak.");
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (
    width < 32 ||
    height < 16 ||
    width > 4096 ||
    height > 2048 ||
    width * height > 4_000_000
  )
    throw new Error(
      "Imzo tasvirining o‘lchami ruxsat etilgan chegaradan tashqarida.",
    );
  try {
    const document = await PDFDocument.create();
    const image = await document.embedPng(buffer);
    if (image.width !== width || image.height !== height)
      throw new Error("PNG o‘lchami mos kelmadi");
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const bitmap = await loadImage(buffer);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, width, height).data;
    let visible = 0;
    for (let index = 0; index < pixels.length; index += 4)
      if (
        pixels[index + 3] > 30 &&
        Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) < 210
      )
        visible += 1;
    if (visible < 20) throw new Error("Imzo maydoni bo‘sh");
  } catch {
    throw new Error("Imzo PNG tasvirini o‘qib bo‘lmadi.");
  }
  return { width, height };
}

function defaultBoxes(page: number): SignatureBox[] {
  return ROLES.map((role, index) => ({
    role,
    page,
    x: 0.08 + index * 0.29,
    y: 0.755,
    width: 0.26,
    height: 0.13,
  }));
}

async function drawSignatures(
  document: PDFDocument,
  pages: PDFPage[],
  version: AgreementVersion,
  boxes: SignatureBox[],
  regular: PDFFont,
  bold: PDFFont,
  images: Partial<Record<SignerRole, Uint8Array>>,
) {
  const formal = version.templateVersion === 2;
  const ink = formal ? rgb(0, 0, 0) : navy;
  const lineColor = formal ? rgb(0.2, 0.2, 0.2) : border;
  for (const box of boxes) {
    const page = pages[box.page];
    const width = box.width * PAGE_WIDTH;
    const height = box.height * PAGE_HEIGHT;
    const x = box.x * PAGE_WIDTH;
    const top = box.y * PAGE_HEIGHT;
    const signature = version.signatures.find((item) => item.role === box.role);
    const party = version.participants.find((item) => item.role === box.role);
    page.drawRectangle({
      x,
      y: PAGE_HEIGHT - top - height,
      width,
      height,
      borderColor: lineColor,
      borderWidth: 0.6,
      color: formal ? rgb(1, 1, 1) : rgb(0.985, 0.99, 0.995),
    });
    page.drawText(ROLE_LABELS[box.role], {
      x: x + 7,
      y: PAGE_HEIGHT - top - 13,
      font: bold,
      size: 8,
      color: ink,
    });
    const nameLines = wrap(
      party?.fullName || "To‘ldiriladi",
      bold,
      7.4,
      width - 14,
    ).slice(0, 3);
    nameLines.forEach((line, index) =>
      page.drawText(line, {
        x: x + 7,
        y: PAGE_HEIGHT - top - 25 - index * 9,
        font: bold,
        size: 7.4,
        color: ink,
      }),
    );
    const imageBytes = images[box.role];
    if (signature && !imageBytes)
      throw new Error(`${ROLE_LABELS[box.role]} imzo tasviri topilmadi.`);
    if (imageBytes && !signature)
      throw new Error(
        "Imzo tasviri tegishli imzolash yozuviga bog‘lanishi kerak.",
      );
    if (signature && imageBytes) {
      const image = await document.embedPng(imageBytes);
      const imageTop = top + 30 + nameLines.length * 9;
      const availableHeight = height - (imageTop - top) - 25;
      const scaled = image.scaleToFit(
        width - 18,
        Math.max(16, availableHeight),
      );
      page.drawImage(image, {
        x: x + (width - scaled.width) / 2,
        y: PAGE_HEIGHT - imageTop - scaled.height,
        width: scaled.width,
        height: scaled.height,
      });
      page.drawText(dateTime(signature.signedAt), {
        x: x + 7,
        y: PAGE_HEIGHT - top - height + 14,
        font: regular,
        size: 6.8,
        color: formal ? ink : green,
      });
      page.drawText("Qo‘lda imzo qayd etilgan", {
        x: x + 7,
        y: PAGE_HEIGHT - top - height + 5,
        font: regular,
        size: 6.2,
        color: formal ? ink : green,
      });
    } else {
      page.drawLine({
        start: { x: x + 10, y: PAGE_HEIGHT - top - height + 31 },
        end: { x: x + width - 10, y: PAGE_HEIGHT - top - height + 31 },
        color: lineColor,
        thickness: 0.5,
      });
      page.drawText("Imzolash kutilmoqda", {
        x: x + 7,
        y: PAGE_HEIGHT - top - height + 12,
        font: regular,
        size: 7,
        color: formal ? ink : muted,
      });
    }
  }
}

async function makeDocx(
  agreementId: string,
  version: AgreementVersion,
  content: Block[],
  images: Partial<Record<SignerRole, Uint8Array>>,
) {
  const formal = version.templateVersion === 2;
  const textColor = formal ? "000000" : "20344B";
  const smallColor = formal ? "000000" : "64748B";
  const tableBorderColor = formal ? "000000" : "D5DFE8";
  const textSizes = { HEADING: 22, BODY: formal ? 22 : 20, SMALL: 16 };
  const children: (Paragraph | Table)[] = formal ? [
    new Paragraph({
      style: "Title",
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title(version), bold: true, size: 24, color: "000000" })],
      spacing: { after: 180 },
      keepNext: true,
    }),
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: 9986 }],
      children: [new TextRun({ text: `${version.terms.place}\t${agreementDate(version.terms.date)}`, bold: true, size: 21 })],
      spacing: { after: 160 },
      keepNext: true,
    }),
    new Paragraph({
      children: [new TextRun({
        text: `Kelishuv ${agreementId}. ${version.number}-nusxa. ${statusLabel(version)}.`,
        size: 16, color: "000000",
      })],
      spacing: { after: 120 },
    }),
  ] : [
    new Paragraph({
      children: [
        new TextRun({
          text: "KELISHUV AI",
          bold: true,
          size: 24,
          color: "18334E",
        }),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: title(version), bold: true, size: 27 })],
      spacing: { after: 160 },
    }),
    new Paragraph({
      text: `${version.terms.place} | ${version.terms.date} | Nusxa ${version.number}`,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Kelishuv ${agreementId} | ${statusLabel(version)}`,
          size: 17,
          color: "64748B",
        }),
      ],
      spacing: { after: 180 },
    }),
  ];
  for (const block of content) {
    if (block.kind === "DETAILS") {
      const rows: SignerRole[][] = [["FIRST_PARTY", "SECOND_PARTY"], ["MEDIATOR"]];
      for (const roles of rows) {
        const columns = roles.map(role => [
          ROLE_LABELS[role],
          ...partyDetails(version.participants.find(party => party.role === role)),
        ]);
        const keepTogether = columns.every(column => column.join(" ").length <= 700);
        children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [4993, 4993],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "000000" },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        },
        rows: columns[0].map((_, row) => new TableRow({
          tableHeader: row === 0,
          cantSplit: false,
          children: roles.map((role, column) => new TableCell({
            columnSpan: roles.length === 1 ? 2 : 1,
            width: { size: 100 / roles.length, type: WidthType.PERCENTAGE },
            margins: { top: 90, bottom: 90, left: 110, right: 110 },
            children: [new Paragraph({
              alignment: row === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
              children: [new TextRun({ text: clean(columns[column][row]), bold: row === 0 })],
              spacing: { after: 25, line: 250 },
              keepNext: row === 0 || (keepTogether && row < columns[column].length - 1),
            })],
          })),
        })),
        }));
        children.push(new Paragraph({
          children: [new TextRun({ text: "", size: 2 })],
          spacing: { after: 40, line: 20 },
        }));
      }
      continue;
    }
    const paragraphs = clean(block.text).split("\n");
    for (const line of paragraphs) {
      children.push(
        new Paragraph({
          alignment: formal && block.kind === "HEADING"
            ? AlignmentType.CENTER
            : formal && block.kind === "BODY" ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
          children: [
            new TextRun({
              text: line,
              bold: block.kind === "HEADING",
              size: textSizes[block.kind],
              color: block.kind === "SMALL" ? smallColor : textColor,
            }),
          ],
          keepNext: block.kind === "HEADING",
          spacing: {
            before: block.kind === "HEADING" ? formal ? 140 : 190 : 0,
            after: block.kind === "SMALL" ? 70 : formal ? 75 : 115,
            line: formal ? 260 : 280,
          },
        }),
      );
    }
  }
  children.push(
    new Paragraph({
      pageBreakBefore: !formal,
      alignment: formal ? AlignmentType.CENTER : AlignmentType.LEFT,
      keepNext: true,
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: formal ? "TARAFLARNING IMZOLARI VA MEDIATOR TASDIG‘I" : "Taraflarning imzolari va mediator tasdig‘i",
          bold: true,
          size: formal ? 22 : 25,
        }),
      ],
    }),
  );
  const cells = ROLES.map((role) => {
    const party = version.participants.find((item) => item.role === role);
    const signature = version.signatures.find((item) => item.role === role);
    const bytes = images[role];
    const cellChildren: Paragraph[] = [
      new Paragraph({
        children: [
          new TextRun({ text: ROLE_LABELS[role], bold: true, size: 20 }),
        ],
        spacing: { after: 110 },
      }),
      new Paragraph({
        text: party?.fullName || "To‘ldiriladi",
        spacing: { after: 150 },
      }),
    ];
    if (signature && bytes) {
      cellChildren.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: "png",
              data: bytes,
              transformation: { width: 145, height: 65 },
              altText: {
                title: `${ROLE_LABELS[role]} qo‘lda chizgan imzo`,
                description: party?.fullName || "",
                name: `signature-${role}`,
              },
            }),
          ],
          spacing: { after: 130 },
        }),
        new Paragraph({
          text: dateTime(signature.signedAt),
          spacing: { after: 70 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Qo‘lda imzo qayd etilgan",
              size: 16,
              color: formal ? "000000" : "267351",
            }),
          ],
        }),
      );
    } else
      cellChildren.push(
        new Paragraph({
          text: "Imzolash kutilmoqda",
          spacing: { before: 450, after: 130 },
        }),
      );
    return new TableCell({
      width: { size: 33.33, type: WidthType.PERCENTAGE },
      margins: { top: 130, bottom: 130, left: 130, right: 130 },
      children: cellChildren,
    });
  });
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 3, color: tableBorderColor },
        bottom: { style: BorderStyle.SINGLE, size: 3, color: tableBorderColor },
        left: { style: BorderStyle.SINGLE, size: 3, color: tableBorderColor },
        right: { style: BorderStyle.SINGLE, size: 3, color: tableBorderColor },
        insideVertical: { style: BorderStyle.SINGLE, size: 3, color: tableBorderColor },
      },
      rows: [new TableRow({ children: cells, cantSplit: formal })],
    }),
  );
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: `Mazmun SHA-256 ${version.contentHash}`,
        size: 16, color: formal ? "000000" : "64748B",
      })],
      spacing: { before: 240 },
      style: formal ? undefined : "Caption",
    }),
  );
  const embeddedFonts = formal ? await fonts(true) : undefined;
  const doc = new Document({
    creator: "KELISHUV AI",
    lastModifiedBy: "KELISHUV AI",
    title: title(version),
    subject: clean(version.terms.subject),
    revision: version.number,
    fonts: embeddedFonts ? [{
      name: "PT Serif", data: embeddedFonts.regular, bold: embeddedFonts.bold,
    }] : undefined,
    styles: {
      default: {
        document: {
          run: { font: formal ? "PT Serif" : "Inter", size: formal ? 22 : 20, color: textColor },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1000, bottom: 1000, left: 960, right: 960 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `KELISHUV AI | Nusxa ${version.number} | `,
                    size: 16,
                    color: smallColor,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: smallColor,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

export async function renderAgreementFiles({
  agreementId,
  version,
  signatureImages = {},
}: {
  agreementId: string;
  version: AgreementVersion;
  signatureImages?: Partial<Record<SignerRole, Uint8Array>>;
}): Promise<{
  pdf: Buffer;
  docx: Buffer;
  pageCount: number;
  boxes: SignatureBox[];
}> {
  const formal = version.templateVersion === 2;
  const data = await fonts(formal);
  const ink = formal ? rgb(0, 0, 0) : navy;
  const quiet = formal ? rgb(0.28, 0.28, 0.28) : muted;
  const textSizes = { HEADING: formal ? 10.5 : 10, BODY: formal ? 11 : 9.4, SMALL: 7.7 };
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const regular = await document.embedFont(data.regular, { subset: true });
  const bold = await document.embedFont(data.bold, { subset: true });
  const placeLines = formal
    ? wrap(version.terms.place.replace(/\s+/g, " "), bold, 10, BODY_WIDTH * 0.58)
    : [];
  const metadata = formal
    ? wrap(`Kelishuv ${agreementId}. ${version.number}-nusxa. ${statusLabel(version)}.`, regular, 7.5, BODY_WIDTH)
    : [];
  const createdAt = new Date(version.createdAt);
  if (!Number.isFinite(createdAt.getTime()))
    throw new Error("Hujjat yaratilgan vaqt noto‘g‘ri.");
  document.setCreationDate(createdAt);
  document.setModificationDate(
    new Date(version.signatures.at(-1)?.signedAt || version.createdAt),
  );
  document.setCreator("KELISHUV AI");
  document.setProducer("KELISHUV AI document engine");
  document.setTitle(title(version));
  document.setSubject(clean(version.terms.subject));
  const pages: PDFPage[] = [];
  let page: PDFPage;
  let cursor = 0;
  function newPage() {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    if (formal) {
      const heading = safeText(title(version), bold);
      page.drawText(heading, {
        x: (PAGE_WIDTH - bold.widthOfTextAtSize(heading, 12)) / 2,
        y: PAGE_HEIGHT - 45, font: bold, size: 12, color: ink,
      });
      const date = safeText(agreementDate(version.terms.date), bold);
      const headerPlace = placeLines.slice(0, 2);
      headerPlace.forEach((line, index) => page.drawText(line, {
        x: LEFT, y: PAGE_HEIGHT - 69 - index * 12, font: bold, size: 10, color: ink,
      }));
      page.drawText(date, {
        x: PAGE_WIDTH - LEFT - bold.widthOfTextAtSize(date, 10),
        y: PAGE_HEIGHT - 69, font: bold, size: 10, color: ink,
      });
      const metadataTop = 85 + Math.max(0, headerPlace.length - 1) * 12;
      const headerMetadata = metadata.slice(0, 2);
      headerMetadata.forEach((line, index) => page.drawText(line, {
        x: LEFT, y: PAGE_HEIGHT - metadataTop - index * 10, font: regular, size: 7.5, color: quiet,
      }));
      cursor = metadataTop + 21 + Math.max(0, headerMetadata.length - 1) * 10;
      return;
    }
    page.drawText("KELISHUV AI", {
      x: LEFT,
      y: PAGE_HEIGHT - 43,
      font: bold,
      size: 12,
      color: navy,
    });
    page.drawText(
      `Nusxa ${version.number} | ${version.terms.date} | ${statusLabel(version)}`,
      { x: LEFT, y: PAGE_HEIGHT - 59, font: regular, size: 8, color: muted },
    );
    const heading = wrap(title(version), bold, 11.5, BODY_WIDTH);
    heading.forEach((line, index) =>
      page.drawText(line, {
        x: LEFT,
        y: PAGE_HEIGHT - 83 - index * 15,
        font: bold,
        size: 11.5,
        color: navy,
      }),
    );
    cursor = 103 + (heading.length - 1) * 15;
    page.drawLine({
      start: { x: LEFT, y: PAGE_HEIGHT - cursor + 5 },
      end: { x: PAGE_WIDTH - LEFT, y: PAGE_HEIGHT - cursor + 5 },
      color: border,
      thickness: 0.6,
    });
    cursor += 12;
  }
  function drawDetails() {
    const rows: SignerRole[][] = [["FIRST_PARTY", "SECOND_PARTY"], ["MEDIATOR"]];
    for (const roles of rows) {
      const width = BODY_WIDTH / roles.length;
      const columns = roles.map(role => [
        ROLE_LABELS[role],
        ...partyDetails(version.participants.find(party => party.role === role))
          .flatMap(text => wrap(text, regular, 9.5, width - 18)),
      ]);
      const lineCount = Math.max(...columns.map(lines => lines.length));
      let offset = 0;
      while (offset < lineCount) {
        if (cursor + 65 > BODY_BOTTOM) newPage();
        const continued = offset > 0;
        const headerLines = continued ? 1 : 0;
        const count = Math.min(lineCount - offset, Math.floor((BODY_BOTTOM - cursor - 16) / 12) - headerLines);
        const height = (count + headerLines) * 12 + 16;
        columns.forEach((lines, column) => {
          const x = LEFT + column * width;
          page!.drawRectangle({
            x, y: PAGE_HEIGHT - cursor - height, width, height,
            borderColor: ink, borderWidth: 0.5,
          });
          const fragment = lines.slice(offset, offset + count);
          if (continued) fragment.unshift(ROLE_LABELS[roles[column]]);
          fragment.forEach((line, index) => {
            const heading = index === 0;
            const font = heading ? bold : regular;
            const size = heading ? 10 : 9.5;
            page!.drawText(line, {
              x: heading ? x + (width - font.widthOfTextAtSize(line, size)) / 2 : x + 9,
              y: PAGE_HEIGHT - cursor - 15 - index * 12,
              font, size, color: ink,
            });
          });
        });
        offset += count;
        cursor += height;
      }
      cursor += 8;
    }
  }
  newPage();
  const content: Block[] = [
    ...(!formal ? [{
      kind: "SMALL",
      text: `Kelishuv ${agreementId}. Joy ${version.terms.place}.`,
    } as Block] : []),
    ...(formal && placeLines.length > 2 ? [{
      kind: "SMALL",
      text: `Tuzilgan joy ${version.terms.place.replace(/\s+/g, " ")}`,
    } as Block] : []),
    ...(formal && metadata.length > 2 ? [{
      kind: "SMALL",
      text: metadata.join(" "),
    } as Block] : []),
    ...blocks(version),
  ];
  for (const [blockIndex, block] of content.entries()) {
    if (block.kind === "DETAILS") {
      drawDetails();
      continue;
    }
    const font = block.kind === "HEADING" ? bold : regular;
    const size = textSizes[block.kind];
    const leading = block.kind === "SMALL" ? 11.2 : formal ? 13.4 : 14.1;
    const lines = wrap(block.text, font, size, BODY_WIDTH);
    const before = block.kind === "HEADING" ? 11 : 0;
    const nextBlockHeight = formal && content[blockIndex + 1]?.kind === "DETAILS" ? 65 : 0;
    if (
      cursor +
        before +
        leading *
          Math.min(lines.length + (block.kind === "HEADING" ? 2 : 0), 3) + nextBlockHeight >
      BODY_BOTTOM
    )
      newPage();
    cursor += before;
    for (const [lineIndex, line] of lines.entries()) {
      if (cursor + leading > BODY_BOTTOM) newPage();
      if (line) {
        const words = line.split(" ");
        const justify = formal && block.kind === "BODY" && lineIndex < lines.length - 1 &&
          words.length > 1 && font.widthOfTextAtSize(line, size) > BODY_WIDTH * 0.7;
        if (justify) {
          const gap = (BODY_WIDTH - words.reduce((sum, word) => sum + font.widthOfTextAtSize(word, size), 0)) / (words.length - 1);
          let x = LEFT;
          for (const word of words) {
            page!.drawText(word, { x, y: PAGE_HEIGHT - cursor, font, size, color: ink });
            x += font.widthOfTextAtSize(word, size) + gap;
          }
        } else page!.drawText(line, {
          x: formal && block.kind === "HEADING" ? LEFT + (BODY_WIDTH - font.widthOfTextAtSize(line, size)) / 2 : LEFT,
          y: PAGE_HEIGHT - cursor,
          font,
          size,
          color: block.kind === "SMALL" ? quiet : ink,
        });
      }
      cursor += leading;
    }
    cursor += block.kind === "HEADING" ? 4 : 7;
  }
  const boxes = version.boxes.length
    ? structuredClone(version.boxes)
    : defaultBoxes(pages.length - 1);
  validateSignatureBoxes(boxes, pages.length);
  if (formal) {
    const heading = "TARAFLARNING IMZOLARI VA MEDIATOR TASDIG‘I";
    const pageBoxes = boxes.filter(box => box.page === boxes[0].page);
    pages[boxes[0].page].drawText(heading, {
      x: (PAGE_WIDTH - bold.widthOfTextAtSize(heading, 9.5)) / 2,
      y: PAGE_HEIGHT - Math.min(...pageBoxes.map(box => box.y)) * PAGE_HEIGHT + 16,
      font: bold, size: 9.5, color: ink,
    });
  }
  await drawSignatures(
    document,
    pages,
    version,
    boxes,
    regular,
    bold,
    signatureImages,
  );
  pages.forEach((item, index) => {
    item.drawLine({
      start: { x: LEFT, y: 38 },
      end: { x: PAGE_WIDTH - LEFT, y: 38 },
      color: formal ? quiet : border,
      thickness: 0.5,
    });
    item.drawText(
      `KELISHUV AI | ${version.number}-nusxa | ${index + 1} / ${pages.length}`,
      { x: LEFT, y: 24, font: regular, size: 7, color: quiet },
    );
    item.drawText("Qo‘lda chizilgan imzo va audit qaydi", {
      x: PAGE_WIDTH - LEFT - 180,
      y: 24,
      font: regular,
      size: 7,
      color: quiet,
    });
  });
  const [pdf, docx] = await Promise.all([
    document
      .save({ useObjectStreams: false, updateFieldAppearances: false })
      .then((bytes) => Buffer.from(bytes)),
    makeDocx(agreementId, version, content, signatureImages),
  ]);
  return { pdf, docx, pageCount: pages.length, boxes };
}
