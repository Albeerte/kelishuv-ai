/* global Buffer, URL, console, process, setTimeout */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, ".data", "design-reference", `regression-${Date.now()}-${randomUUID().slice(0, 6)}`);
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
let delayedRequests = 0;
let changingResponses = 0;
let privateRequests = 0;
let redirectedImages = 0;
const allowedScript = "window.allowedFixture = true;";

const privateServer = createServer((_request, response) => {
  privateRequests++;
  response.writeHead(200, { "Content-Type": "text/javascript" }).end("window.privateFixture = true;");
});

const server = createServer((request, response) => {
  if (request.url === "/missing.png") {
    response.writeHead(404).end("Missing fixture image");
    return;
  }
  if (request.url === "/broken.css") {
    response.writeHead(500, { "Content-Type": "text/css" }).end("/* fixture failure */");
    return;
  }
  if (request.url === "/late.png") {
    delayedRequests++;
    response.writeHead(200, { "Content-Type": "image/png" });
    response.write(image.subarray(0, 8));
    setTimeout(() => response.end(image.subarray(8)), 1200);
    return;
  }
  if (request.url === "/follow-up.png") {
    delayedRequests++;
    setTimeout(() => response.writeHead(200, { "Content-Type": "image/png" }).end(image), 300);
    return;
  }
  if (request.url === "/api/failure" || request.url === "/frame-failure") {
    response.writeHead(request.url === "/api/failure" ? 503 : 502).end("Fixture unavailable");
    return;
  }
  if (request.url === "/changing.js") {
    changingResponses++;
    response.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" })
      .end(`window.captureVersion = ${changingResponses};\n// ${"different body ".repeat(changingResponses)}`);
    return;
  }
  if (request.url === "/redirect.js") {
    response.writeHead(302, { Location: `http://127.0.0.1:${privateServer.address().port}/private.js` }).end();
    return;
  }
  if (request.url === "/redirect-allowed.js") {
    response.writeHead(302, { Location: "/allowed.js" }).end();
    return;
  }
  if (request.url === "/allowed.js") {
    response.writeHead(200, { "Content-Type": "text/javascript" }).end(allowedScript);
    return;
  }
  if (request.url === "/theme.css") {
    response.writeHead(302, { Location: "/styles/theme.css" }).end();
    return;
  }
  if (request.url === "/styles/theme.css") {
    response.writeHead(200, { "Content-Type": "text/css" }).end('body{background-image:url("tile.png")}');
    return;
  }
  if (request.url === "/styles/tile.png") {
    redirectedImages++;
    response.writeHead(200, { "Content-Type": "image/png" }).end(image);
    return;
  }
  if (request.url === "/failed-document") {
    response.writeHead(503, { "Content-Type": "text/html" }).end("Unavailable fixture document");
    return;
  }
  const broken = request.url === "/http-error";
  const fixtureBodies = {
    "/http-error": `<img src="/missing.png" alt="Missing fixture"><iframe src="/frame-failure" title="Failing frame"></iframe><script>fetch('/api/failure');</script>`,
    "/late-assets": `<button id="load">Preview</button>
<script>document.querySelector('button').addEventListener('mouseenter', () => {
  const first = new Image();
  first.onload = () => { const second = new Image(); second.src = '/follow-up.png'; document.body.append(second); };
  first.src = '/late.png'; document.body.append(first);
}, { once: true });</script>`,
    "/changing-assets": `<script src="/changing.js"></script><button>Reload script</button>
<script>document.querySelector('button').addEventListener('mouseenter', () => {
  const script = document.createElement('script'); script.src = '/changing.js'; document.body.append(script);
}, { once: true });</script>`,
  };
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(`<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Reference fixture</title>
${broken ? '<link rel="stylesheet" href="/broken.css">' : ""}
<style>body{font:16px/1.6 sans-serif;padding:32px}button{padding:16px}img{width:24px;height:24px}</style>
<h1>Reference capture fixture</h1>
${fixtureBodies[request.url] || ""}</html>`);
});

await Promise.all([server, privateServer].map(listener => new Promise((resolve, reject) => {
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", resolve);
})));

