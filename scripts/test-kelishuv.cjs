const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");
const { PDFDocument, PDFName, StandardFonts } = require("@cantoo/pdf-lib");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const JSZip = require("jszip");
const { crc32 } = require("node:zlib");
const { Document, Paragraph, Packer } = require("docx");

// Compile server modules in memory so these tests use the application's logic.
const cache = new Map();
function loadSource(relativePath) {
  const filename = path.resolve(relativePath);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  cache.set(filename, compiled);
  const nativeRequire = compiled.require.bind(compiled);
  compiled.require = (name) => {
    if (name === "server-only") return {};
    if (name.startsWith("@/")) {
      const resolved = path.resolve("src", name.slice(2));
      return resolved.endsWith(".json")
        ? nativeRequire(resolved)
        : loadSource(`${resolved}.ts`);
    }
    if (name.startsWith(".")) {
      const resolved = path.resolve(path.dirname(filename), name);
      if (fs.existsSync(`${resolved}.ts`)) return loadSource(`${resolved}.ts`);
    }
    return nativeRequire(name);
  };
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  compiled._compile(output, filename);
  return compiled.exports;
}

const domain = loadSource("src/lib/kelishuv-domain.ts");
const mediation = loadSource("src/lib/mediation.ts");
const workflow = loadSource("src/lib/ai-workflow.ts");
const provider = loadSource("src/lib/ai-provider.ts");
const documents = loadSource("src/lib/agreement-pdf.ts");
const { localeText } = loadSource("src/lib/locale-text.ts");
const extraction = loadSource("src/lib/evidence-extraction.ts");
const negotiation = loadSource("src/lib/negotiation.ts");
const payme = loadSource("src/lib/payme.ts");
const identityApi = loadSource("src/lib/identity-api.ts");
const serviceApi = loadSource("src/lib/service-api.ts");
const { NextRequest } = require("next/server");
const { randomUUID, createHmac } = require("node:crypto");

test("Uzbek interface uses the requested alphabet and preserves technical references", () => {
  assert.equal(localeText("O‘zbekcha: G‘ gʻ O' oʼ Sh sh CH ch", "uz"), "Özbekça: Ğ ğ Ö ö Ş ş Ç ç");
  assert.equal(localeText("KELISHUV AI — Yangi muammo boshlash", "uz"), "KELIŞUV AI — Yangi muammo boşlaş");
  assert.equal(localeText("Ma’lumot va san’at", "uz"), "Ma’lumot va san’at");
  assert.equal(localeText("SHA-256 https://lex.uz/docs/-3805227?search=shartnoma user@ish.uz `git push`", "uz"), "SHA-256 https://lex.uz/docs/-3805227?search=shartnoma user@ish.uz `git push`");
  assert.equal(localeText("Özbekça", "uz"), "Özbekça");
  assert.equal(localeText("O`zbek va g`oz", "uz"), "Özbek va ğoz");
  assert.equal(localeText("CHECK-123 REF-Ö42 `REF-Ö42`", "uz"), "CHECK-123 REF-Ö42 `REF-Ö42`");
  assert.equal(localeText("a".repeat(100000), "uz"), "a".repeat(100000));
  assert.equal(localeText("ö-".repeat(50000) + "ö", "uz"), "ö-".repeat(50000) + "ö");
  assert.equal(localeText("ish-beruvchi", "uz"), "iş-beruvçi");
  assert.equal(localeText("o'zbek@ish.uz", "uz"), "o'zbek@ish.uz");
  assert.equal(localeText("https://ish.uz/s\u0327 `s\u0327`", "uz"), "https://ish.uz/s\u0327 `s\u0327`");
  assert.equal(localeText("KELIŞUV AI", "ru"), "KELISHUV AI");
  assert.equal(localeText("Bosh sahifa", "ru"), "Главная страница");
});

test("new alphabet input matches existing cities and legal classifications", () => {
  const retrieval = loadSource("src/lib/legal-retrieval.ts");
  const legal = loadSource("src/lib/legal.ts");
  assert.equal(mediation.normalizeCity("Toşkent şahri"), mediation.normalizeCity("Toshkent shahri"));
  assert.equal(mediation.normalizeCity("Ğiştköprik"), mediation.normalizeCity("G‘ishtko‘prik"));
  assert.equal(legal.classify("Iş haqim tölanmagan"), "MEHNAT");
  assert.equal(legal.classify("Şartnoma böyiça tölov"), "SHARTNOMA");
  assert.equal(legal.isCriminal("Öğrilik va tahdid"), true);
  assert.equal(retrieval.normalizeLegalQuery("Iş haqini tölaş"), retrieval.normalizeLegalQuery("Ish haqini to‘lash"));
});
const users = [
  { id: "a", role: "CITIZEN", fullName: "First", isActive: true },
  { id: "b", role: "CITIZEN", fullName: "Second", isActive: true },
  { id: "m", role: "MEDIATOR", fullName: "Mediator", isActive: true },
  { id: "admin", role: "ADMIN", isActive: true },
];
const record = {
  id: "case",
  userId: "a",
  mediatorId: "mediator",
  type: "QARZ",
  description: "Shared contract description",
  claimAmount: 12,
  documents: [
    {
      id: "private-file",
      uploadedBy: "a",
      visibility: "MEDIATOR_ONLY",
      extraction: { text: "private evidence" },
    },
  ],
  positions: [
    {
      userId: "a",
      sharedStatement: "First shared statement",
      confidentialStatement: "secret-a",
      consent: { local: false, external: false },
    },
    {
      userId: "b",
      sharedStatement: "Second shared statement",
      confidentialStatement: "secret-b",
      consent: { local: false, external: false },
    },
  ],
  mediation: {
    respondentId: "b",
    initiatorConsent: { userId: "a", phone: "private-phone" },
    respondentConsent: { userId: "b" },
  },
};
const data = {
  users,
  mediators: [{ id: "mediator", userId: "m", verified: true }],
  cases: [record],
};
const participants = ["a", "b", "m"].map((userId, index) => ({
  userId,
  role: ["FIRST_PARTY", "SECOND_PARTY", "MEDIATOR"][index],
  fullName: userId,
}));
const terms = {
  subject: "Test agreement",
  agreedTerms: "Both parties agree to the written obligations.",
  totalAmount: 0,
  currency: "UZS",
  place: "Toshkent",
  date: "2026-11-20",
  paymentSchedule: [],
  obligations: [
    {
      id: "action",
      title: "Return contract",
      dueDate: "2026-12-01",
      assigneeId: "a",
      beneficiaryId: "b",
    },
  ],
  responsibilities: "Both parties report execution.",
  conditions: "Mediator checks the terms.",
  sourceIds: [],
};

test("shared case and other-party responses omit confidential content", () => {
  assert.doesNotMatch(
    JSON.stringify(domain.sharedCaseInput(record)),
    /secret-a|secret-b|private evidence/,
  );
  const visible = mediation.caseForViewer(data, record, users[1]);
  assert.doesNotMatch(
    JSON.stringify(visible),
    /secret-a|private evidence|private-phone/,
  );
  const admin = mediation.caseForViewer(data, record, users[3]);
  assert.doesNotMatch(
    JSON.stringify(admin),
    /secret-a|secret-b|private evidence/,
  );
});

test("private input fingerprints change when extracted evidence changes", () => {
  const changed = structuredClone(record);
  changed.documents[0].extraction.text = "new evidence";
  assert.notEqual(
    domain.privateReviewInputHash(record, "a"),
    domain.privateReviewInputHash(changed, "a"),
  );
});

test("zero-total settlements reject positive payment schedules", () => {
  const invalid = {
    ...terms,
    paymentSchedule: [
      {
        id: "payment",
        amount: 1,
        dueDate: "2026-12-01",
        payerId: "a",
        payeeId: "b",
      },
    ],
  };
  assert.ok(
    domain
      .validateAgreementTerms(invalid, "SETTLEMENT", participants)
      .some(
        (item) =>
          item.field === "paymentSchedule" && item.severity === "REQUIRED",
      ),
  );
});

test("four neutral schedules preserve totals including one-som claims", async () => {
  for (const claimAmount of [0, 1, 2, 7, 1_200_000]) {
    const review = await workflow.generateSharedReview(
      { ...domain.sharedCaseInput(record), claimAmount },
      { localConsent: false, externalConsent: false },
    );
    assert.equal(review.proposals.length, 4);
    for (const proposal of review.proposals) {
      assert.equal(
        proposal.schedule.reduce((sum, payment) => sum + payment.amount, 0),
        claimAmount,
      );
      assert.ok(proposal.schedule.every((payment) => payment.amount > 0));
    }
  }
});

test("audit verification detects modified events", () => {
  const state = { audit: [] };
  domain.audit(state, "a", "TEST", { caseId: "case" });
  domain.audit(state, "b", "TEST_2", { caseId: "case" });
  assert.equal(domain.verifyAudit(state.audit), true);
  state.audit[0].action = "CHANGED";
  assert.equal(domain.verifyAudit(state.audit), false);
});

