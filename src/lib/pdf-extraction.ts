import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";

const output = z.object({
  text: z.string().max(18000),
  images: z.array(z.string().max(3 * 1024 * 1024)).max(2),
  warnings: z.array(z.string().max(1000)).max(5),
});

export function extractPdfEvidence(buffer: Buffer, renderScans: boolean) {
  if (buffer.length > 10 * 1024 * 1024)
    return Promise.reject(new Error("PDF hajmi tahlil chegarasidan katta."));
  return new Promise<z.infer<typeof output>>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--max-old-space-size=192",
        path.join(process.cwd(), "scripts", "extract-pdf.mjs"),
      ],
      {
        windowsHide: true,
        stdio: ["pipe", "pipe", "ignore"],
        env: {
          NODE_ENV: process.env.NODE_ENV,
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          TEMP: process.env.TEMP,
          KELISHUV_PDF_SCANS: renderScans ? "1" : "0",
        },
      },
    );
    let settled = false;
    let size = 0;
    const chunks: Buffer[] = [];
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      reject(
        new Error("PDF tahlilini cheklangan jarayonda yakunlab bo‘lmadi."),
      );
    };
    const timer = setTimeout(fail, 20000);
    child.on("error", fail);
    child.stdin.on("error", fail);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) {
        fail();
        return;
      }
      chunks.push(chunk);
    });
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        fail();
        return;
      }
      try {
        const result = output.parse(
          JSON.parse(Buffer.concat(chunks).toString("utf8")),
        );
        settled = true;
        clearTimeout(timer);
        resolve(result);
      } catch {
        fail();
      }
    });
    child.stdin.end(buffer);
  });
}
