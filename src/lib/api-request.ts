import type { NextRequest } from "next/server";
import { MediationError } from "./mediation";

export async function boundedBody(request: NextRequest, maximum: number) {
  if (Number(request.headers.get("content-length") || 0) > maximum)
    throw new MediationError(
      413,
      "So‘rov hajmi ruxsat etilgan chegaradan oshdi.",
    );
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new MediationError(
          413,
          "So‘rov hajmi ruxsat etilgan chegaradan oshdi.",
        );
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function jsonBody(request: NextRequest) {
  return JSON.parse((await boundedBody(request, 64 * 1024)).toString("utf-8"));
}

export async function documentForm(request: NextRequest) {
  const contents = await boundedBody(request, 11 * 1024 * 1024);
  const form = await new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: new Uint8Array(contents),
  }).formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024)
    throw new MediationError(400, "10 MB gacha bo‘lgan fayl tanlang.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const formats: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    txt: "text/plain",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  if (!extension || !formats[extension])
    throw new MediationError(400, "PDF, DOCX, TXT, JPG yoki PNG fayl yuklang.");
  return { form, file, mime: formats[extension] };
}