test("fresh dispatch authorization prevents provider transmission", async () => {
  const originalFetch = global.fetch;
  let requests = 0;
  global.fetch = async () => {
    requests++;
    throw new Error("Unexpected transmission");
  };
  try {
    await assert.rejects(
      provider.runStructuredAI(
        { type: "object", properties: {}, additionalProperties: false },
        "test",
        "synthetic",
        {
          localConsent: true,
          externalConsent: true,
          beforeDispatch: async () => {
            throw new Error("consent revoked");
          },
        },
      ),
      /consent revoked/,
    );
    assert.equal(requests, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test("PDF render and signature layout work with Cyrillic text", async () => {
  const version = {
    id: "version",
    number: 1,
    createdAt: "2026-11-20T12:00:00Z",
    kind: "SETTLEMENT",
    terms: { ...terms, subject: "Келишув — Ўзбекистон" },
    participants,
    boxes: [],
    contentHash: "0".repeat(64),
    status: "DRAFT",
    signatures: [],
    validation: [],
    reviews: [],
  };
  const files = await documents.renderAgreementFiles({
    agreementId: "agreement",
    version,
  });
  const pdf = await PDFDocument.load(files.pdf);
  assert.equal(pdf.getPageCount(), files.pageCount);
  assert.equal(files.boxes.length, 3);
  assert.ok(files.docx.length > 500);
  assert.throws(() =>
    documents.validateSignatureBoxes(
      files.boxes.map((box) => ({ ...box, x: 0.1 })),
      files.pageCount,
    ),
  );
  const blank = createCanvas(900, 360).toBuffer("image/png");
  await assert.rejects(documents.validateSignaturePng(blank));
});

async function agreementPdfText(buffer) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = getDocument({ data: new Uint8Array(buffer), useSystemFonts: false });
  const document = await loading.promise;
  try {
    const pages = [];
    for (let page = 1; page <= document.numPages; page++) {
      const content = await (await document.getPage(page)).getTextContent();
      pages.push(content.items.map(item => item.str || "").join(" "));
    }
    return pages.join("\n");
  } finally {
    await loading.destroy();
  }
}

test("formal settlement template includes numbered terms, requisites and embedded serif fonts", async () => {
  const version = {
    id: "formal-version", number: 1, createdAt: "2026-11-21T04:00:00Z",
    kind: "SETTLEMENT", templateVersion: 2,
    terms: { ...terms, subject: "Қарз бўйича ўзаро келишув", totalAmount: 20000000,
      paymentSchedule: [{ id: "pay", amount: 20000000, dueDate: "2026-12-21", payerId: "b", payeeId: "a", description: "Qarz qoldig‘i" }] },
    participants: participants.map(party => ({ ...party, address: "Samarqand shahri", identityDetails: `TEST-REKVIZIT-${party.userId}`, phone: "+998900000000" })),
    boxes: [], contentHash: "0".repeat(64), status: "DRAFT", signatures: [], validation: [], reviews: [],
  };
  const files = await documents.renderAgreementFiles({ agreementId: "formal", version });
  const text = await agreementPdfText(files.pdf);
  for (const phrase of ["MEDIATIV KELISHUV", "KELISHUV PREDMETI", "KELISHUV SHARTLARI VA BAJARISH TARTIBI", "TARAFLARNING REKVIZITLARI", "TEST-REKVIZIT-a", "TEST-REKVIZIT-b", "TEST-REKVIZIT-m", "20 000 000", "Қарз бўйича ўзаро келишув"])
    assert.ok(text.includes(phrase), phrase);
  assert.ok(files.boxes.every(box => box.page === files.pageCount - 1));
  const zip = await JSZip.loadAsync(files.docx);
  const xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /TARAFLARNING REKVIZITLARI/);
  assert.match(xml, /w:gridSpan w:val="2"/);
  assert.match(xml, /w:pStyle w:val="Title"/);
  assert.equal(xml.match(/TARAFLARNING IMZOLARI VA MEDIATOR TASDIG‘I/g).length, 1);
  assert.match(await zip.file("word/fontTable.xml").async("string"), /embedBold/);
  assert.equal(Object.keys(zip.files).filter(name => /word\/fonts\/.*\.odttf$/.test(name)).length, 2);
  const canvas = createCanvas(900, 360), context = canvas.getContext("2d");
  context.strokeStyle = "#111111"; context.lineWidth = 5;
  context.beginPath(); context.moveTo(40, 230); context.bezierCurveTo(180, 20, 360, 320, 790, 100); context.stroke();
  const image = canvas.toBuffer("image/png");
  const signed = await documents.renderAgreementFiles({ agreementId: "formal", version: { ...version, boxes: files.boxes, status: "SIGNED", signatures: participants.map(party => ({ ...party, signedAt: "2026-11-21T04:10:00Z" })) }, signatureImages: { FIRST_PARTY: image, SECOND_PARTY: image, MEDIATOR: image } });
  assert.equal(signed.pageCount, files.pageCount);
  assert.deepEqual(signed.boxes, files.boxes);
  assert.equal((await agreementPdfText(signed.pdf)).match(/Qo‘lda imzo qayd etilgan/g).length, 3);
});

test("formal requisites paginate long fields without losing text", async () => {
  const version = {
    id: "long-formal", number: 1, createdAt: "2026-11-21T04:00:00Z", kind: "SETTLEMENT", templateVersion: 2,
    terms: { ...terms, agreedTerms: Array(15).fill("Taraflar hujjatlar va bajarish muddatlarini o‘zaro kelishib belgilaydi.").join(" "), place: "Samarqand shahri ".repeat(9).trim() },
    participants: participants.map(party => ({ ...party, fullName: `Ўзбекистон ${party.userId}`, address: "Samarqand ko‘chasi ".repeat(45) + `ADDRESS-END-${party.userId}`, identityDetails: "Taqdim etilgan rekvizitlar ".repeat(42) + `IDENTITY-END-${party.userId}`, phone: "" })),
    boxes: [], contentHash: "0".repeat(64), status: "DRAFT", signatures: [], validation: [], reviews: [],
  };
  const files = await documents.renderAgreementFiles({ agreementId: "long-formal", version });
  const text = await agreementPdfText(files.pdf);
  for (const party of participants) {
    assert.ok(text.includes(`ADDRESS-END-${party.userId}`));
    assert.ok(text.includes(`IDENTITY-END-${party.userId}`));
  }
  assert.ok(files.pageCount > 2);
  documents.validateSignatureBoxes(files.boxes, files.pageCount);
});

test("template version is bound to new content hashes while legacy hashes retain their representation", () => {
  const version = { kind: "SETTLEMENT", terms, participants, boxes: [], number: 1, id: "hash-version" };
  const legacy = domain.digest(JSON.stringify({ kind: version.kind, terms, participants, boxes: [], version: 1, id: version.id }));
  assert.equal(domain.agreementContentHash(version), legacy);
  assert.equal(domain.agreementContentHash({ ...version, templateVersion: undefined }), legacy);
  assert.notEqual(domain.agreementContentHash({ ...version, templateVersion: 2 }), legacy);
});

test("formal repeated headers stay bounded and retain a long complete place", async () => {
  const version = {
    id: "header-check", number: 1, createdAt: "2026-11-21T04:00:00Z", kind: "SETTLEMENT", templateVersion: 2,
    terms: { ...terms, place: "Samarqand\n".repeat(180) + "LOCATION-END" },
    participants, boxes: [], contentHash: "0".repeat(64), status: "DRAFT", signatures: [], validation: [], reviews: [],
  };
  const files = await documents.renderAgreementFiles({ agreementId: "header-check", version });
  assert.ok(files.pageCount < 10);
  assert.ok((await agreementPdfText(files.pdf)).includes("LOCATION-END"));
  documents.validateSignatureBoxes(files.boxes, files.pageCount);
});

test("formal signature heading follows the boxes on its own page", async () => {
  const version = {
    id: "signature-page-check",
    number: 1,
    createdAt: "2026-11-21T04:00:00Z",
    kind: "SETTLEMENT",
    templateVersion: 2,
    terms: {
      ...terms,
      agreedTerms: "Taraflar hujjatlar va bajarish muddatlarini o‘zaro kelishib belgilaydi. ".repeat(60),
    },
    participants,
    boxes: [],
    contentHash: "0".repeat(64),
    status: "DRAFT",
    signatures: [],
    validation: [],
    reviews: [],
  };
  const initial = await documents.renderAgreementFiles({ agreementId: "signature-pages", version });
  assert.ok(initial.pageCount > 1);
  const boxes = initial.boxes.map((box, index) => ({
    ...box,
    page: index === 2 ? initial.pageCount - 1 : 0,
    y: index === 2 ? 0.74 : 0.82,
    height: 0.12,
  }));
  const files = await documents.renderAgreementFiles({
    agreementId: "signature-pages",
    version: { ...version, boxes },
  });
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = getDocument({ data: new Uint8Array(files.pdf), useSystemFonts: false });
  const document = await loading.promise;
  try {
    const page = await document.getPage(1);
    const content = await page.getTextContent();
    const heading = content.items.find(item => item.str?.includes("TARAFLARNING IMZOLARI"));
    assert.ok(heading);
    const pageHeight = page.getViewport({ scale: 1 }).height;
    const expectedY = pageHeight * (1 - boxes[0].y) + 16;
    assert.ok(Math.abs(heading.transform[5] - expectedY) < 1, `Signature heading y=${heading.transform[5]}, expected ${expectedY}`);
  } finally {
    await loading.destroy();
  }
});

test("scanned PDF dimensions are bounded before native canvas allocation", async () => {
  const originalFetch = global.fetch;
  const previousProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "OLLAMA";
  let checked = false;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    const image = await loadImage(
      Buffer.from(body.messages[1].images[0], "base64"),
    );
    assert.ok(image.width <= 1600 && image.height <= 1600);
    assert.ok(image.width * image.height <= 2_000_000);
    checked = true;
    return new Response(
      JSON.stringify({
        done: true,
        message: {
          content: JSON.stringify({
            text: "",
            names: [],
            dates: [],
            amounts: [],
            obligations: [],
            deadlines: [],
            clauses: [],
            visibleSignatures: [],
            warnings: [],
          }),
        },
      }),
    );
  };
  try {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    page.node.set(
      PDFName.of("MediaBox"),
      pdf.context.obj([0, 0, 100_000_000, 100_000_000]),
    );
    await extraction.extractEvidence(
      { name: "synthetic-scan.pdf", mime: "application/pdf" },
      Buffer.from(await pdf.save()),
      { localConsent: true, externalConsent: false },
    );
    assert.equal(checked, true);
  } finally {
    global.fetch = originalFetch;
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
  }
});

test("bounded DOCX archives still extract ordinary documents", async () => {
  const buffer = await Packer.toBuffer(
    new Document({
      sections: [
        { children: [new Paragraph("Synthetic bounded document text")] },
      ],
    }),
  );
  const result = await extraction.extractEvidence(
    {
      name: "document.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    buffer,
    { localConsent: false, externalConsent: false },
  );
  assert.match(result.text, /Synthetic bounded document text/);
});

test("DOCX size bounds use the ZIP directory and actual decompression", async () => {
  const zip = new JSZip();
  const fakeHeader = Buffer.alloc(140_000);
  fakeHeader.writeUInt32LE(0x02014b50);
  fakeHeader.writeUInt16LE(65535, 28);
  fakeHeader.writeUInt16LE(65535, 30);
  fakeHeader.writeUInt16LE(65535, 32);
  zip.file("padding", fakeHeader, { compression: "STORE" });
  zip.file("word/document.xml", Buffer.alloc(31 * 1024 * 1024, 65));
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  const document = {
    name: "oversized.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  await assert.rejects(
    extraction.extractEvidence(document, buffer, {
      localConsent: false,
      externalConsent: false,
    }),
  );
  const forged = Buffer.from(buffer);
  // Forge the declared size in the real central directory to exercise streaming bounds.
  for (let offset = forged.length - 46; offset > 0; offset--) {
    if (
      forged.readUInt32LE(offset) === 0x02014b50 &&
      forged.readUInt32LE(offset + 24) > 30 * 1024 * 1024
    ) {
      forged.writeUInt32LE(1, offset + 24);
      break;
    }
  }
  await assert.rejects(
    extraction.extractEvidence(document, forged, {
      localConsent: false,
      externalConsent: false,
    }),
  );
});

test("encoded image dimensions are checked before native decoding", async () => {
  const buffer = createCanvas(1, 1).toBuffer("image/png");
  buffer.writeUInt32BE(100_000, 16);
  buffer.writeUInt32BE(100_000, 20);
  buffer.writeUInt32BE(crc32(buffer.subarray(12, 29)), 29);
  await assert.rejects(
    extraction.extractEvidence(
      { name: "large.png", mime: "image/png" },
      buffer,
      { localConsent: true, externalConsent: false },
    ),
    /Rasm formati yoki o‘lchamini/,
  );
});

test("compressed single-page PDF text is capped in an isolated process", async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage();
  page.node.set(PDFName.of("MediaBox"), pdf.context.obj([0, 0, 40_000_000, 800]));
  page.node.set(
    PDFName.of("Resources"),
    pdf.context.obj({ Font: { F1: font.ref } }),
  );
  const content = Buffer.from(
    "BT /F1 12 Tf 10 10 Td (" + "A".repeat(2 * 1024 * 1024) + ") Tj ET",
  );
  page.node.set(
    PDFName.of("Contents"),
    pdf.context.register(pdf.context.flateStream(content)),
  );
  const buffer = Buffer.from(await pdf.save());
  assert.ok(buffer.length < 20_000);
  const result = await extraction.extractEvidence(
    { name: "compressed-text.pdf", mime: "application/pdf" },
    buffer,
    { localConsent: false, externalConsent: false },
  );
  assert.equal(result.text.length, 18000);
  assert.ok(result.warnings.some((warning) => warning.includes("18000")));
});

test("negotiation unlocks exactly one proposal after both parties answer", () => {
  const sample = structuredClone(record);
  sample.aiReview = { id: "review", proposals: ["QUICK", "BALANCED", "INSTALLMENTS", "FLEXIBLE"].map(id => ({ id })) };
  sample.proposalDecisions = [];
  assert.equal(negotiation.negotiationState(sample).round, 1);
  for (let index = 0; index < 4; index++) {
    const proposalId = sample.aiReview.proposals[index].id;
    sample.proposalDecisions.push({ reviewId: "review", proposalId, userId: "a", decision: "REJECT" });
    assert.equal(negotiation.negotiationState(sample).index, index);
    sample.proposalDecisions.push({ reviewId: "review", proposalId, userId: "b", decision: "CHANGES" });
    assert.equal(negotiation.negotiationState(sample).index, index + 1);
  }
  assert.equal(negotiation.negotiationState(sample).exhausted, true);
  sample.aiReview.id = "changed-review";
  assert.equal(negotiation.negotiationState(sample).round, 1);
});

test("mutual proposal acceptance closes the current round", () => {
  const sample = structuredClone(record);
  sample.aiReview = { id: "review", proposals: [{ id: "QUICK" }, { id: "BALANCED" }] };
  sample.proposalDecisions = ["a", "b"].map(userId => ({ userId, reviewId: "review", proposalId: "QUICK", decision: "ACCEPT" }));
  const state = negotiation.negotiationState(sample);
  assert.equal(state.agreed, true);
  assert.equal(state.index, 0);
});

test("private invitation token is omitted from every case view", () => {
  const sample = structuredClone(record);
  sample.mediation.invitationToken = "private-invitation-token";
  sample.mediation.invitationHash = "private-invitation-hash";
  sample.mediation.invitationRequestId = "private-invitation-request";
  for (const user of users) assert.doesNotMatch(JSON.stringify(mediation.caseForViewer(data, sample, user)), /private-invitation/);
});

function paymentFixture() {
  const order = { id: randomUUID(), userId: "a", caseId: "case", kind: "TEMPLATE", templateId: "DEMAND", amount: 19000, status: "PENDING" };
  return { order, data: { serviceOrders: [order], paymentTransactions: [] } };
}

test("Payme verifies tiyin amount and persists idempotent payment transitions", () => {
  const fixture = paymentFixture();
  const params = { id: "provider-transaction", time: Date.now(), amount: 1900000, account: { order_id: fixture.order.id } };
  assert.throws(() => payme.paymeOperation(fixture.data, "CheckPerformTransaction", { ...params, amount: 19000 }), /summasi/);
  assert.equal(payme.paymeOperation(fixture.data, "CheckPerformTransaction", params).allow, true);
  const created = payme.paymeOperation(fixture.data, "CreateTransaction", params);
  assert.deepEqual(payme.paymeOperation(fixture.data, "CreateTransaction", params), created);
  assert.throws(() => payme.paymeOperation(fixture.data, "CreateTransaction", { ...params, id: "duplicate" }), /holati/);
  const performed = payme.paymeOperation(fixture.data, "PerformTransaction", params);
  assert.equal(fixture.order.status, "PAID");
  assert.equal(performed.state, 2);
  assert.deepEqual(payme.paymeOperation(fixture.data, "PerformTransaction", params), performed);
  assert.equal(fixture.data.paymentTransactions.length, 1);
  assert.ok(serviceApi.hasTemplatePurchase(fixture.data, "a", "case"));
  assert.equal(serviceApi.hasTemplatePurchase(fixture.data, "b", "case"), undefined);
});

test("Payme cancellation revokes access and consumed services require refund review", () => {
  const fixture = paymentFixture();
  const params = { id: "provider-transaction", time: Date.now(), amount: 1900000, account: { order_id: fixture.order.id } };
  payme.paymeOperation(fixture.data, "CreateTransaction", params);
  payme.paymeOperation(fixture.data, "PerformTransaction", params);
  fixture.order.consumedAt = new Date().toISOString();
  assert.throws(() => payme.paymeOperation(fixture.data, "CancelTransaction", { id: params.id, reason: 5 }), /Xizmat/);
  assert.equal(fixture.order.status, "PAID");
  delete fixture.order.consumedAt;
  const cancelled = payme.paymeOperation(fixture.data, "CancelTransaction", { id: params.id, reason: 5 });
  assert.equal(cancelled.state, -2);
  assert.equal(fixture.order.status, "CANCELLED");
  assert.equal(serviceApi.hasTemplatePurchase(fixture.data, "a", "case"), undefined);
  assert.deepEqual(payme.paymeOperation(fixture.data, "CancelTransaction", { id: params.id, reason: 5 }), cancelled);
});

test("Payme expires unpaid transactions and prevents payment after timeout", () => {
  const fixture = paymentFixture();
  const params = { id: "provider-transaction", time: Date.now(), amount: 1900000, account: { order_id: fixture.order.id } };
  payme.paymeOperation(fixture.data, "CreateTransaction", params);
  fixture.data.paymentTransactions[0].providerTime -= 43200001;
  assert.throws(() => payme.paymeOperation(fixture.data, "PerformTransaction", params), /bekor/);
  assert.equal(fixture.data.paymentTransactions[0].state, -1);
  assert.equal(fixture.order.status, "PENDING");
});

test("identity completion requires a signed callback with matching document digits", async () => {
  const previous = process.env.IDENTITY_WEBHOOK_SECRET;
  process.env.IDENTITY_WEBHOOK_SECRET = randomUUID();
  const check = { id: randomUUID(), userId: "a", sessionId: "session", status: "PENDING", updatedAt: new Date().toISOString(), fields: { firstName: "Ali", lastName: "Valiyev", middleName: "", birthDate: "1990-01-01", address: "Toshkent", documentNumber: "AA1111111" } };
  const sample = { identityChecks: [check] };
  async function callback(fields, sign = true) {
    const body = JSON.stringify({ reference: check.id, sessionId: check.sessionId, status: "VERIFIED", liveness: true, documentVerified: true, fields });
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", process.env.IDENTITY_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest("hex");
    return identityApi.identityWebhook(new NextRequest("http://localhost:2345/api/webhooks/identity", { method: "POST", headers: { "x-identity-timestamp": timestamp, "x-identity-signature": sign ? signature : "invalid" }, body }), async operation => operation(sample));
  }
  try {
    await assert.rejects(callback(check.fields, false), /imzosi/);
    assert.equal(check.status, "PENDING");
    await callback({ ...check.fields, documentNumber: "AA2222222" });
    assert.equal(check.status, "FAILED");
    check.status = "PENDING";
    await callback(check.fields);
    assert.equal(check.status, "VERIFIED");
    await callback({ ...check.fields, firstName: "Changed" });
    assert.equal(check.status, "VERIFIED");
  } finally { if (previous === undefined) delete process.env.IDENTITY_WEBHOOK_SECRET; else process.env.IDENTITY_WEBHOOK_SECRET = previous; }
});

test("changing a phone invalidates verification and prevents duplicate phones", () => {
  const sample = { users: [{ id: "a", phone: "+998901234567", phoneVerifiedAt: "verified" }, { id: "b", phone: "+998 91 123 45 67" }] };
  mediation.setUserPhone(sample, sample.users[0], "+998 90 123 45 67");
  assert.equal(sample.users[0].phoneVerifiedAt, "verified");
  assert.throws(() => mediation.setUserPhone(sample, sample.users[0], "+998911234567"), /boshqa/);
  mediation.setUserPhone(sample, sample.users[0], "+998931234567");
  assert.equal(sample.users[0].phoneVerifiedAt, undefined);
});

test("public assistant returns catalog citations without reading private cases", async () => {
  const previous = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "RULES";
  const retrieval = loadSource("src/lib/legal-retrieval.ts");
  const originalRetrieve = retrieval.retrieveLegalEvidence;
  const store = loadSource("src/lib/store.ts");
  const originalRead = store.readStore;
  const legal = loadSource("src/lib/legal.ts");
  retrieval.retrieveLegalEvidence = async (text) => ({
    sources: [
      ...new Map(
        [
          ...legal.analyzeLocal(text, legal.classify(text), 0).sources,
          ...legal.searchLaws(text, legal.classify(text)),
        ].map((source) => [source.id, source]),
      ).values(),
    ].map((source) => ({
      ...source,
      content: source.content || source.summary,
      kind: "LAW",
      current: false,
    })),
    documents: 25,
    articles: 7368,
    semantic: false,
    live: false,
    courtSources: 0,
  });
  store.readStore = async () => {
    throw new Error("Assistant must not access private cases");
  };
  try {
    const assistant = loadSource("src/lib/assistant.ts");
    const answer = await assistant.answerAssistant(
      "Ish beruvchi ikki oylik ish haqimni to‘lamadi, qaysi qonun menga yordam beradi?",
      [],
      false,
      "uz",
    );
    assert.ok(answer.sources.length > 0);
    for (const source of answer.sources) {
      assert.ok(
        legal.LEGAL_SOURCES.some(
          (item) =>
            item.id === source.id &&
            item.url === source.url &&
            item.summary === source.summary,
        ),
      );
      assert.ok(source.verifiedAt);
      assert.match(source.url, /^https:\/\/lex\.uz\//);
    }
    assert.equal(
      (
        await assistant.answerAssistant(
          "Sayt qanday ishlaydi?",
          [],
          false,
          "uz",
        )
      ).sources.length,
      0,
    );
    assert.ok(
      (
        await assistant.answerAssistant(
          "Telefon sotib oldim, nuqsoni bor. Kafolat bo‘yicha qanday huquqlarim bor?",
          [],
          false,
          "uz",
        )
      ).sources.length > 0,
    );
    assert.match(
      (
        await assistant.answerAssistant(
          "Platforma narxi qancha?",
          [],
          false,
          "uz",
        )
      ).answer,
      /19 000/,
    );
    assert.match(
      (
        await assistant.answerAssistant(
          "Как работает платформа?",
          [],
          false,
          "ru",
        )
      ).answer,
      /Нажмите/,
    );
    assert.match(
      (
        await assistant.answerAssistant(
          "Сайт қандай ишлайди?",
          [],
          false,
          "uz-Cyrl",
        )
      ).answer,
      /орқали/,
    );
    const russian = await assistant.answerAssistant(
      "Работодатель не выплатил зарплату, какие законы применяются?",
      [],
      false,
      "ru",
    );
    assert.match(russian.answer, /Сопоставьте/);
    assert.ok(russian.sources.some((source) => source.url.includes("6257288")));
    assert.ok(
      russian.sources.every((source) => source.originalLanguage === "uz"),
    );
    assert.ok(
      (
        await assistant.answerAssistant(
          "Сайтдан сифатсиз товар сотиб олдим",
          [],
          false,
          "uz-Cyrl",
        )
      ).sources.some((source) => source.url.includes("4704")),
    );
  } finally {
    retrieval.retrieveLegalEvidence = originalRetrieve;
    store.readStore = originalRead;
    if (previous === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previous;
  }
});

test("Payme distinguishes invalid requests from persistence failures", async () => {
  const previous = process.env.PAYME_SECRET;
  process.env.PAYME_SECRET = randomUUID();
  const headers = { Authorization: `Basic ${Buffer.from(`Paycom:${process.env.PAYME_SECRET}`).toString('base64')}` };
  try {
    const invalid = await payme.handlePaymeRequest(new NextRequest('http://localhost:2345/api/payments/payme', { method:'POST', headers, body:'{}' }), async () => { throw new Error('should not mutate'); });
    assert.equal((await invalid.json()).error.code,-32600);
    const failed = await payme.handlePaymeRequest(new NextRequest('http://localhost:2345/api/payments/payme', { method:'POST', headers, body:JSON.stringify({id:1,method:'GetStatement',params:{from:0,to:1}}) }), async () => { throw new Error('disk unavailable'); });
    assert.equal((await failed.json()).error.code,-32400);
  } finally { if (previous === undefined) delete process.env.PAYME_SECRET; else process.env.PAYME_SECRET = previous; }
});

function serviceFixture() {
  const sample = structuredClone(record);
  sample.history = [];
  sample.type = "SHARTNOMA";
  sample.status = "IN_PROGRESS";
  sample.analysis = { sources: [] };
  sample.mediation.initiatorConsent = {
    userId: "a",
    textVersion: mediation.CONSENT_VERSION,
  };
  sample.mediation.respondentConsent = {
    userId: "b",
    textVersion: mediation.CONSENT_VERSION,
  };
  sample.mediation.mediatorApprovals = ["a", "b"].map((userId) => ({
    userId,
    mediatorId: "mediator",
  }));
  return {
    users: structuredClone(users),
    cases: [sample],
    mediators: structuredClone(data.mediators),
    serviceOrders: [],
    mediatorInvoices: [],
    sessions: [
      {
        id: "session",
        caseId: "case",
        type: "ONLINE",
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        duration: 30,
      },
    ],
    audit: [],
  };
}

test("service orders reject irrelevant kind fields and preserve retry identity", async () => {
  const sample = serviceFixture();
  const input = {requestId:randomUUID(),kind:'TEMPLATE',caseId:'case',templateId:'DEMAND'};
  const request = body => new NextRequest('http://localhost:2345/api/services/orders',{method:'POST',body:JSON.stringify(body)});
  await assert.rejects(serviceApi.handleServiceRequest(request({...input,invoiceId:randomUUID()}),users[0],async operation=>operation(sample)));
  const first = await serviceApi.handleServiceRequest(request(input),users[0],async operation=>operation(sample));
  const second = await serviceApi.handleServiceRequest(request(input),users[0],async operation=>operation(sample));
  assert.equal((await first.json()).order.id,(await second.json()).order.id);
  assert.equal(sample.serviceOrders.length,1);
});

test("mediator invoice and party orders preserve odd-som totals and commission", async () => {
  const sample = serviceFixture();
  const invoiceResponse = await serviceApi.handleServiceRequest(new NextRequest('http://localhost:2345/api/cases/case/invoice',{method:'POST',body:JSON.stringify({amount:1001,confirm:true})}),users[2],async operation=>operation(sample));
  const invoice = (await invoiceResponse.json()).invoice;
  assert.equal(invoice.parties.reduce((sum,party)=>sum+party.amount,0),1001);
  assert.equal(invoice.parties.reduce((sum,party)=>sum+party.platformFee,0),150);
  assert.equal(invoice.mediatorNet,851);
  sample.agreements = [{caseId:'case',kind:'SETTLEMENT',currentVersionId:'v',versions:[{id:'v',status:'SIGNED'}]}];
  for (const user of users.slice(0,2)) await serviceApi.handleServiceRequest(new NextRequest('http://localhost:2345/api/services/orders',{method:'POST',body:JSON.stringify({requestId:randomUUID(),kind:'MEDIATOR',caseId:'case',invoiceId:invoice.id})}),user,async operation=>operation(sample));
  assert.equal(sample.serviceOrders.reduce((sum,order)=>sum+order.amount,0),1001);
  assert.equal(sample.serviceOrders.reduce((sum,order)=>sum+order.platformFee,0),150);
  assert.equal(sample.serviceOrders.reduce((sum,order)=>sum+order.mediatorNet,0),851);
});

test("Zoom clears definite failures and recovers ambiguous results without another meeting", async () => {
  const keys = ['ZOOM_ACCOUNT_ID','ZOOM_CLIENT_ID','ZOOM_CLIENT_SECRET','ZOOM_HOST_USER_ID'];
  const previous = keys.map(key=>process.env[key]);
  const previousFetch = global.fetch;
  for(const key of keys) process.env[key]=randomUUID();
  const sample = serviceFixture();
  const request = () => new NextRequest('http://localhost:2345/api/sessions/session/zoom',{method:'POST'});
  let creations=0;
  try {
    global.fetch=async()=>new Response('{}',{status:401});
    await assert.rejects(serviceApi.handleServiceRequest(request(),users[2],async operation=>operation(sample)));
    assert.equal(sample.sessions[0].zoomRequestId,undefined);
    global.fetch=async url=>{
      if(String(url).includes('/oauth/token')) return Response.json({access_token:'temporary-test-access'});
      creations++;throw new Error('connection lost after dispatch');
    };
    await assert.rejects(serviceApi.handleServiceRequest(request(),users[2],async operation=>operation(sample)));
    assert.ok(sample.sessions[0].zoomRequestId);
    await assert.rejects(serviceApi.handleServiceRequest(request(),users[2],async operation=>operation(sample)),/davom/);
    sample.sessions[0].zoomRequestedAt=new Date(Date.now()-61000).toISOString();
    global.fetch=async url=>{
      if(String(url).includes('/oauth/token')) return Response.json({access_token:'temporary-test-access'});
      assert.ok(String(url).includes('?type=scheduled'));
      return Response.json({meetings:[{id:'123456',agenda:sample.sessions[0].zoomRequestId,join_url:'https://zoom.us/j/123456'}],next_page_token:''});
    };
    const recovered=await serviceApi.handleServiceRequest(request(),users[2],async operation=>operation(sample));
    assert.equal((await recovered.json()).zoom.meetingId,'123456');
    assert.equal(creations,1);
  } finally { global.fetch=previousFetch; keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];}); }
});