async function capture(fixture, extra = [], output = path.join(directory, fixture)) {
  return run(process.execPath, ["--use-system-ca", "scripts/design-reference.mjs", `http://127.0.0.1:${server.address().port}/${fixture}`, `--output=${output}`, "--breakpoints=390", ...extra], { cwd: root, timeout: 120000 });
}

try {
  await mkdir(directory, { recursive: true });
  for (const fixture of ["http-error", "late-assets", "changing-assets"]) {
    const output = path.join(directory, fixture);
    await capture(fixture);
    const report = JSON.parse(await readFile(path.join(output, "design.json"), "utf8"));
    const manifestPath = path.join(output, "assets.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (fixture === "http-error") {
      assert.equal(report.status, "partial");
      assert.ok(report.gaps.some(gap => gap.includes("HTTP 404") && gap.includes("missing.png")));
      assert.ok(report.gaps.some(gap => gap.includes("HTTP 500") && gap.includes("broken.css")));
      assert.ok(report.gaps.some(gap => gap.includes("HTTP 503") && gap.includes("api/failure")));
      assert.ok(report.gaps.some(gap => gap.includes("HTTP 502") && gap.includes("frame-failure")));
    } else if (fixture === "late-assets") {
      assert.equal(report.status, "succeeded", JSON.stringify(report.gaps));
      assert.equal(delayedRequests, 2);
      assert.deepEqual(manifest.assets.map(asset => new URL(asset.url).pathname).sort(), ["/follow-up.png", "/late.png"]);
    } else {
      assert.equal(report.status, "succeeded", JSON.stringify(report.gaps));
      assert.equal(changingResponses, 2);
      assert.equal(manifest.assets.length, 2);
      assert.equal(new Set(manifest.assets.map(asset => asset.file)).size, 2);
      assert.equal(new Set(manifest.assets.map(asset => asset.bytes)).size, 2);
    }
    const files = await readdir(path.join(output, "assets"));
    assert.equal(files.length, new Set(manifest.assets.map(asset => path.basename(asset.file))).size);
    for (const asset of manifest.assets)
      assert.equal((await readFile(path.join(output, asset.file))).length, asset.bytes);
    console.log(`PASS ${fixture}`);
  }

  const suppliedHtml = path.join(directory, "mirror-source.html");
  await writeFile(suppliedHtml, '<!doctype html><title>Redirect fixture</title><link rel="stylesheet" href="/theme.css"><h1>Mirror redirects</h1><script src="/redirect.js"></script><script src="/redirect-allowed.js"></script>');
  await capture("redirected", [`--html=${suppliedHtml}`]);
  const mirroredReport = JSON.parse(await readFile(path.join(directory, "redirected/design.json"), "utf8"));
  const mirroredAssets = JSON.parse(await readFile(path.join(directory, "redirected/assets.json"), "utf8"));
  assert.equal(privateRequests, 0);
  assert.equal(redirectedImages, 1);
  assert.equal(mirroredReport.status, "partial");
  assert.ok(mirroredReport.gaps.some(gap => gap.includes("HTTP 502") && gap.includes("redirect.js")));
  const allowed = mirroredAssets.assets.find(asset => asset.url?.endsWith("/allowed.js"));
  assert.ok(allowed, "Same-origin redirect was not captured");
  assert.equal(await readFile(path.join(directory, "redirected", allowed.file), "utf8"), allowedScript);
  console.log("PASS mirror redirects");

  const failedHtml = path.join(directory, "failed-document.html");
  await writeFile(failedHtml, '<!doctype html><script>location.replace("/failed-document");</script><h1>Loading fixture</h1>');
  await assert.rejects(capture("failed-navigation", [`--html=${failedHtml}`]), error => error.code === 1);
  const failedDirectory = path.join(directory, "failed-navigation");
  const failedReport = JSON.parse(await readFile(path.join(failedDirectory, "capture-error.json"), "utf8"));
  assert.equal(failedReport.status, "failed");
  assert.ok(failedReport.gaps.some(gap => gap.includes("HTTP 502")));
  assert.equal(existsSync(path.join(failedDirectory, "design.json")), false);
  console.log("PASS unsuccessful mirrored navigation");

  const doubleHtml = path.join(directory, "double-slash.html");
  const doubleDirectory = path.join(directory, "double-slash");
  await writeFile(doubleHtml, '<!doctype html><title>Double slash fixture</title><h1>Leading double slash</h1>');
  await run(process.execPath, ["--use-system-ca", "scripts/design-reference.mjs", `http://127.0.0.1:${server.address().port}//entry`, `--html=${doubleHtml}`, `--output=${doubleDirectory}`, "--breakpoints=390"], { cwd: root, timeout: 120000 });
  const doubleReport = JSON.parse(await readFile(path.join(doubleDirectory, "design.json"), "utf8"));
  assert.equal(doubleReport.status, "succeeded");
  assert.deepEqual(doubleReport.profiles, [390]);
  console.log("PASS leading double-slash mirror path");

  const concurrent = await Promise.allSettled([capture("concurrent"), capture("concurrent")]);
  assert.equal(concurrent.filter(result => result.status === "fulfilled").length, 1);
  const rejected = concurrent.find(result => result.status === "rejected");
  assert.ok(rejected.reason.stderr.includes("Bu natija papkasi mavjud"));
  const reservedReport = JSON.parse(await readFile(path.join(directory, "concurrent/design.json"), "utf8"));
  assert.equal(reservedReport.status, "succeeded");
  console.log("PASS concurrent output reservation");

  const isolatedRoot = path.join(directory, "cold-initialization");
  await mkdir(path.join(isolatedRoot, "scripts"), { recursive: true });
  const isolatedScript = path.join(isolatedRoot, "scripts/design-reference.mjs");
  await writeFile(isolatedScript, await readFile(path.join(root, "scripts/design-reference.mjs")));
  const fakeNpm = path.join(isolatedRoot, "fixture-npm.cjs");
  const installedPlaywright = path.join(root, ".data/design-tools/runtime/node_modules/playwright");
  await writeFile(fakeNpm, `const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const prefix = process.argv[process.argv.indexOf('--prefix') + 1];
  const target = path.join(prefix, 'node_modules/playwright');
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, 'package.json'), JSON.stringify({ name: 'playwright', version: '1.65.1', main: 'index.cjs' }));
  await fs.writeFile(path.join(target, 'index.cjs'), ${JSON.stringify(`module.exports = require(${JSON.stringify(installedPlaywright)});`)});
})().catch(error => { console.error(error); process.exitCode = 1; });`);
  const localRepository = pathToFileURL(path.join(root, ".data/design-tools/site-deep-clone")).href;
  const isolatedOptions = {
    cwd: isolatedRoot,
    timeout: 120000,
    env: {
      ...process.env,
      npm_execpath: fakeNpm,
      GIT_ALLOW_PROTOCOL: "file",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: `url.${localRepository}.insteadOf`,
      GIT_CONFIG_VALUE_0: "https://github.com/viniciuscffreitas/site-deep-clone.git",
    },
  };
  const isolatedArguments = ["--use-system-ca", isolatedScript, `http://127.0.0.1:${server.address().port}/concurrent`, "--breakpoints=390"];
  await Promise.all(["first", "second"].map(name => run(process.execPath, [...isolatedArguments, `--output=${name}`], isolatedOptions)));
  for (const name of ["first", "second"]) {
    const report = JSON.parse(await readFile(path.join(isolatedRoot, name, "design.json"), "utf8"));
    assert.equal(report.status, "succeeded");
  }
  console.log("PASS concurrent cold initialization");

  const gitHead = path.join(isolatedRoot, ".data/design-tools/site-deep-clone/.git/HEAD");
  const originalHead = await readFile(gitHead);
  try {
    await writeFile(gitHead, "invalid fixture metadata\n");
    await assert.rejects(
      run(process.execPath, [...isolatedArguments, "--output=metadata-failure"], { ...isolatedOptions, timeout: 5000 }),
      error => error.code === 1 && !error.killed,
    );
  } finally {
    await writeFile(gitHead, originalHead);
  }
  console.log("PASS metadata failure exits before browser launch");
} finally {
  await Promise.all([server, privateServer].map(listener => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()))));
}
