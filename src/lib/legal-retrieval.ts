import "server-only";
import { create, insert, search } from "@orama/orama";
import { load } from "cheerio";
import corpus from "@/data/assistant-corpus.json";
import courtIndex from "@/data/court-practice.json";
import { classify, LEGAL_SOURCES } from "./legal";
import type { AssistantSource } from "./assistant-types";

export type LegalEvidence = AssistantSource & {
  content: string;
  lawId?: string;
  articleNumber?: string;
};
const cyrillic: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "x",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "",
  ы: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  ў: "o",
  қ: "q",
  ғ: "g",
  ҳ: "h",
};
const stopWords = new Set([
  "men",
  "menga",
  "mening",
  "uchun",
  "bilan",
  "qanday",
  "qaysi",
  "haqida",
  "nima",
  "bor",
  "kerak",
  "savol",
  "bering",
  "boladi",
  "qilish",
  "mumkin",
  "qonun",
  "modda",
]);
const russianTerms: [RegExp, string][] = [
  [/зарплат|заработн|работодат|трудов|увольн/gi, " mehnat ish haqi xodim "],
  [/наслед/gi, " meros "],
  [/налог/gi, " soliq "],
  [/пенси/gi, " pensiya "],
  [/алимент/gi, " aliment "],
  [/брак|супруг|развод/gi, " nikoh oila "],
  [/аренд/gi, " ijara "],
  [/долг|за[её]м/gi, " qarz "],
  [/потребител|товар|гаранти/gi, " istemolchi tovar kafolat "],
  [/земель|кадастр/gi, " yer kadastr "],
  [/собствен|имуществ/gi, " mulk "],
  [/конституц/gi, " konstitutsiya "],
  [/уголов|преступ/gi, " jinoyat "],
];
function expandQuery(text: string) {
  const expanded =
    text +
    russianTerms
      .flatMap(([pattern, replacement]) => {
        pattern.lastIndex = 0;
        return pattern.test(text) ? [replacement] : [];
      })
      .join(" ");
  const normalized = normalizeLegalQuery(expanded);
  if (
    /ish haqi|maosh|zarplat/.test(normalized) &&
    /tolanma|tolam|kechik|berma|viplat/.test(normalized)
  )
    return (
      expanded +
      " ish haqini tolash muddatlari kechiktirganlik moddiy javobgarlik"
    );
  if (/meros/.test(normalized) && /qabul|muddat|guvohnoma/.test(normalized))
    return expanded + " meros olish huquqi guvohnoma muddat";
  return expanded;
}
export function normalizeLegalQuery(text: string) {
  return text
    .toLocaleLowerCase()
    .replace(/[а-яёўқғҳ]/g, (character) => cyrillic[character] || character)
    .replace(/[’‘`ʻʼ']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word))
    .join(" ");
}
const schema = {
  id: "string",
  title: "string",
  article: "string",
  content: "string",
  position: "number",
} as const;
let index: ReturnType<typeof buildIndex> | undefined;
function buildIndex() {
  const database = create({
    schema,
    components: {
      tokenizer: { language: "english", stemming: false, stopWords: false },
    },
  });
  for (const [position, source] of corpus.sources.entries())
    insert(database, {
      id: source.id,
      title: normalizeLegalQuery(source.title),
      article: normalizeLegalQuery(source.article),
      content: normalizeLegalQuery(source.content),
      position,
    });
  return database;
}
export async function lexicalCandidates(
  question: string,
): Promise<LegalEvidence[]> {
  index ??= buildIndex();
  const type = classify(question);
  const synonyms: Record<string, string> = {
    MEHNAT: "ish haqi mehnat xodim",
    SHARTNOMA: "qarz ijara shartnoma",
    OILA: "oila aliment nikoh",
    ISTE_MOLCHI: "istemolchi tovar kafolat",
    YER_MULK: "yer mulk kadastr",
    BIZNES: "tadbirkorlik shartnoma",
    QOSHNI: "mulk qoshni",
    BOSHQA: "",
  };
  const results = await search(index, {
    term: normalizeLegalQuery(expandQuery(question)) + " " + synonyms[type],
    limit: 24,
    tolerance: 0,
    threshold: 1,
    boost: { title: 1, article: 3, content: 1 },
  });
  const retrieved: LegalEvidence[] = results.hits.map((hit) => {
    const source = corpus.sources[hit.document.position];
    return {
      ...source,
      summary: source.content.slice(0, 650),
      originalLanguage: "uz",
      verifiedAt: corpus.retrievedAt,
      kind: "LAW",
      current: false,
    };
  });
  for (const source of LEGAL_SOURCES.filter((source) =>
    source.types.includes(type),
  ).slice(0, 3))
    retrieved.push({
      ...source,
      lawId: /\/docs\/(-?\d+)/.exec(source.url)?.[1],
      content: source.content || source.summary,
      originalLanguage: "uz",
      kind: "LAW",
      current: false,
    });
  return [...new Map(retrieved.map((source) => [source.id, source])).values()];
}
const vectorCache = new Map<string, number[]>();
export async function semanticRerank(
  question: string,
  candidates: LegalEvidence[],
) {
  if (!candidates.length || process.env.AI_RAG_EMBEDDINGS === "false")
    return { sources: candidates, semantic: false };
  const base = (
    process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
  ).replace(/\/+$/, "");
  if (!URL.canParse(base)) return { sources: candidates, semantic: false };
  const endpoint = new URL(base);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname))
    return { sources: candidates, semantic: false };
  const model = process.env.AI_EMBEDDING_MODEL || "bge-m3";
  const selected = candidates.slice(0, 24);
  const missing = selected.filter(
    (source) => !vectorCache.has(model + ":" + source.id),
  );
  try {
    const response = await fetch(base + "/api/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [
          question,
          ...missing.map(
            (source) => `${source.article}\n${source.content.slice(0, 1800)}`,
          ),
        ],
        truncate: true,
        keep_alive: "5m",
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (
      !response.ok ||
      Number(response.headers.get("content-length") || 0) > 2 * 1024 * 1024
    )
      throw new Error("Embedding service unavailable");
    const data = (await response.json()) as { embeddings?: number[][] };
    if (
      !data.embeddings ||
      data.embeddings.length !== missing.length + 1 ||
      data.embeddings.some(
        (vector) =>
          !vector.length ||
          vector.length > 4096 ||
          vector.some((value) => !Number.isFinite(value)),
      )
    )
      throw new Error("Invalid embeddings");
    const [query, ...vectors] = data.embeddings;
    for (const [position, source] of missing.entries())
      vectorCache.set(model + ":" + source.id, vectors[position]);
    if (vectorCache.size > 1500)
      for (const key of [...vectorCache.keys()].slice(0, 500))
        vectorCache.delete(key);
    const ranked = selected
      .map((source, lexicalRank) => {
        const vector = vectorCache.get(model + ":" + source.id)!;
        if (vector.length !== query.length)
          throw new Error("Embedding dimensions changed");
        const dot = query.reduce(
          (sum, value, position) => sum + value * vector[position],
          0,
        );
        const norm = Math.sqrt(
          query.reduce((sum, value) => sum + value * value, 0) *
            vector.reduce((sum, value) => sum + value * value, 0),
        );
        return { source, lexicalRank, semanticScore: norm ? dot / norm : 0 };
      })
      .sort((left, right) => right.semanticScore - left.semanticScore);
    ranked.forEach((item, rank) => {
      item.semanticScore = 1 / (30 + rank) + 1 / (60 + item.lexicalRank);
    });
    ranked.sort((left, right) => right.semanticScore - left.semanticScore);
    return { sources: ranked.map((item) => item.source), semantic: true };
  } catch {
    return { sources: candidates, semantic: false };
  }
}
export async function officialText(url: string, maximum = 8 * 1024 * 1024) {
  let endpoint = new URL(url);
  const allowed = (value: URL) =>
    value.protocol === "https:" &&
    ["lex.uz", "www.lex.uz", "sud.uz", "www.sud.uz"].includes(value.hostname) &&
    !value.port &&
    !value.username &&
    !value.password;
  if (!allowed(endpoint)) throw new Error("Unsupported legal source");
  const signal = AbortSignal.timeout(15000);
  for (let redirect = 0; redirect < 4; redirect++) {
    const response = await fetch(endpoint, {
      redirect: "manual",
      signal,
      headers: { "User-Agent": "Kelishuv-Legal-Retrieval/1.0" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Missing source redirect");
      endpoint = new URL(location, endpoint);
      if (!allowed(endpoint))
        throw new Error("Unsupported legal source redirect");
      continue;
    }
    if (
      !response.ok ||
      Number(response.headers.get("content-length") || 0) > maximum
    )
      throw new Error("Legal source unavailable");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty legal source");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        bytes += result.value.byteLength;
        if (bytes > maximum) {
          await reader.cancel();
          throw new Error("Legal source exceeds limit");
        }
        chunks.push(result.value);
      }
    } finally {
      reader.releaseLock();
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("Too many source redirects");
}
type LiveDocument = {
  title: string;
  editionDate?: string;
  fetchedAt: string;
  articles: Map<string, { article: string; content: string; anchor: string }>;
  paragraphs: string[];
};
const liveDocuments = new Map<
  string,
  { expires: number; document: LiveDocument }
>();
const activeDocuments = new Map<string, Promise<LiveDocument>>();
export async function lexDocument(lawId: string) {
  if (!/^-?\d+$/.test(lawId)) throw new Error("Invalid law identifier");
  const cached = liveDocuments.get(lawId);
  if (cached && cached.expires > Date.now()) return cached.document;
  const active = activeDocuments.get(lawId);
  if (active) return active;
  const operation = (async () => {
    const html = await officialText(`https://lex.uz/uz/docs/${lawId}`);
    const page = load(html);
    if (
      normalizeLegalQuery(page(".act_warning").text()).includes(
        "kuchini yoqotgan",
      )
    )
      throw new Error("Legal document repealed");
    const body = page("#divCont");
    if (!body.length) throw new Error("Normative text unavailable");
    body
      .find(".COMMENT,.CHANGES_ORIGINS,.INDEXES_ON_REF,.lx_elem2,script,style")
      .remove();
    const articles: LiveDocument["articles"] = new Map();
    const paragraphs: string[] = [];
    let current:
      { article: string; content: string; anchor: string } | undefined;
    body.find(".lx_elem").each((_, node) => {
      const block = page(node);
      block.find("sup").each((_, sup) => {
        page(sup).replaceWith(
          page(sup)
            .text()
            .replace(/\d/g, (digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(digit)]),
        );
      });
      const value = block.children("[id]").first();
      const text = value.text().replace(/\s+/g, " ").trim();
      if (!text) return;
      paragraphs.push(text);
      const match =
        /^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]*)\s*[-–]\s*(?:modda|модда)(?=[.\s]|$)/i.exec(text);
      if (match && block.hasClass("CLAUSE_DEFAULT")) {
        const articleNumber =
          match[1] +
          (match[2]
            ? "." +
              [...match[2]].map((digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(digit)).join("")
            : "");
        current = {
          article: text,
          content: text,
          anchor: value.attr("id") || "",
        };
        articles.set(articleNumber, current);
      } else if (
        block.hasClass("TEXT_HEADER_DEFAULT") &&
        /\d+\s*[-–]\s*(bob|bo.lim)/i.test(text)
      )
        current = undefined;
      else if (
        current &&
        ["ACT_TEXT", "BY_DEFAULT", "TEXT_HEADER_DEFAULT"].some((name) =>
          block.hasClass(name),
        )
      )
        current.content += "\n" + text;
    });
    const rawDate = page(".lx_date_selected").first().text().trim();
    const editionDate = /^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)
      ? rawDate.split(".").reverse().join("-")
      : undefined;
    const document: LiveDocument = {
      title: page("title").text().trim(),
      editionDate,
      fetchedAt: new Date().toISOString(),
      articles,
      paragraphs,
    };
    liveDocuments.set(lawId, { expires: Date.now() + 6 * 3600000, document });
    if (liveDocuments.size > 100)
      liveDocuments.delete(liveDocuments.keys().next().value!);
    return document;
  })();
  activeDocuments.set(lawId, operation);
  try {
    return await operation;
  } finally {
    activeDocuments.delete(lawId);
  }
}
function excerpt(content: string, question: string, maximum = 1800) {
  const words = normalizeLegalQuery(expandQuery(question)).split(" ");
  const blocks = content.split(/\n+/).filter(Boolean);
  const scored = blocks
    .map((text, position) => ({
      text,
      position,
      score: words.reduce(
        (score, word) =>
          score + (normalizeLegalQuery(text).includes(word) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .sort((a, b) => a.position - b.position);
  return scored
    .map((item) => item.text)
    .join("\n")
    .slice(0, maximum);
}
function topic(question: string) {
  const normalized = normalizeLegalQuery(expandQuery(question));
  return (
    [
      "aliment",
      "nikoh",
      "meros",
      "soliq",
      "pensiya",
      "mehnat",
      "ijara",
      "qarz",
      "kadastr",
      "mulk",
      "tovar",
      "tadbirkorlik",
      "jarima",
      "jinoyat",
      "sugurta",
      "bank",
    ].find((word) => normalized.includes(word)) ||
    {
      MEHNAT: "mehnat",
      OILA: "aliment",
      SHARTNOMA: "shartnoma",
      BIZNES: "tadbirkorlik",
      YER_MULK: "mulk",
      ISTE_MOLCHI: "istemolchi",
      QOSHNI: "mulk",
      BOSHQA: "huquq",
    }[classify(question)]
  );
}
async function liveSearch(question: string): Promise<LegalEvidence[]> {
  const html = await officialText(
    `https://lex.uz/uz/search/all?searchtitle=${encodeURIComponent(topic(question))}`,
  );
  const page = load(html);
  const matches = new Map<string, { lawId: string; title: string }>();
  page("a[href]").each((_, node) => {
    const value = page(node);
    const href = value.attr("href") || "";
    const match = /\/docs\/(-?\d+)/.exec(href);
    const title = value.text().trim();
    if (match && title.length > 12 && !matches.has(match[1]))
      matches.set(match[1], { lawId: match[1], title });
  });
  const words = normalizeLegalQuery(expandQuery(question)).split(" ");
  const relevant = [...matches.values()]
    .filter(
      (source) =>
        topic(question) !== "meros" ||
        /meros.*huquq|voris|notari/i.test(source.title),
    )
    .map((source) => ({
      source,
      score: words.reduce(
        (score, word) =>
          score + (normalizeLegalQuery(source.title).includes(word) ? 1 : 0),
        /kodeks/i.test(source.title) ? 3 : 0,
      ),
    }))
    .sort((left, right) => right.score - left.score);
  const results = await Promise.allSettled(
    relevant.slice(0, 2).map(async ({ source }) => {
      const document = await lexDocument(source.lawId);
      const content = excerpt(document.paragraphs.join("\n"), question);
      if (!content) throw new Error("No document text");
      return {
        id: `live-${source.lawId}`,
        lawId: source.lawId,
        title: source.title,
        article: "Hujjatdan tegishli parcha",
        content,
        summary: content.slice(0, 650),
        url: `https://lex.uz/docs/${source.lawId}`,
        editionDate: document.editionDate,
        verifiedAt: document.fetchedAt,
        originalLanguage: "uz" as const,
        kind: "LAW" as const,
        current: true,
      };
    }),
  );
  return results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}
async function courtReports(question: string): Promise<LegalEvidence[]> {
  const words: Record<string, string> = {
    mehnat: "меҳнат",
    aliment: "алимент",
    nikoh: "никоҳ",
    meros: "мерос",
    soliq: "солиқ",
    pensiya: "пенсия",
    ijara: "ижара",
    qarz: "қарз",
    mulk: "мулк",
    shartnoma: "шартнома",
    tadbirkorlik: "тадбиркор",
    huquq: "ҳуқуқ",
  };
  const selected = topic(question);
  const text = await officialText(
    `https://sud.uz/wp-json/wp/v2/posts?search=${encodeURIComponent(words[selected] || selected)}&per_page=2&_fields=id,link,date,title,content`,
  );
  const posts = JSON.parse(text) as {
    id: number;
    link: string;
    date: string;
    title: { rendered: string };
    content: { rendered: string };
  }[];
  if (!Array.isArray(posts)) return [];
  return posts.flatMap((post) => {
    if (
      typeof post.link !== "string" ||
      !/^https:\/\/sud\.uz\//.test(post.link) ||
      typeof post.content?.rendered !== "string"
    )
      return [];
    const page = load(post.content.rendered);
    page("script,style,nav,footer").remove();
    const title = load(post.title.rendered).root().text();
    const topicWord = normalizeLegalQuery(selected);
    if (
      !normalizeLegalQuery(title).includes(topicWord) &&
      !/sud amaliyoti|nizo|hal qiluv|sud qarori|sudga murojaat/.test(
        normalizeLegalQuery(page.root().text()),
      )
    )
      return [];
    const content = excerpt(
      page("p")
        .map((_, node) => page(node).text())
        .get()
        .join("\n") || page.root().text(),
      question,
      1800,
    );
    if (!content) return [];
    return [
      {
        id: `sud-practice-${post.id}`,
        title,
        article: "Oliy sudning ochiq materiali",
        content,
        summary: content.split(/\s+/).slice(0, 24).join(" "),
        url: post.link,
        editionDate: post.date.slice(0, 10),
        verifiedAt: new Date().toISOString(),
        originalLanguage: "uz" as const,
        kind: "COURT_PRACTICE" as const,
        current: true,
      },
    ];
  });
}
async function plenumEvidence(question: string): Promise<LegalEvidence[]> {
  const keyTopic = topic(question);
  const words = normalizeLegalQuery(expandQuery(question)).split(" ");
  const ranked = courtIndex.sources
    .map((source) => ({
      source,
      score: words.reduce(
        (score, word) =>
          score + (normalizeLegalQuery(source.title).includes(word) ? 1 : 0),
        normalizeLegalQuery(source.title).includes(keyTopic) ? 4 : 0,
      ),
    }))
    .filter((item) => item.score >= 4)
    .sort((left, right) => right.score - left.score);
  const results = await Promise.allSettled(
    ranked.slice(0, 2).map(async ({ source }) => {
      const document = await lexDocument(source.lawId);
      const content = excerpt(document.paragraphs.join("\n"), question, 1800);
      if (!content) throw new Error("Plenum text unavailable");
      return {
        id: `plenum-${source.lawId}`,
        title: source.title,
        article: "Oliy sud Plenumi qarori",
        content,
        summary: content.slice(0, 650),
        url: source.url,
        editionDate: document.editionDate,
        verifiedAt: document.fetchedAt,
        originalLanguage: "uz" as const,
        kind: "PLENUM" as const,
        current: true,
      };
    }),
  );
  return results
    .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    .slice(0, 1);
}
export async function retrieveLegalEvidence(question: string) {
  const expansion = Promise.allSettled([
    liveSearch(question),
    courtReports(question),
    plenumEvidence(question),
  ]);
  const ranked = await semanticRerank(
    expandQuery(question),
    await lexicalCandidates(question),
  );
  const sources = ranked.sources.slice(0, 4);
  const liveResults = await Promise.allSettled(
    sources.map(async (source) => {
      if (!source.lawId || !source.articleNumber) return source;
      const document = await lexDocument(source.lawId);
      const article = document.articles.get(source.articleNumber);
      if (!article) return source;
      return {
        ...source,
        article: article.article,
        content: article.content,
        summary: excerpt(article.content, question, 650),
        url: `https://lex.uz/docs/${source.lawId}${article.anchor ? "#" + article.anchor : ""}`,
        editionDate: document.editionDate,
        verifiedAt: document.fetchedAt,
        current: true,
      };
    }),
  );
  const expanded = await expansion;
  const merged = [
    ...liveResults.map((result, index) =>
      result.status === "fulfilled" ? result.value : sources[index],
    ),
    ...expanded.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    ),
  ];
  return {
    sources: [...new Map(merged.map((source) => [source.id, source])).values()],
    semantic: ranked.semantic,
    documents: corpus.documents,
    articles: corpus.sources.length,
    live: merged.some((source) => source.current && source.kind === "LAW"),
    courtSources: merged.filter((source) => source.kind === "COURT_PRACTICE")
      .length,
  };
}