test("a paid template produces DOCX and atomically records its consumed entitlement", async () => {
  const sample = serviceFixture();
  const order={id:randomUUID(),userId:'a',caseId:'case',kind:'TEMPLATE',templateId:'DEMAND',status:'PAID',amount:19000};
  sample.serviceOrders.push(order);
  const store=loadSource('src/lib/store.ts');
  const originalRead=store.readStore;
  store.readStore=async()=>sample;
  try {
    const response=await serviceApi.handleServiceRequest(new NextRequest('http://localhost:2345/api/templates/download',{method:'POST',body:JSON.stringify({orderId:order.id,confirmed:true,fields:{recipient:'Test recipient',applicant:'Test applicant',facts:'Synthetic facts for the document.',request:'Please review the supplied documents.',attachments:'Test evidence'}})}),users[0],async operation=>operation(sample));
    assert.match(response.headers.get('content-type'),/wordprocessingml/);
    const archive=await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    assert.match(await archive.file('word/document.xml').async('string'),/Synthetic facts/);
    assert.ok(order.consumedAt);
    assert.equal(order.draft.applicant,'Test applicant');
  } finally {store.readStore=originalRead;}
});

test("phone normalization preserves digit-containing email credentials", () => {
  const catalog=loadSource('src/lib/service-catalog.ts');
  assert.equal(catalog.normalizePhone('user123456789@example.com'),'');
  assert.equal(catalog.normalizePhone('998901234567@example.com'),'');
  assert.equal(catalog.normalizePhone('+998 90 123 45 67'),'+998901234567');
});

