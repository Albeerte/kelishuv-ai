import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { load } from "cheerio";

const repository = "javohirmat/uzbek-legal-corpus";
const revision = "54902864037d1e84be557cf6ba3ef5ea132d71ac";
const base = `https://raw.githubusercontent.com/${repository}/${revision}/`;
async function download(file, maximum = 6 * 1024 * 1024) {
  const response = await fetch(base + file, {
    signal: AbortSignal.timeout(30000),
  });
  if (
    !response.ok ||
    Number(response.headers.get("content-length") || 0) > maximum
  )
    throw new Error(`Download failed for ${file}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maximum) throw new Error(`File too large ${file}`);
  return bytes;
}
const manifest = (await download("manifest.csv")).toString("utf8");
const rows = manifest
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const filename = line.slice(0, line.indexOf(","));
    if (!/^[a-z0-9_-]+\.txt$/.test(filename))
      throw new Error("Unexpected manifest filename");
    return { code: filename.slice(0, -4) };
  });
if (rows.length !== 25) throw new Error("Unexpected corpus manifest size");
const sources = [];
const files = [];
for (let offset = 0; offset < rows.length; offset += 4) {
  const results = await Promise.allSettled(
    rows.slice(offset, offset + 4).map(async (row) => {
      const filename = `data/articles/${row.code}.jsonl`;
      const bytes = await download(filename);
      const records = bytes
        .toString("utf8")
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line));
      const articles = records
        .filter((record) => !["_front", "_end"].includes(record.article_id))
        .map((record) => {
          if (
            record.code !== row.code ||
            !/^-\d+$/.test(record.lex_uz_doc) ||
            typeof record.code_title !== "string" ||
            !/^\d+(?:\.\d+)?$/.test(record.article_id) ||
            typeof record.text !== "string" ||
            record.text.length > 150000
          )
            throw new Error(`Invalid article in ${filename}`);
          const content = `${record.article_display}. ${record.title}\n${record.text}`;
          return {
            id: `corpus-${row.code}-${record.article_id}`,
            lawId: record.lex_uz_doc,
            title: record.code_title,
            articleNumber: record.article_id,
            article: `${record.article_display}. ${record.title}`,
            content,
            url: `https://lex.uz/docs/${record.lex_uz_doc}`,
            snapshotDate: record.snapshot_date,
            contentHash: createHash("sha256").update(content).digest("hex"),
          };
        });
      return {
        articles,
        file: {
          path: filename,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      };
    }),
  );
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
    sources.push(...result.value.articles);
    files.push(result.value.file);
  }
}
if (
  new Set(sources.map((source) => source.id)).size !== sources.length ||
  sources.length < 7000
)
  throw new Error("Corpus validation failed");
const catalog = {
  repository: `https://github.com/${repository}`,
  revision,
  license: "CC0-1.0",
  snapshotDate: "2026-07",
  retrievedAt: new Date().toISOString(),
  documents: rows.length,
  sources,
  files,
};
const directory = path.resolve("src/data");
const target = path.join(directory, "assistant-corpus.json");
const temporary = target + ".tmp";
await fs.writeFile(temporary, JSON.stringify(catalog));
await fs.rename(temporary, target);
const notices = path.resolve("docs/licenses");
await fs.mkdir(notices, { recursive: true });
await fs.writeFile(
  path.join(notices, "uzbek-legal-corpus-CC0.txt"),
  await download("LICENSE"),
);
const courtIndexUrl = "https://sud.uz/la/plenum-la/documents-civil-la/";
const courtResponse = await fetch(courtIndexUrl, {
  signal: AbortSignal.timeout(20000),
});
if (!courtResponse.ok) throw new Error("Court practice index unavailable");
const courtPage = load(await courtResponse.text());
const courtSources = new Map();
courtPage("a[href]").each((_, node) => {
  const anchor = courtPage(node);
  const href = anchor.attr("href") || "";
  const document = /^https:\/\/lex\.uz\/(?:uz\/)?docs\/(-?\d+)/.exec(href);
  const title = anchor.parent().parent().text().replace(/\s+/g, " ").trim();
  if (
    document &&
    title.length > 40 &&
    title.length < 800 &&
    /\b(?:19|20)\d{2}\b/.test(title)
  )
    courtSources.set(document[1], {
      lawId: document[1],
      title,
      url: `https://lex.uz/docs/${document[1]}`,
    });
});
if (courtSources.size < 5)
  throw new Error("Court practice index structure changed");
await fs.writeFile(
  path.join(directory, "court-practice.json"),
  JSON.stringify(
    {
      source: courtIndexUrl,
      retrievedAt: new Date().toISOString(),
      sources: [...courtSources.values()],
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    documents: rows.length,
    articles: sources.length,
    bytes: (await fs.stat(target)).size,
    revision,
  }),
);
