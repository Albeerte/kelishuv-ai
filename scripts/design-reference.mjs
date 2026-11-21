/* global AbortSignal, Buffer, URL, clearTimeout, console, document, fetch, process, scrollTo, setTimeout */
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";
import { gunzipSync } from "node:zlib";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tools = path.join(root, ".data", "design-tools");
const repository = path.join(tools, "site-deep-clone");
const runtime = path.join(tools, "runtime");
const hostedExtractor = "https://intelliscrape.fastapicloud.dev/scrape";
const extractorRevision = "1c78e83c180bb79e58b0cb4527fae28283a63f2a";

async function publishTool(staging, destination, readyFile) {
  if (path.dirname(staging) !== tools) throw new Error("Invalid tool staging directory.");
  try {
    try {
      await rename(staging, destination);
    } catch (error) {
      if (!existsSync(path.join(destination, readyFile))) throw error;
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

async function launchBrowser(playwright) {
  try {
    return await playwright.chromium.launch({ channel: "chrome", headless: true });
  } catch {
    try {
      return await playwright.chromium.launch({ headless: true });
    } catch (error) {
      if (!/Executable doesn't exist|playwright install|browser.*missing/i.test(error.message)) throw error;
      await run(process.execPath, [path.join(runtime, "node_modules/playwright/cli.js"), "install", "chromium"], { timeout: 240000, maxBuffer: 2 * 1024 * 1024 });
      return playwright.chromium.launch({ headless: true });
    }
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function prepare() {
  await mkdir(tools, { recursive: true });
  if (!existsSync(path.join(repository, "lib", "capture-page.mjs"))) {
    const staging = path.join(tools, `extractor-${randomUUID()}`);
    await run("git", ["clone", "--depth", "1", "--no-checkout", "https://github.com/viniciuscffreitas/site-deep-clone.git", staging], { timeout: 180000 });
    await run("git", ["-C", staging, "fetch", "--depth", "1", "origin", extractorRevision], { timeout: 180000 });
    await run("git", ["-C", staging, "checkout", "--detach", extractorRevision]);
    await publishTool(staging, repository, "lib/capture-page.mjs");
  }
  const require = createRequire(path.join(runtime, "package.json"));
  const playwrightPackage = path.join(runtime, "node_modules", "playwright");
  try {
    return { playwright: require(playwrightPackage) };
  } catch {
    const staging = path.join(tools, `runtime-${randomUUID()}`);
    await mkdir(staging);
    await writeFile(path.join(staging, "package.json"), JSON.stringify({ private: true, dependencies: { playwright: "1.65.1" } }, null, 2));
    const executableDirectory = path.dirname(process.execPath);
    const npmCli = [
      process.env.npm_execpath,
      path.join(executableDirectory, "node_modules/npm/bin/npm-cli.js"),
      path.resolve(executableDirectory, "../lib/node_modules/npm/bin/npm-cli.js"),
      "/usr/share/nodejs/npm/bin/npm-cli.js",
    ].find(candidate => candidate && existsSync(candidate));
    if (!npmCli) throw new Error("npm CLI topilmadi. Buyruqni npm run design:reference orqali ishga tushiring.");
    await run(process.execPath, [npmCli, "install", "--prefix", staging, "--ignore-scripts", "--no-audit", "--no-fund"], { timeout: 180000 });
    await publishTool(staging, runtime, "node_modules/playwright/package.json");
    return { playwright: require(playwrightPackage) };
  }
}

async function publicHtml(url) {
  const response = await fetch(hostedExtractor, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, raw: true }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Ommaviy ekstraktor HTTP ${response.status}`);
  const result = await response.json();
  if (!result.success || typeof result.content !== "string") throw new Error("Ommaviy sahifa manbasi olinmadi.");
  return result.content;
}

function contentType(url, body) {
  const extension = path.extname(new URL(url).pathname).toLowerCase();
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml; charset=utf-8";
  if ([".js", ".mjs"].includes(extension)) return "text/javascript; charset=utf-8";
  if (body.trim().startsWith("{")) return "application/json; charset=utf-8";
  return "text/html; charset=utf-8";
}

function assetExtension(mime) {
  return ({
    "font/woff2": ".woff2", "font/woff": ".woff", "font/ttf": ".ttf",
    "font/otf": ".otf", "text/css": ".css", "text/javascript": ".js",
    "application/javascript": ".js", "image/png": ".png", "image/jpeg": ".jpg",
    "image/svg+xml": ".svg", "image/webp": ".webp", "image/avif": ".avif",
    "image/gif": ".gif", "image/x-icon": ".ico",
  })[mime.split(";")[0].trim().toLowerCase()] || ".bin";
}

async function mirror(source, html, allowProxy, directory) {
  const cache = new Map();
  const resources = [];
  const entry = source.pathname + source.search;
  cache.set(entry, Promise.resolve({ body: html, type: "text/html; charset=utf-8" }));
  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "GET") {
        response.writeHead(405).end("Reference capture is read-only.");
        return;
      }
      const target = new URL(source.origin + request.url);
      if (target.origin !== source.origin) {
        response.writeHead(404).end();
        return;
      }
      const key = target.pathname + target.search;
      if (!cache.has(key)) cache.set(key, (async () => {
        let body;
        let type;
        try {
          const remote = await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(20000) });
          if ([301, 302, 303, 307, 308].includes(remote.status)) {
            const location = remote.headers.get("location");
            await remote.body?.cancel();
            if (!location) throw new Error("Reference redirect has no destination.", { cause: "reference-redirect" });
            const next = new URL(location, target);
            if (next.origin !== source.origin || next.username || next.password)
              throw new Error("Reference resource redirected outside its source origin.", { cause: "reference-redirect" });
            resources.push({ source: target.href, redirect: next.href });
            return { body: "", type: "text/plain", status: remote.status, location: next.pathname + next.search + next.hash };
          }
          if (!remote.ok) throw new Error(`HTTP ${remote.status}`);
          body = Buffer.from(await remote.arrayBuffer());
          type = remote.headers.get("content-type") || "application/octet-stream";
        } catch (error) {
          if (!allowProxy || error.cause === "reference-redirect") throw error;
          if (/\.(png|jpe?g|webp|avif|gif|woff2?|ttf|otf|ico)$/i.test(target.pathname)) throw error;
          body = await publicHtml(target.href);
          type = contentType(target.href, body);
        }
        const filename = createHash("sha256").update(target.href).digest("hex").slice(0, 16) + (path.extname(target.pathname) || ".txt");
        await writeFile(path.join(directory, "source", filename), body);
        resources.push({ source: target.href, file: `source/${filename}` });
        return { body, type };
      })());
      const resource = await cache.get(key);
      const headers = { "Content-Type": resource.type };
      if (resource.location) headers.Location = resource.location;
      response.writeHead(resource.status || 200, headers).end(resource.body);
    } catch {
      response.writeHead(502, { "Content-Type": "application/json" }).end('{"error":"Reference resource unavailable"}');
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}${entry}${source.hash}`,
    resources,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}

function measuredValues(snapshots, property) {
  const values = new Map();
  for (const snapshot of snapshots)
    for (const group of snapshot.groupedComputed) {
      const value = group.computed[property];
      if (value && !["none", "normal", "auto", "0px", "rgba(0, 0, 0, 0)"].includes(value))
        values.set(value, (values.get(value) || 0) + group.count);
    }
  return [...values].map(([value, count]) => ({ value, count })).sort((first, second) => second.count - first.count).slice(0, 18);
}

async function bundledAssets(html, directory) {
  const block = html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/i);
  if (!block) return [];
  const manifest = JSON.parse(block[1]);
  const assets = [];
  for (const [id, entry] of Object.entries(manifest).slice(0, 200)) {
    if (!/^[\w-]+$/.test(id) || typeof entry.data !== "string" || entry.data.length > 15 * 1024 * 1024) continue;
    const encoded = Buffer.from(entry.data, "base64");
    const bytes = entry.compressed ? gunzipSync(encoded, { maxOutputLength: 10 * 1024 * 1024 }) : encoded;
    const mime = String(entry.mime || "");
    const extension = assetExtension(mime);
    const file = `assets/${id}${extension}`;
    await writeFile(path.join(directory, file), bytes);
    assets.push({ id, type: mime.startsWith("font/") ? "font" : "embedded", mime, bytes: bytes.length, file });
  }
  const templateBlock = html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/i);
  if (templateBlock) {
    const template = JSON.parse(templateBlock[1]);
    const { extractAtRules } = await import(pathToFileURL(path.join(repository, "lib/parse-css.mjs")));
    const rules = extractAtRules(template);
    await writeFile(path.join(directory, "data", "at-rules.json"), JSON.stringify(rules, null, 2));
    await writeFile(path.join(directory, "source", "unpacked-template.html"), template);
  }
  return assets;
}

async function exportDesign(directory, report, snapshots) {
  const categories = {
    colors: "color", backgrounds: "background-color", fonts: "font-family",
    fontSizes: "font-size", weights: "font-weight", spacing: "padding",
    radii: "border-radius", shadows: "box-shadow",
  };
  const tokens = Object.fromEntries(Object.entries(categories).map(([name, property]) => [name, measuredValues(snapshots, property)]));
  const variables = Object.assign({}, ...snapshots.map(snapshot => snapshot.cssVars));
  const design = { ...report, variables, tokens };
  await writeFile(path.join(directory, "design.json"), JSON.stringify(design, null, 2));
  const variableLines = Object.entries(variables).filter(([name]) => /^--[\w-]+$/.test(name)).map(([name, value]) => `  ${name}: ${value};`);
  const measuredLines = Object.entries(tokens).flatMap(([name, values]) => values.map((token, index) => `  --measured-${name.toLowerCase()}-${index + 1}: ${token.value};`));
  await writeFile(path.join(directory, "tokens.css"), `/* Measured values. Semantic roles require design review. */\n:root {\n${[...variableLines, ...measuredLines].join("\n")}\n}\n`);
  const markdown = [
    `# Design reference — ${new URL(report.source).hostname}`,
    "", `Source ${report.source}`, "", `Captured ${report.capturedAt}`, "",
    `Transport ${report.transport}. Rendering ${report.rendering}. Status ${report.status}.`, "",
    `Profiles ${report.profiles.join(", ")}.`, "",
    "## Capture scope", "",
    "This document records measured CSS and rendered source material. Color roles and implementation choices are reviewed separately.", "",
    ...Object.entries(tokens).flatMap(([name, values]) => [`## ${name}`, "", ...values.map(token => `- \`${token.value}\` observed on ${token.count} sampled elements.`), ""]),
    "## Evidence", "",
    "- `raw.html` contains the captured source.",
    "- `data/` contains per-profile DOM, computed style and animation snapshots.",
    "- `screenshots/` contains desktop, tablet and mobile captures.",
    "- `assets.json` maps downloaded resources to their source URLs.",
    "", "## Gaps", "", ...report.gaps.map(gap => `- ${gap}`), "",
  ].join("\n");
  await writeFile(path.join(directory, "DESIGN.md"), markdown);
  const blocks = Object.entries(tokens).map(([name, values]) => `<section><h2>${escapeHtml(name)}</h2><ul>${values.map(token => `<li><code>${escapeHtml(token.value)}</code><span>${token.count}</span></li>`).join("")}</ul></section>`).join("");
  await writeFile(path.join(directory, "preview.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Design reference</title><style>body{font:16px/1.6 system-ui;background:#faf9f5;color:#243a32;max-width:1100px;margin:40px auto;padding:0 24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}section{background:white;border:1px solid #dfe5de;border-radius:12px;padding:24px}h1{line-height:1.2}h2{margin-top:0;font-size:20px}ul{list-style:none;padding:0}li{display:flex;justify-content:space-between;gap:20px;border-top:1px solid #ddd;padding:10px 0}code{overflow-wrap:anywhere}span{color:#5d6a63}small{display:block}p{overflow-wrap:anywhere}</style><h1>Measured design reference</h1><p>${escapeHtml(report.source)}</p><p>${escapeHtml(report.transport)} · ${escapeHtml(report.status)}</p><main>${blocks}</main></html>`);
  return design;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" }, html: { type: "string" },
      "public-proxy": { type: "boolean", default: false },
      "storage-state": { type: "string" }, breakpoints: { type: "string", default: "390,768,1024,1440" },
    },
  });
  const source = new URL(positionals[0] || "https://getsherik.uz/");
  if (!["http:", "https:"].includes(source.protocol) || source.username || source.password)
    throw new Error("HTTP/S sahifa manzilini kiriting. Autentifikatsiya uchun --storage-state ishlatiladi.");
  const widths = values.breakpoints.split(",").map(Number);
  if (!widths.length || widths.length > 8 || widths.some(width => !Number.isInteger(width) || width < 320 || width > 2560))
    throw new Error("Ekran o‘lchamlari 320–2560 oralig‘ida bo‘lsin, ko‘pi bilan sakkizta.");
  const slug = source.hostname.replace(/[^a-z0-9.-]/gi, "-");
  const directory = path.resolve(root, values.output || `.data/design-reference/${slug}-${Date.now()}-${randomUUID().slice(0, 6)}`);
  await mkdir(path.dirname(directory), { recursive: true });
  try {
    await mkdir(directory);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("Bu natija papkasi mavjud yoki boshqa ekstraksiya uni band qilgan. Yangi --output papka tanlang.", { cause: error });
    throw error;
  }
  for (const child of ["data", "screenshots", "assets", "source"]) await mkdir(path.join(directory, child), { recursive: true });
  const { playwright } = await prepare();
  const { capturePage } = await import(pathToFileURL(path.join(repository, "lib/capture-page.mjs")));
  const { captureHover } = await import(pathToFileURL(path.join(repository, "lib/capture-hover.mjs")));
  const { captureScrollStates } = await import(pathToFileURL(path.join(repository, "lib/capture-scroll.mjs")));
  const revision = (await run("git", ["-C", repository, "rev-parse", "HEAD"])).stdout.trim();
  const browser = await launchBrowser(playwright);
  const report = {
    source: source.href, capturedAt: new Date().toISOString(), transport: "direct-browser",
    rendering: "Chromium", status: "succeeded", profiles: [], gaps: [],
    extractor: { repository: "https://github.com/viniciuscffreitas/site-deep-clone", commit: revision },
  };
  const assets = [], snapshots = [], pendingAssets = [];
  let localMirror;
  try {
    const context = await browser.newContext({ storageState: values["storage-state"] ? path.resolve(values["storage-state"]) : undefined });
    const page = await context.newPage();
    let documentResponse;
    const checkDocument = () => {
      if (documentResponse && !documentResponse.ok())
        throw new Error(`Reference document HTTP ${documentResponse.status()} — ${documentResponse.url()}`);
    };
    const activeRequests = new Set();
    let networkVersion = 0;
    page.on("request", request => {
      activeRequests.add(request);
      networkVersion++;
    });
    const requestFinished = request => {
      activeRequests.delete(request);
      networkVersion++;
    };
    page.on("requestfinished", requestFinished);
    page.on("requestfailed", requestFinished);
    const onResponse = response => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame())
        documentResponse = response;
      if (response.status() >= 400) {
        report.gaps.push(`Resource HTTP ${response.status()} — ${response.url().slice(0, 180)}`);
        return;
      }
      const type = response.request().resourceType();
      if (!["stylesheet", "script", "image", "font"].includes(type) || !response.ok()) return;
      if (pendingAssets.length >= 200) {
        report.gaps.push("Resource capture reached the 200-asset limit.");
        return;
      }
      pendingAssets.push((async () => {
        try {
          const bytes = await response.body();
          if (bytes.length > 10 * 1024 * 1024) {
            report.gaps.push(`Resource exceeds 10 MB — ${response.url().slice(0, 180)}`);
            return;
          }
          const url = response.url();
          const filename = createHash("sha256").update(url).update("\0").update(bytes).digest("hex");
          const mime = response.headers()["content-type"] || "";
          const extension = assetExtension(mime);
          await writeFile(path.join(directory, "assets", filename + extension), bytes);
          assets.push({ url, type, mime, bytes: bytes.length, file: `assets/${filename}${extension}` });
        } catch {
          report.gaps.push(`Resource body unavailable — ${response.url().slice(0, 180)}`);
        }
      })());
    };
    page.on("response", onResponse);
    page.on("requestfailed", request => report.gaps.push(`Resource failed ${request.url().slice(0, 180)} — ${request.failure()?.errorText}`));
    page.on("pageerror", error => report.gaps.push(`Page script error — ${error.message}`));
    let html;
    let target = source.href;
    try {
      if (values.html) throw new Error("Local source supplied");
      const response = await page.goto(source.href, { waitUntil: "domcontentloaded", timeout: 25000 });
      if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
      html = await response.text();
    } catch (error) {
      if (values["storage-state"] && !values.html) throw error;
      if (values.html) {
        html = await readFile(path.resolve(values.html), "utf8");
        report.transport = "supplied-html";
      } else {
        if (!values["public-proxy"]) throw error;
        report.gaps.push(`Direct capture failed — ${error.message.split("\n")[0]}`);
        html = await publicHtml(source.href);
        report.transport = "IntelliScrape hosted public HTML";
      }
      report.rendering = "Local Chromium rendering of captured public source";
      localMirror = await mirror(source, html, values["public-proxy"], directory);
      target = localMirror.url;
      const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (!response?.ok()) throw new Error(`Reference document HTTP ${response?.status()}`, { cause: error });
    }
    await writeFile(path.join(directory, "raw.html"), html);
    assets.push(...await bundledAssets(html, directory));
    await page.waitForTimeout(1000);
    const fontsReady = await page.evaluate(() => Promise.race([
      document.fonts.ready.then(() => true),
      new Promise(resolve => setTimeout(() => resolve(false), 8000)),
    ]));
    if (!fontsReady) report.gaps.push("Font loading did not settle within eight seconds.");
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(350);
      const scroll = await captureScrollStates(page);
      await page.evaluate(() => scrollTo(0, 0));
      const snapshot = await capturePage(page);
      checkDocument();
      if (!snapshot.headlines.length && snapshot.title.includes("Error")) throw new Error("Manba sahifasi o‘rniga xato ekrani olindi.");
      snapshots.push(snapshot);
      report.profiles.push(width);
      await writeFile(path.join(directory, "data", `dom-${width}.json`), JSON.stringify(snapshot, null, 2));
      await writeFile(path.join(directory, "data", `scroll-${width}.json`), JSON.stringify(scroll, null, 2));
      await page.screenshot({ path: path.join(directory, "screenshots", `viewport-${width}.png`) });
      await page.screenshot({ path: path.join(directory, "screenshots", `full-${width}.png`), fullPage: true });
    }
    const hover = await captureHover(page, { max: 16 });
    await writeFile(path.join(directory, "data", "hover.json"), JSON.stringify(hover, null, 2));
    const networkDeadline = Date.now() + 5000;
    let networkSettled = false;
    while (Date.now() < networkDeadline) {
      const previousVersion = networkVersion;
      await page.waitForTimeout(500);
      if (!activeRequests.size && previousVersion === networkVersion) {
        networkSettled = true;
        break;
      }
    }
    if (!networkSettled) report.gaps.push("Network remained active at capture finalization.");
    checkDocument();
    let drainTimer;
    const drained = await Promise.race([
      Promise.allSettled(pendingAssets).then(() => true),
      new Promise(resolve => { drainTimer = setTimeout(() => resolve(false), 15000); }),
    ]);
    clearTimeout(drainTimer);
    if (!drained) report.gaps.push("Resource bodies did not settle within fifteen seconds.");
    await context.close();
    if (activeRequests.size) report.gaps.push("Capture ended with pending network requests.");
    page.off("response", onResponse);
    await Promise.allSettled(pendingAssets);
    const mirrorResources = localMirror?.resources || [];
    if (localMirror) {
      await localMirror.close();
      localMirror = undefined;
    }
    await writeFile(path.join(directory, "assets.json"), JSON.stringify({ assets, mirrorResources }, null, 2));
    report.gaps = [...new Set(report.gaps)];
    if (report.gaps.length) report.status = "partial";
    const design = await exportDesign(directory, report, snapshots);
    console.log(JSON.stringify({ status: report.status, directory, profiles: report.profiles, assets: assets.length, tokens: Object.fromEntries(Object.entries(design.tokens).map(([name, values]) => [name, values.length])), gaps: report.gaps.length }));
  } catch (error) {
    await writeFile(path.join(directory, "capture-error.json"), JSON.stringify({ ...report, status: "failed", error: error.message }, null, 2));
    throw error;
  } finally {
    await browser.close();
    if (localMirror) await localMirror.close();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