test("signed identity callbacks can finish before the provider session response", async () => {
  const previous=process.env.IDENTITY_WEBHOOK_SECRET;
  process.env.IDENTITY_WEBHOOK_SECRET=randomUUID();
  const fields={firstName:'Ali',lastName:'Valiyev',middleName:'',birthDate:'1990-01-01',address:'Test',documentNumber:'TEST123'};
  const check={id:randomUUID(),userId:'a',status:'PENDING',fields,sessionStartedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  const body=JSON.stringify({reference:check.id,sessionId:'early-provider-session',status:'VERIFIED',liveness:true,documentVerified:true,fields});
  const timestamp=String(Date.now());
  const signature=createHmac('sha256',process.env.IDENTITY_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');
  try {
    await identityApi.identityWebhook(new NextRequest('http://localhost:2345/api/webhooks/identity',{method:'POST',headers:{'x-identity-timestamp':timestamp,'x-identity-signature':signature},body}),async operation=>operation({identityChecks:[check],users:[]}));
    assert.equal(check.status,'VERIFIED');assert.equal(check.sessionId,'early-provider-session');
  } finally {if(previous===undefined)delete process.env.IDENTITY_WEBHOOK_SECRET;else process.env.IDENTITY_WEBHOOK_SECRET=previous;}
});

test("expired pending identity sessions release fields and rotate their reference", async () => {
  const fields={firstName:'Ali',lastName:'Valiyev',middleName:'',birthDate:'1990-01-01',address:'Test',documentNumber:'TEST123'};
  const check={id:randomUUID(),userId:'a',status:'PENDING',fields,sessionId:'old-session',sessionStartedAt:new Date(Date.now()-1800001).toISOString(),updatedAt:new Date().toISOString()};
  const previousId=check.id;
  await identityApi.handleIdentityRequest(new NextRequest('http://localhost:2345/api/identity/fields',{method:'PUT',body:JSON.stringify({...fields,firstName:'Updated'})}),users[0],async operation=>operation({identityChecks:[check]}));
  assert.equal(check.status,'REVIEW_REQUIRED');assert.notEqual(check.id,previousId);assert.equal(check.sessionId,undefined);assert.equal(check.fields.firstName,'Updated');
});

test("legacy mediator queue cases retain their next-step guidance", () => {
  const sample=serviceFixture().cases[0];
  sample.mediatorId=undefined;
  sample.status='OPEN_FOR_MEDIATORS';
  const journey=loadSource('src/lib/case-journey.ts');
  assert.match(journey.caseNextStep(sample,'a').href,/section=positions/);
  sample.journeyVersion=3;
  assert.match(journey.caseNextStep(sample,'a').href,/section=analysis/);
});

test("replacing an SMS invitation clears its delivery status on email retries", async () => {
  const previousToken=process.env.ESKIZ_TOKEN;
  delete process.env.ESKIZ_TOKEN;
  const sample=serviceFixture();
  const first={...users[0],email:'first@example.test',phone:'+998901234567'};
  sample.users[0]=first;
  const record=sample.cases[0];
  record.mediatorId=undefined;record.mediation.respondentId=undefined;record.history=[];record.region='Toshkent shahri';record.city='Toshkent';
  const store=loadSource('src/lib/store.ts');const originalRead=store.readStore;store.readStore=async()=>sample;
  const mediationApi=loadSource('src/lib/mediation-api.ts');
  const request=body=>new NextRequest('http://localhost:2345/api/cases/case/invitation',{method:'POST',body:JSON.stringify(body)});
  try {
    const phone=await mediationApi.handleMediationRequest(request({requestId:randomUUID(),phone:'+998931234567',name:'Second',city:'Toshkent'}),first,async operation=>operation(sample));
    assert.equal((await phone.json()).smsStatus,'UNCONFIGURED');
    const input={requestId:randomUUID(),email:'second@example.test',name:'Second',city:'Toshkent'};
    const email=await mediationApi.handleMediationRequest(request(input),first,async operation=>operation(sample));
    const replay=await mediationApi.handleMediationRequest(request(input),first,async operation=>operation(sample));
    assert.equal((await email.json()).smsStatus,null);assert.equal((await replay.json()).smsStatus,null);
  } finally {store.readStore=originalRead;if(previousToken===undefined)delete process.env.ESKIZ_TOKEN;else process.env.ESKIZ_TOKEN=previousToken;}
});

test("application origins use configured or local URLs and ignore arbitrary Origin headers", () => {
  const providers=loadSource('src/lib/service-providers.ts');
  const keys=['APP_PUBLIC_URL','AUTH_URL'];const previous=keys.map(key=>process.env[key]);keys.forEach(key=>delete process.env[key]);
  try {
    assert.throws(()=>providers.applicationOrigin(new NextRequest('https://platform.example/api/identity/session',{headers:{Origin:'https://attacker.example'}})),/HTTPS/);
    assert.equal(providers.applicationOrigin(new NextRequest('http://localhost:2345/api/identity/session',{headers:{Origin:'https://attacker.example'}})),'http://localhost:2345');
    process.env.APP_PUBLIC_URL='https://platform.example';
    assert.equal(providers.applicationOrigin(new NextRequest('https://attacker.example/api/identity/session')),'https://platform.example');
  } finally {keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];});}
});

