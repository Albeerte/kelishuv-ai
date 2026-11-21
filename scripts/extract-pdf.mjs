// This subprocess receives PDF bytes over stdin and emits a bounded JSON result.
// Its parent sets a 192 MiB JavaScript heap limit and a 20-second wall-clock limit.
console.log = console.warn = () => {};
let size = 0;
const chunks = [];
for await (const chunk of process.stdin) {
  size += chunk.length;
  if (size > 10 * 1024 * 1024) process.exit(1);
  chunks.push(chunk);
}
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const loading = getDocument({
  data: new Uint8Array(Buffer.concat(chunks)),
  useSystemFonts: true,
  disableFontFace: true,
  maxImageSize: 16_000_000,
  verbosity: 0,
});
try {
  const pdf = await loading.promise;
  let text = "";
  const images = [];
  const warnings = [];
  for (
    let index = 1;
    index <= Math.min(pdf.numPages, 15) && text.length < 18000;
    index++
  ) {
    const page = await pdf.getPage(index);
    const reader = page.streamTextContent().getReader();
    try {
      while (text.length < 18000) {
        const part = await reader.read();
        if (part.done) break;
        for (const item of part.value.items) {
          if ("str" in item)
            text += (item.str + " ").slice(0, 18000 - text.length);
          if (text.length >= 18000) break;
        }
      }
    } finally {
      await reader.cancel(
        new Error("Text extraction finished or reached its limit"),
      );
    }
  }
  if (pdf.numPages > 15)
    warnings.push("Matn ajratish dastlabki 15 sahifa bilan cheklangan.");
  if (text.length >= 18000)
    warnings.push("Ajratilgan matn 18000 belgi bilan cheklangan.");
  if (text.trim().length < 30 && process.env.KELISHUV_PDF_SCANS === "1") {
    const { createCanvas } = await import("@napi-rs/canvas");
    for (let index = 1; index <= Math.min(pdf.numPages, 2); index++) {
      const page = await pdf.getPage(index);
      const base = page.getViewport({ scale: 1 });
      if (
        !Number.isFinite(base.width) ||
        !Number.isFinite(base.height) ||
        base.width <= 0 ||
        base.height <= 0
      )
        throw new Error("Invalid PDF dimensions");
      const viewport = page.getViewport({
        scale: Math.min(1.2, 1400 / Math.max(base.width, base.height)),
      });
      const canvas = createCanvas(
        Math.max(1, Math.ceil(viewport.width)),
        Math.max(1, Math.ceil(viewport.height)),
      );
      await page.render({
        canvasContext: canvas.getContext("2d"),
        canvas,
        viewport,
      }).promise;
      const image = canvas.toBuffer("image/png").toString("base64");
      if (image.length > 3 * 1024 * 1024)
        throw new Error("Scanned image exceeds output bound");
      images.push(image);
    }
    warnings.push("Skan tahlili dastlabki ikki sahifa bo‘yicha bajarilgan.");
  }
  process.stdout.write(JSON.stringify({ text, images, warnings }));
} finally {
  await loading.destroy();
}