test("a stale identity document read returns a retryable conflict", async () => {
  const store=loadSource('src/lib/store.ts'),files=loadSource('src/lib/documents.ts');
  const originalRead=store.readStore,originalLoad=files.loadDocument;
  store.readStore=async()=>({identityChecks:[{id:randomUUID(),userId:'a',status:'REVIEW_REQUIRED',document:{storageKey:randomUUID(),mime:'image/png'}}]});
  files.loadDocument=async()=>{throw new Error('document replaced');};
  try {await assert.rejects(identityApi.handleIdentityRequest(new NextRequest('http://localhost:2345/api/identity/extract',{method:'POST',body:JSON.stringify({localConsent:true,externalConsent:false})}),users[0],async()=>{throw new Error('should not mutate');}),error=>error.status===409);}
  finally {store.readStore=originalRead;files.loadDocument=originalLoad;}
});

test("Zoom fences expired attempts before dispatch and rejects stale session settings", async () => {
  const keys=['ZOOM_ACCOUNT_ID','ZOOM_CLIENT_ID','ZOOM_CLIENT_SECRET','ZOOM_HOST_USER_ID'];const previous=keys.map(key=>process.env[key]);keys.forEach(key=>process.env[key]=randomUUID());
  const originalFetch=global.fetch;let creations=0;const sample=serviceFixture();
  const request=()=>new NextRequest('http://localhost:2345/api/sessions/session/zoom',{method:'POST'});
  try {
    global.fetch=async url=>{
      if(String(url).includes('/oauth/token')) {sample.sessions[0].zoomAttemptId=randomUUID();return Response.json({access_token:'temporary-test-access'});}
      creations++;throw new Error('unexpected meeting creation');
    };
    await assert.rejects(serviceApi.handleServiceRequest(request(),users[2],async operation=>operation(sample)),/yangilangan/);
    assert.equal(creations,0);
    sample.sessions[0].zoomRequestId=undefined;
    global.fetch=async url=>{
      if(String(url).includes('/oauth/token')) return Response.json({access_token:'temporary-test-access'});
      creations++;sample.sessions[0].duration=40;return Response.json({id:123,join_url:'https://zoom.us/j/123'});
    };
    await assert.rejects(serviceApi.handleServiceRequest(request(),users[2],async operation=>operation(sample)),/o‘zgargan/);
    assert.equal(sample.sessions[0].zoom,undefined);
  } finally {global.fetch=originalFetch;keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];});}
});

test("interrupted SMS dispatch retries the same invitation with a single active claim", async () => {
  const keys=['ESKIZ_TOKEN','ESKIZ_SENDER'];const previous=keys.map(key=>process.env[key]);delete process.env.ESKIZ_TOKEN;
  const sample=serviceFixture();const first={...users[0],email:'first@example.test',phone:'+998901234567'};sample.users[0]=first;
  const record=sample.cases[0];record.mediatorId=undefined;record.mediation.respondentId=undefined;record.history=[];record.region='Toshkent shahri';record.city='Toshkent';
  const store=loadSource('src/lib/store.ts'),providers=loadSource('src/lib/service-providers.ts'),mediationApi=loadSource('src/lib/mediation-api.ts');
  const originalRead=store.readStore,originalSend=providers.sendSms;store.readStore=async()=>sample;
  const input={requestId:randomUUID(),phone:'+998931234567',name:'Second',city:'Toshkent'};
  const request=()=>new NextRequest('http://localhost:2345/api/cases/case/invitation',{method:'POST',body:JSON.stringify(input)});
  let sent=0;providers.sendSms=async()=>{sent++;return randomUUID();};
  try {
    const original=await mediationApi.handleMediationRequest(request(),first,async operation=>operation(sample));const url=(await original.json()).invitationUrl;
    process.env.ESKIZ_TOKEN=randomUUID();process.env.ESKIZ_SENDER='4546';
    const delivery=sample.smsDeliveries[0];delivery.status='SENDING';delivery.attemptStartedAt=new Date(Date.now()-61000).toISOString();
    const responses=await Promise.all([mediationApi.handleMediationRequest(request(),first,async operation=>operation(sample)),mediationApi.handleMediationRequest(request(),first,async operation=>operation(sample))]);
    assert.equal(sent,1);assert.equal(delivery.status,'ACCEPTED');
    for(const response of responses)assert.equal((await response.json()).invitationUrl,url);
  } finally {store.readStore=originalRead;providers.sendSms=originalSend;keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];});}
});

test("paid service totals include commissions and omit cancelled orders", () => {
  const sample={serviceOrders:[{status:'PAID',kind:'TEMPLATE',amount:19000,platformFee:19000,mediatorNet:0},{status:'PAID',kind:'MEDIATOR',mediatorId:'m',amount:1001,platformFee:150,mediatorNet:851},{status:'CANCELLED',kind:'MEDIATOR',mediatorId:'m',amount:1001,platformFee:150,mediatorNet:851}]};
  assert.deepEqual(serviceApi.paidServiceTotals(sample),{gross:20001,platformFee:19150,mediatorNet:851});
  assert.deepEqual(serviceApi.paidServiceTotals(sample,'m'),{gross:1001,platformFee:150,mediatorNet:851});
});

test("Zoom recovery reads a matching meeting when the list omits its join URL", async () => {
  const providers=loadSource('src/lib/service-providers.ts');
  const originalFetch=global.fetch;let details=0;
  const keys=['ZOOM_ACCOUNT_ID','ZOOM_CLIENT_ID','ZOOM_CLIENT_SECRET','ZOOM_HOST_USER_ID'];const previous=keys.map(key=>process.env[key]);keys.forEach(key=>process.env[key]=randomUUID());
  const date=new Date(Date.now()+86400000).toISOString();
  global.fetch=async url=>{
    if(String(url).includes('/oauth/token'))return Response.json({access_token:'temporary-test-access'});
    if(String(url).includes('?type=scheduled'))return Response.json({meetings:[{id:'123',agenda:'reference',start_time:date}],next_page_token:''});
    details++;return Response.json({id:'123',agenda:'reference',start_time:date,duration:30,join_url:'https://zoom.us/j/123'});
  };
  try {assert.equal((await providers.findZoomMeeting('reference',date,30)).meetingId,'123');assert.equal(details,1);}
  finally{global.fetch=originalFetch;keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];});}
});

test("pending passport cleanup retains failures and clears successful removals privately", async () => {
  const store=loadSource('src/lib/store.ts'),files=loadSource('src/lib/documents.ts');
  const previousRead=store.readStore,previousRemove=files.removeDocument;
  const check={id:randomUUID(),userId:'a',status:'DRAFT',fields:{},pendingDocuments:[{storageKey:randomUUID(),removeAfter:new Date(Date.now()-1000).toISOString()}]};
  const sample={users:[{id:'a',phone:''}],identityChecks:[check]};
  store.readStore=async()=>sample;files.removeDocument=async()=>{throw new Error('storage offline');};
  const request=()=>new NextRequest('http://localhost:2345/api/identity');
  try{
    const failed=await identityApi.handleIdentityRequest(request(),users[0],async operation=>operation(sample));
    assert.equal(check.pendingDocuments.length,1);assert.doesNotMatch(JSON.stringify(await failed.json()),/storageKey|pendingDocuments/);
    files.removeDocument=async()=>{};
    await identityApi.handleIdentityRequest(request(),users[0],async operation=>operation(sample));
    assert.equal(check.pendingDocuments.length,0);
  }finally{store.readStore=previousRead;files.removeDocument=previousRemove;}
});

test("private message retries resolve the party recipient on the server", async () => {
  const api=loadSource('src/lib/kelishuv-api.ts');
  const sample=serviceFixture();
  const input={requestId:randomUUID(),visibility:'PRIVATE',body:'Test private note'};
  const request=()=>new NextRequest('http://localhost:2345/api/cases/case/messages',{method:'POST',body:JSON.stringify(input)});
  const first=await api.handleKelishuvRequest(request(),users[0],async operation=>operation(sample));
  const second=await api.handleKelishuvRequest(request(),users[0],async operation=>operation(sample));
  const message=(await first.json()).message;
  assert.equal(message.recipientId,'m');assert.equal(message.id,(await second.json()).message.id);assert.equal(sample.cases[0].messages.length,1);
});

test("SMS invitation replacement waits for active dispatch and throttling preserves attempts", async () => {
  const keys=['ESKIZ_TOKEN','ESKIZ_SENDER'];const previous=keys.map(key=>process.env[key]);delete process.env.ESKIZ_TOKEN;
  const sample=serviceFixture();const first={...users[0],email:'first@example.test',phone:'+998901234567'};sample.users[0]=first;
  const record=sample.cases[0];record.mediatorId=undefined;record.mediation.respondentId=undefined;record.history=[];record.region='Toshkent shahri';record.city='Toshkent';
  const store=loadSource('src/lib/store.ts'),limiter=loadSource('src/lib/rate-limit.ts'),api=loadSource('src/lib/mediation-api.ts');
  const originalRead=store.readStore,originalLimit=limiter.withinRateLimit;store.readStore=async()=>sample;
  const input={requestId:randomUUID(),phone:'+998931234567',name:'Second',city:'Toshkent'};
  const request=body=>new NextRequest('http://localhost:2345/api/cases/case/invitation',{method:'POST',body:JSON.stringify(body)});
  try {
    await api.handleMediationRequest(request(input),first,async operation=>operation(sample));
    const delivery=sample.smsDeliveries[0];delivery.status='SENDING';delivery.attemptStartedAt=new Date().toISOString();
    await assert.rejects(api.handleMediationRequest(request({...input,requestId:randomUUID()}),first,async operation=>operation(sample)),/yuborilmoqda/);
    delivery.status='FAILED';delivery.attemptStartedAt=undefined;
    process.env.ESKIZ_TOKEN=randomUUID();process.env.ESKIZ_SENDER='4546';limiter.withinRateLimit=async()=>false;
    await api.handleMediationRequest(request(input),first,async operation=>operation(sample));
    assert.equal(delivery.attempts,undefined);assert.equal(delivery.status,'FAILED');
  }finally{store.readStore=originalRead;limiter.withinRateLimit=originalLimit;keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];});}
});

test("identity upload publishes its reserved file and rejects concurrent expired cleanup", async () => {
  const store=loadSource('src/lib/store.ts'),files=loadSource('src/lib/documents.ts');
  const originalRead=store.readStore,originalSave=files.saveDocument,originalRemove=files.removeDocument;
  const sample={users:[{id:'a',phone:''}],identityChecks:[]};
  store.readStore=async()=>sample;files.removeDocument=async()=>{};
  const canvas=createCanvas(100,100);canvas.getContext('2d').fillRect(0,0,100,100);
  function request(){const form=new FormData();form.append('consent','true');form.append('file',new File([new Uint8Array(canvas.toBuffer('image/png'))],'synthetic.png',{type:'image/png'}));return new NextRequest('http://localhost:2345/api/identity/document',{method:'POST',body:form});}
  let cleanup,releaseRemoval;
  try {
    files.saveDocument=async key=>{assert.ok(sample.identityChecks[0].pendingDocuments.some(item=>item.storageKey===key));};
    const uploaded=await identityApi.handleIdentityRequest(request(),users[0],async operation=>operation(sample));
    assert.equal((await uploaded.json()).uploaded,true);assert.ok(sample.identityChecks[0].document);assert.equal(sample.identityChecks[0].pendingDocuments.length,0);
    const previousKey=sample.identityChecks[0].document.storageKey;
    files.saveDocument=async key=>{
      const entry=sample.identityChecks[0].pendingDocuments.find(item=>item.storageKey===key);entry.removeAfter=new Date(Date.now()-1000).toISOString();
      let removalStarted;
      const started=new Promise(resolve=>{removalStarted=resolve;});
      files.removeDocument=async()=>{removalStarted();await new Promise(resolve=>{releaseRemoval=resolve;});};
      cleanup=identityApi.handleIdentityRequest(new NextRequest('http://localhost:2345/api/identity'),users[0],async operation=>operation(sample));
      await started;
    };
    await assert.rejects(identityApi.handleIdentityRequest(request(),users[0],async operation=>operation(sample)),error=>error.status===409);
    assert.equal(sample.identityChecks[0].document.storageKey,previousKey);
    releaseRemoval();await cleanup;
    assert.equal(sample.identityChecks[0].pendingDocuments.length,1);
    files.removeDocument=async()=>{};
    await identityApi.handleIdentityRequest(new NextRequest('http://localhost:2345/api/identity'),users[0],async operation=>operation(sample));
    assert.equal(sample.identityChecks[0].pendingDocuments.length,0);
  } finally {store.readStore=originalRead;files.saveDocument=originalSave;files.removeDocument=originalRemove;}
});

test("SMS provider dispatch coalesces concurrent attempts with the same delivery identifier", async () => {
  const provider=loadSource('src/lib/service-providers.ts');const originalFetch=global.fetch;
  const keys=['ESKIZ_TOKEN','ESKIZ_SENDER'];const previous=keys.map(key=>process.env[key]);process.env.ESKIZ_TOKEN=randomUUID();process.env.ESKIZ_SENDER='4546';let calls=0,release;
  const pending=new Promise(resolve=>{release=resolve;});
  global.fetch=async()=>{calls++;await pending;return Response.json({id:'provider-reference'});};
  try {const id=randomUUID();const a=provider.sendSms('+998931234567','Synthetic message',id);const b=provider.sendSms('+998931234567','Synthetic message',id);release();assert.deepEqual(await Promise.all([a,b]),['provider-reference','provider-reference']);assert.equal(calls,1);}
  finally {global.fetch=originalFetch;keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];});}
});

test("ambiguous identity session responses remain pending for signed reconciliation", async () => {
  const provider=loadSource('src/lib/service-providers.ts');const originalStart=provider.startIdentitySession;
  const keys=['IDENTITY_API_URL','IDENTITY_API_KEY','IDENTITY_WEBHOOK_SECRET','IDENTITY_REDIRECT_HOSTS'];const previous=keys.map(key=>process.env[key]);
  process.env.IDENTITY_API_URL='https://identity.example';process.env.IDENTITY_API_KEY=randomUUID();process.env.IDENTITY_WEBHOOK_SECRET=randomUUID();process.env.IDENTITY_REDIRECT_HOSTS='identity.example';
  const check={id:randomUUID(),userId:'a',status:'REVIEW_REQUIRED',fields:{firstName:'Ali',lastName:'Valiyev',middleName:'',birthDate:'1990-01-01',address:'Test',documentNumber:'TEST123'},document:{storageKey:randomUUID(),mime:'image/png'},updatedAt:new Date().toISOString()};
  const sample={identityChecks:[check],users:[{id:'a',phoneVerifiedAt:new Date().toISOString()}]};
  const request=()=>new NextRequest('http://localhost:2345/api/identity/session',{method:'POST',body:JSON.stringify({consent:true})});
  try {
    provider.startIdentitySession=async()=>{throw new provider.IdentitySessionError(true);};
    await assert.rejects(identityApi.handleIdentityRequest(request(),users[0],async operation=>operation(sample)));
    assert.equal(check.status,'PENDING');
    const body=JSON.stringify({reference:check.id,sessionId:'reconciled-session',status:'VERIFIED',liveness:true,documentVerified:true,fields:check.fields});const timestamp=String(Date.now());const signature=createHmac('sha256',process.env.IDENTITY_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');
    await identityApi.identityWebhook(new NextRequest('http://localhost:2345/api/webhooks/identity',{method:'POST',headers:{'x-identity-timestamp':timestamp,'x-identity-signature':signature},body}),async operation=>operation(sample));
    assert.equal(check.status,'VERIFIED');
    check.status='REVIEW_REQUIRED';provider.startIdentitySession=async()=>{throw new provider.IdentitySessionError(false);};
    await assert.rejects(identityApi.handleIdentityRequest(request(),users[0],async operation=>operation(sample)));
    assert.equal(check.status,'FAILED');
    provider.startIdentitySession=async()=>({id:'resume-session',url:'https://identity.example/resume'});
    const created=await identityApi.handleIdentityRequest(request(),users[0],async operation=>operation(sample));
    const resumed=await identityApi.handleIdentityRequest(request(),users[0],async operation=>operation(sample));
    assert.equal((await created.json()).url,(await resumed.json()).url);
  } finally {provider.startIdentitySession=originalStart;keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];});}
});

test("legacy proposals retain existing response behavior while new journeys enforce rounds", async () => {
  const api=loadSource('src/lib/kelishuv-api.ts'),sample=serviceFixture();const record=sample.cases[0];
  record.aiReview={id:randomUUID(),inputHash:domain.reviewInputHash(record),proposals:[{id:'QUICK'},{id:'BALANCED'}]};
  const request=()=>new NextRequest('http://localhost:2345/api/cases/case/proposals/BALANCED/respond',{method:'POST',body:JSON.stringify({reviewId:record.aiReview.id,decision:'REJECT',note:''})});
  record.journeyVersion=3;
  delete record.mediation.respondentConsent;
  await assert.rejects(api.handleKelishuvRequest(request(),users[0],async operation=>operation(sample)),/ikkala taraf roziligi/);
  record.mediation.respondentConsent={userId:'b',textVersion:mediation.CONSENT_VERSION};
  await assert.rejects(api.handleKelishuvRequest(request(),users[0],async operation=>operation(sample)),/Joriy taklif/);
  delete record.journeyVersion;
  const response=await api.handleKelishuvRequest(request(),users[0],async operation=>operation(sample));assert.equal((await response.json()).decision.proposalId,'BALANCED');
});

test("Cyrillic contract descriptions avoid matching land substrings inside words", () => {
  const legal=loadSource('src/lib/legal.ts');
  assert.equal(legal.classify('Не исполнен договор на компьютер '),'SHARTNOMA');
  assert.equal(legal.classify('Ер ҳуқуқи бўйича низо'),'YER_MULK');
});

test("invitation responses contain a complete shareable link", async () => {
  const sample = serviceFixture();
  const first = {
    ...users[0],
    email: "first@example.test",
    phone: "+998901234567",
  };
  sample.users[0] = first;
  const record = sample.cases[0];
  record.mediatorId = undefined;
  record.mediation.respondentId = undefined;
  record.history = [];
  const store = loadSource("src/lib/store.ts");
  const api = loadSource("src/lib/mediation-api.ts");
  const originalRead = store.readStore;
  const previousSms = process.env.ESKIZ_TOKEN;
  store.readStore = async () => sample;
  delete process.env.ESKIZ_TOKEN;
  try {
    const request = new NextRequest(
      "http://localhost:2345/api/cases/case/invitation",
      {
        method: "POST",
        body: JSON.stringify({
          requestId: randomUUID(),
          phone: "+998931234567",
          name: "Second party",
          city: "Toshkent",
        }),
      },
    );
    const response = await api.handleMediationRequest(
      request,
      first,
      async (operation) => operation(sample),
    );
    assert.match(
      (await response.json()).invitationUrl,
      /^https?:\/\/[^/]+\/invite\/[a-f0-9]{64}$/,
    );
  } finally {
    store.readStore = originalRead;
    if (previousSms === undefined) delete process.env.ESKIZ_TOKEN;
    else process.env.ESKIZ_TOKEN = previousSms;
  }
});

test("a private invitation link joins the matching phone account without an SMS provider", async () => {
  const sample = serviceFixture();
  const record = sample.cases[0];
  const token = "c".repeat(64);
  record.mediation.invitationHash = require("node:crypto")
    .createHash("sha256")
    .update(token)
    .digest("hex");
  record.mediation.invitationExpiresAt = new Date(
    Date.now() + 86400000,
  ).toISOString();
  record.mediation.invitedPhone = "+998931234567";
  record.mediation.respondentId = undefined;
  record.history = [];
  const second = {
    ...users[1],
    phone: "+998931234567",
    email: "second@example.test",
    phoneVerifiedAt: undefined,
  };
  sample.users[1] = second;
  const api = loadSource("src/lib/mediation-api.ts");
  const response = await api.handleMediationRequest(
    new NextRequest(`http://localhost:2345/api/invitations/${token}/join`, {
      method: "POST",
    }),
    second,
    async (operation) => operation(sample),
  );
  assert.equal((await response.json()).case.mediation.respondentId, second.id);
  assert.equal(second.phoneVerifiedAt, undefined);
});

test("assistant quota grants ten requests and protects reservations and retries", () => {
  const quota = loadSource("src/lib/assistant-quota.ts");
  const sample = { assistantRequests: [] };
  const firstId = randomUUID();
  const first = quota.reserveAssistantRequest(
    sample,
    "user:a",
    firstId,
    "hash",
  );
  assert.throws(
    () => quota.reserveAssistantRequest(sample, "user:a", firstId, "hash"),
    /ishlanmoqda/,
  );
  assert.throws(
    () => quota.reserveAssistantRequest(sample, "user:a", firstId, "changed"),
    /o‘zgargan/,
  );
  first.status = "COMPLETE";
  for (let index = 1; index < 10; index++)
    quota.reserveAssistantRequest(sample, "user:a", randomUUID(), "hash");
  assert.deepEqual(quota.assistantUsage(sample, "user:a"), {
    limit: 10,
    used: 10,
    remaining: 0,
  });
  assert.throws(
    () => quota.reserveAssistantRequest(sample, "user:a", randomUUID(), "hash"),
    /10 ta/,
  );
  assert.equal(
    quota.reserveAssistantRequest(sample, "user:a", firstId, "hash").id,
    first.id,
  );
  assert.equal(quota.assistantUsage(sample, "user:b").remaining, 10);
  sample.assistantRequests[1].status = "FAILED";
  assert.equal(quota.assistantUsage(sample, "user:a").remaining, 1);
});

test("expired assistant reservations can be retried with a fresh attempt", () => {
  const quota = loadSource("src/lib/assistant-quota.ts");
  const sample = {};
  const requestId = randomUUID();
  const before = Date.now() - quota.ASSISTANT_REQUEST_LEASE_MS - 1;
  const first = quota.reserveAssistantRequest(
    sample,
    "user:a",
    requestId,
    "hash",
    before,
  );
  const attempt = first.attemptId;
  assert.equal(quota.assistantUsage(sample, "user:a").used, 0);
  const retried = quota.reserveAssistantRequest(
    sample,
    "user:a",
    requestId,
    "hash",
  );
  assert.notEqual(retried.attemptId, attempt);
  assert.equal(sample.assistantRequests.length, 1);
});

test("case withdrawal closes the case once and cancels scheduled sessions", async () => {
  const api = loadSource("src/lib/case-closure.ts");
  const sample = serviceFixture();
  const requestId = randomUUID();
  const request = () =>
    new NextRequest("http://localhost:2345/api/cases/case/closure", {
      method: "POST",
      body: JSON.stringify({
        action: "REQUEST",
        requestId,
        kind: "WITHDRAWN",
        reason: "Mustaqil hal qilindi",
      }),
    });
  const response = await api.handleCaseClosureRequest(
    request(),
    users[0],
    async (operation) => operation(sample),
  );
  assert.equal((await response.json()).status, "CLOSED");
  assert.equal(sample.sessions[0].status, "CANCELLED");
  const auditLength = sample.audit.length;
  await api.handleCaseClosureRequest(request(), users[0], async (operation) =>
    operation(sample),
  );
  assert.equal(sample.audit.length, auditLength);
  assert.equal(domain.verifyAudit(sample.audit), true);
});

test("external settlement requires both parties and rejects stale confirmations", async () => {
  const api = loadSource("src/lib/case-closure.ts");
  const sample = serviceFixture();
  const requestId = randomUUID();
  const request = (body) =>
    new NextRequest("http://localhost:2345/api/cases/case/closure", {
      method: "POST",
      body: JSON.stringify(body),
    });
  await api.handleCaseClosureRequest(
    request({
      action: "REQUEST",
      requestId,
      kind: "SETTLED_EXTERNALLY",
      reason: "O‘zaro kelishdik",
    }),
    users[0],
    async (operation) => operation(sample),
  );
  assert.equal(sample.cases[0].status, "IN_PROGRESS");
  assert.equal(sample.cases[0].closure.status, "PENDING");
  await assert.rejects(
    api.handleCaseClosureRequest(
      request({ action: "RESPOND", requestId: randomUUID(), accept: true }),
      users[1],
      async (operation) => operation(sample),
    ),
    /yangilangan/,
  );
  await assert.rejects(
    api.handleCaseClosureRequest(
      request({ action: "RESPOND", requestId, accept: true }),
      users[3],
      async (operation) => operation(sample),
    ),
    /nizo tarafi/,
  );
  await api.handleCaseClosureRequest(
    request({ action: "RESPOND", requestId, accept: true }),
    users[1],
    async (operation) => operation(sample),
  );
  assert.equal(sample.cases[0].status, "CLOSED");
  assert.deepEqual(sample.cases[0].closure.confirmations, ["a", "b"]);
});

test("RAG retrieves articles outside the selected catalog and rejects repealed live sources", async () => {
  const retrieval = loadSource("src/lib/legal-retrieval.ts");
  const originalFetch = global.fetch;
  const previous = process.env.AI_RAG_EMBEDDINGS;
  process.env.AI_RAG_EMBEDDINGS = "false";
  try {
    global.fetch = async () => {
      throw new Error("offline");
    };
    const answer = await retrieval.retrieveLegalEvidence(
      "Soliq to‘lovchining huquqlari va majburiyatlari",
    );
    assert.equal(answer.articles, 7368);
    assert.equal(answer.semantic, false);
    assert.ok(
      answer.sources.some((source) => source.id.startsWith("corpus-soliq")),
    );
    assert.ok(answer.sources.every((source) => source.current === false));
    const labor = await retrieval.lexicalCandidates(
      "Работодатель не выплатил зарплату",
    );
    assert.ok(labor.some((source) => source.title.includes("Mehnat")));
    global.fetch = async () =>
      new Response(
        '<div class="act_warning">Hujjat kuchini yo‘qotgan 20.11.2023</div><div id="divCont"></div>',
      );
    await assert.rejects(retrieval.lexDocument("999991"), /repealed/);
    global.fetch = async () =>
      new Response("", {
        status: 302,
        headers: { location: "http://127.0.0.1:11434/api/tags" },
      });
    await assert.rejects(
      retrieval.officialText("https://lex.uz/uz/docs/-999992"),
      /redirect/,
    );
  } finally {
    global.fetch = originalFetch;
    if (previous === undefined) delete process.env.AI_RAG_EMBEDDINGS;
    else process.env.AI_RAG_EMBEDDINGS = previous;
  }
});

test("assistant synthesis accepts retrieved citations and falls back on invented IDs", async () => {
  const retrieval = loadSource("src/lib/legal-retrieval.ts");
  const assistant = loadSource("src/lib/assistant.ts");
  const previousRetrieve = retrieval.retrieveLegalEvidence;
  const previousStatus = provider.getAIProviderStatus;
  const previousRun = provider.runStructuredAI;
  const source = {
    id: "tax-rights",
    title: "Soliq kodeksi",
    article: "21-modda",
    summary: "Retrieved official excerpt",
    content: "Retrieved official excerpt",
    url: "https://lex.uz/docs/-4674902",
    verifiedAt: new Date().toISOString(),
    kind: "LAW",
    current: true,
  };
  retrieval.retrieveLegalEvidence = async () => ({
    sources: [source],
    documents: 25,
    articles: 7368,
    semantic: true,
    live: true,
    courtSources: 0,
  });
  provider.getAIProviderStatus = async () => ({
    available: true,
    provider: "OLLAMA",
    local: true,
  });
  let sent;
  provider.runStructuredAI = async (schema, system, prompt) => {
    sent = JSON.parse(prompt);
    return {
      model: "local-test",
      data: {
        findings: [
          {
            sourceId: "tax-rights",
            explanation: "Soliq to‘lovchining huquqlariga tegishli izoh.",
          },
        ],
        steps: ["Soliq hujjatlarini tayyorlang."],
        clarification: "",
      },
    };
  };
  try {
    const answer = await assistant.answerAssistant(
      "Soliq tölanmagan, REF-Ö42. Qaysi huquqlarim bor?",
      ["CHECK-123 https://lex.uz/?q=Ö42"],
      false,
      "uz",
    );
    assert.match(answer.mode, /RAG/);
    assert.match(answer.answer, /21-modda/);
    assert.equal(answer.sources[0].id, source.id);
    assert.equal(sent.evidence[0].text, source.content);
    assert.equal(sent.question, "CHECK-123 https://lex.uz/?q=Ö42\nSoliq tölanmagan, REF-Ö42. Qaysi huquqlarim bor?");
    provider.runStructuredAI = async () => ({
      model: "unverified-number",
      data: {
        findings: [
          {
            sourceId: source.id,
            explanation: "Soliq imtiyozi 6 foizi miqdorida.",
          },
        ],
        steps: ["6 foiz to‘lashni talab qiling."],
        clarification: "6 foiz miqdorida to‘lanadi.",
      },
    });
    const grounded = await assistant.answerAssistant(
      "Soliq to‘lovchining huquqlari qanday?",
      [],
      false,
      "uz",
    );
    assert.doesNotMatch(grounded.answer + grounded.steps.join(" "), /6 foiz/);
    assert.ok(grounded.answer.includes(source.content));
    provider.runStructuredAI = async () => ({
      model: "bad",
      data: {
        findings: [
          {
            sourceId: "invented",
            explanation: "This unsupported claim must be discarded.",
          },
        ],
        steps: ["Discarded step."],
        clarification: "",
      },
    });
    const fallback = await assistant.answerAssistant(
      "Soliq to‘lovchining huquqlari qanday?",
      [],
      false,
      "uz",
    );
    assert.doesNotMatch(fallback.mode, /RAG/);
    assert.doesNotMatch(fallback.answer, /unsupported/);
    assert.equal(fallback.sources[0].id, source.id);
  } finally {
    retrieval.retrieveLegalEvidence = previousRetrieve;
    provider.getAIProviderStatus = previousStatus;
    provider.runStructuredAI = previousRun;
  }
});

test("assistant HTTP quota is per account, retries are free, and failures release a slot", async () => {
  const store = loadSource("src/lib/store.ts");
  const assistant = loadSource("src/lib/assistant.ts");
  const limiter = loadSource("src/lib/rate-limit.ts");
  const api = loadSource("src/lib/assistant-api.ts");
  const originals = {
    read: store.readStore,
    mutate: store.mutateStore,
    key: store.encryptionKey,
    answer: assistant.answerAssistant,
    rate: limiter.withinRateLimit,
  };
  const sample = { users: structuredClone(users), assistantRequests: [] };
  store.readStore = async () => sample;
  store.mutateStore = async (operation) => operation(sample);
  store.encryptionKey = () => Buffer.alloc(32, 7);
  limiter.withinRateLimit = async () => true;
  let calls = 0;
  let reject = false;
  assistant.answerAssistant = async () => {
    calls++;
    if (reject) throw new Error("Temporary failure");
    return {
      answer: "Prepared answer",
      steps: [],
      sources: [],
      links: [],
      mode: "test",
    };
  };
  const body = { requestId: randomUUID(), question: "Sayt qanday ishlaydi?" };
  const request = (value = body, cookie) =>
    new NextRequest("https://example.test/api/assistant", {
      method: "POST",
      headers: cookie ? { cookie } : {},
      body: JSON.stringify(value),
    });
  try {
    const first = await api.handleAssistantRequest(request(), users[0]);
    assert.equal((await first.json()).usage.remaining, 9);
    const retry = await api.handleAssistantRequest(request(), users[0]);
    assert.equal((await retry.json()).usage.used, 1);
    assert.equal(calls, 1);
    const conflict = await api.handleAssistantRequest(
      request({ ...body, question: "Boshqa savol" }),
      users[0],
    );
    assert.equal(conflict.status, 409);
    reject = true;
    await assert.rejects(
      api.handleAssistantRequest(
        request({ ...body, requestId: randomUUID() }),
        users[0],
      ),
      /Temporary/,
    );
    reject = false;
    for (let index = 1; index < 10; index++)
      await api.handleAssistantRequest(
        request({ ...body, requestId: randomUUID() }),
        users[0],
      );
    assert.equal(
      (
        await api.handleAssistantRequest(
          request({ ...body, requestId: randomUUID() }),
          users[0],
        )
      ).status,
      429,
    );
    assert.equal(
      (await (await api.handleAssistantRequest(request(), users[1])).json())
        .usage.remaining,
      9,
    );
    const guest = await api.handleAssistantRequest(
      new NextRequest("https://example.test/api/assistant/usage"),
    );
    const cookie = guest.headers.get("set-cookie").split(";")[0];
    assert.match(guest.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(guest.headers.get("set-cookie"), /Secure/i);
    assert.equal(
      (await (await api.handleAssistantRequest(request(body, cookie))).json())
        .usage.remaining,
      9,
    );
    assert.equal(
      (await (await api.handleAssistantRequest(request(body, cookie))).json())
        .usage.remaining,
      9,
    );
    const guestFresh = await api.handleAssistantRequest(
      new NextRequest("https://example.test/api/assistant/usage"),
    );
    assert.equal((await guestFresh.json()).usage.remaining, 10);
  } finally {
    store.readStore = originals.read;
    store.mutateStore = originals.mutate;
    store.encryptionKey = originals.key;
    assistant.answerAssistant = originals.answer;
    limiter.withinRateLimit = originals.rate;
  }
});

test("malformed assistant cookies rotate safely and unjoined cases can be closed by their owner", async () => {
  const store = loadSource("src/lib/store.ts");
  const assistantApi = loadSource("src/lib/assistant-api.ts");
  const originalRead = store.readStore;
  const originalKey = store.encryptionKey;
  store.readStore = async () => ({ assistantRequests: [] });
  store.encryptionKey = () => Buffer.alloc(32, 3);
  try {
    const cookie = `kelishuv-assistant=${randomUUID()}.${"é".repeat(43)}`;
    const response = await assistantApi.handleAssistantRequest(
      new NextRequest("https://example.test/api/assistant/usage", {
        headers: { cookie },
      }),
    );
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("set-cookie"));
  } finally {
    store.readStore = originalRead;
    store.encryptionKey = originalKey;
  }
  const sample = serviceFixture();
  delete sample.cases[0].mediation.respondentId;
  const closure = loadSource("src/lib/case-closure.ts");
  await closure.handleCaseClosureRequest(
    new NextRequest("http://localhost:2345/api/cases/case/closure", {
      method: "POST",
      body: JSON.stringify({
        action: "REQUEST",
        requestId: randomUUID(),
        kind: "SETTLED_EXTERNALLY",
        reason: "Taraflar mustaqil kelishdi",
      }),
    }),
    users[0],
    async (op) => op(sample),
  );
  assert.equal(sample.cases[0].status, "CLOSED");
  assert.deepEqual(sample.cases[0].closure.confirmations, ["a"]);
  assert.equal(sample.sessions[0].status, "CANCELLED");
});

test("assistant allows ten queries through both route and account rate limits", async () => {
  const store = loadSource("src/lib/store.ts");
  const assistant = loadSource("src/lib/assistant.ts");
  const limiter = loadSource("src/lib/rate-limit.ts");
  const api = loadSource("src/lib/assistant-api.ts");
  const originalRead = store.readStore,
    originalMutate = store.mutateStore,
    originalAnswer = assistant.answerAssistant;
  const user = { ...users[0], id: randomUUID() };
  const sample = { users: [user], assistantRequests: [] };
  const ip = randomUUID();
  store.readStore = async () => sample;
  store.mutateStore = async (operation) => operation(sample);
  assistant.answerAssistant = async () => ({
    answer: "Prepared answer",
    steps: [],
    sources: [],
    links: [],
    mode: "test",
  });
  try {
    for (let index = 0; index < 10; index++) {
      assert.equal(await limiter.withinRateLimit(`assistant:${ip}`, 60), true);
      const request = new NextRequest("https://example.test/api/assistant", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify({
          requestId: randomUUID(),
          question: "Sayt qanday ishlaydi?",
        }),
      });
      const response = await api.handleAssistantRequest(request, user);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).usage.remaining, 9 - index);
    }
  } finally {
    store.readStore = originalRead;
    store.mutateStore = originalMutate;
    assistant.answerAssistant = originalAnswer;
  }
});

test("legal synthesis rejects invented percentages and preserves supported numeric wording", () => {
  const assistant = loadSource("src/lib/assistant.ts");
  const source =
    "333-modda. Kompensatsiya Markaziy bank stavkasining o‘n foizi miqdorida belgilanadi.";
  assert.equal(
    assistant.supportedLegalNumbers("Kompensatsiya 6 foizi miqdorida.", source),
    false,
  );
  assert.equal(
    assistant.supportedLegalNumbers(
      "Kompensatsiya olti foizi miqdorida.",
      source,
    ),
    false,
  );
  assert.equal(
    assistant.supportedLegalNumbers("333-modda bo‘yicha 10 foiz.", source),
    true,
  );
  assert.equal(
    assistant.supportedLegalNumbers("Компенсация 6 процентов.", source),
    false,
  );
  assert.equal(
    assistant.supportedLegalNumbers("Stavka 5,5%.", "Stavka 5.5 foiz."),
    true,
  );
  assert.equal(
    assistant.supportedLegalNumbers("6 foiz.", "O‘n olti foiz."),
    false,
  );
});

test("live Lex retrieval preserves supplied identifiers and parses Cyrillic article headings", async () => {
  const retrieval = loadSource("src/lib/legal-retrieval.ts");
  const originalFetch = global.fetch;
  const requested = [];
  global.fetch = async (endpoint) => {
    requested.push(String(endpoint));
    return new Response(
      '<title>Test law</title><div id="divCont"><div class="CLAUSE_DEFAULT lx_elem"><div id="article">21-модда. Солиқ тўловчининг ҳуқуқлари</div></div><div class="ACT_TEXT lx_elem"><div id="body">Ҳуқуқлар матни.</div></div></div>',
    );
  };
  try {
    const positive = await retrieval.lexDocument("987654321");
    const negative = await retrieval.lexDocument("-987654322");
    assert.equal(
      positive.articles.get("21").content.includes("Ҳуқуқлар матни."),
      true,
    );
    assert.equal(negative.articles.has("21"), true);
    assert.deepEqual(requested, [
      "https://lex.uz/uz/docs/987654321",
      "https://lex.uz/uz/docs/-987654322",
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("legal numeric grounding handles compound percentages and written deadlines", () => {
  const assistant = loadSource("src/lib/assistant.ts");
  assert.equal(
    assistant.supportedLegalNumbers("Ikki yuz foiz.", "102 foiz."),
    false,
  );
  assert.equal(
    assistant.supportedLegalNumbers("Ikki yuz foiz.", "200 foiz."),
    true,
  );
  assert.equal(
    assistant.supportedLegalNumbers("O‘ttiz kun ichida.", "15 kun ichida."),
    false,
  );
  assert.equal(
    assistant.supportedLegalNumbers("O‘ttiz kun ichida.", "30 kun ichida."),
    true,
  );
  assert.equal(
    assistant.supportedLegalNumbers(
      "Ikki yuz ellik ming so‘m.",
      "250000 so‘m.",
    ),
    true,
  );
  assert.equal(
    assistant.supportedLegalNumbers("Тридцать дней.", "15 kun."),
    false,
  );
});
