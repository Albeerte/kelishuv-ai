"use client";
import { T as LocalizedText } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "../ui/button";
import { useI18n } from "@/lib/i18n";
import type { SignatureBox } from "@/lib/kelishuv-types";

export function PdfPreview({
  url,
  onPageSeen,
  boxes = [],
  onBoxesChange,
  editable = false,
  versionKey,
}: {
  url: string;
  onPageSeen?: (page: number) => void;
  boxes?: SignatureBox[];
  onBoxesChange?: (boxes: SignatureBox[]) => void;
  editable?: boolean;
  versionKey?: string;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(700);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const seen = useRef(onPageSeen);
  seen.current = onPageSeen;
  const { t } = useI18n();
  useEffect(() => {
    let disposed = false;
    let task: PDFDocumentLoadingTask | undefined;
    setLoading(true);
    setError("");
    setPdf(null);
    setPage(0);
    void import("pdfjs-dist/build/pdf.mjs")
      .then(async (pdfjs) => {
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        task = pdfjs.getDocument({ url, withCredentials: true });
        const loaded = await task.promise;
        if (!disposed) setPdf(loaded);
      })
      .catch(() => {
        if (!disposed) {
          setError(
            "PDF ko‘rinishini yuklab bo‘lmadi. Faylni yuklab olish havolasidan foydalaning.",
          );
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      void task?.destroy();
    };
  }, [url, versionKey]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.min(820, Math.max(220, entries[0].contentRect.width))),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let disposed = false;
    let render: RenderTask | undefined;
    setLoading(true);
    void pdf
      .getPage(page + 1)
      .then(async (pdfPage) => {
        if (disposed || !canvas.current) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const viewport = pdfPage.getViewport({
          scale: (width * zoom) / base.width,
        });
        const target = canvas.current;
        target.width = Math.round(viewport.width * ratio);
        target.height = Math.round(viewport.height * ratio);
        target.style.width = `${viewport.width}px`;
        target.style.height = `${viewport.height}px`;
        render = pdfPage.render({
          canvas: target,
          canvasContext: target.getContext("2d")!,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        await render.promise;
        if (!disposed) {
          setLoading(false);
          seen.current?.(page);
        }
      })
      .catch((error) => {
        if (!disposed && error?.name !== "RenderingCancelledException") {
          setError("PDF sahifasini ko‘rsatishda xato.");
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      render?.cancel();
    };
  }, [pdf, page, width, zoom]);
  function move(event: React.PointerEvent, index: number) {
    if (!editable || !onBoxesChange) return;
    const element = event.currentTarget as HTMLElement;
    const surface = element.parentElement!;
    const rect = surface.getBoundingClientRect();
    const original = boxes[index];
    const startX = event.clientX;
    const startY = event.clientY;
    element.setPointerCapture(event.pointerId);
    const update = (pointer: PointerEvent) => {
      const updated = {
        ...original,
        x: Math.max(
          0.04,
          Math.min(
            0.96 - original.width,
            original.x + (pointer.clientX - startX) / rect.width,
          ),
        ),
        y: Math.max(
          0.74,
          Math.min(
            0.94 - original.height,
            original.y + (pointer.clientY - startY) / rect.height,
          ),
        ),
      };
      onBoxesChange(
        boxes.map((box, current) => (current === index ? updated : box)),
      );
    };
    const end = () => {
      element.removeEventListener("pointermove", update);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", end);
    };
    element.addEventListener("pointermove", update);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
  }
  return (
    <div className="pdf-preview">
      <div className="pdf-preview-toolbar">
        <Button
          variant="outline"
          size="icon"
          disabled={page <= 0 || !pdf}
          aria-label={t("Oldingi sahifa")}
          onClick={() => setPage((value) => value - 1)}
        >
          <ChevronLeft size={18} />
        </Button>
        <span>
          <LocalizedText>Sahifa</LocalizedText> {page + 1}{" "}
          <LocalizedText>/ </LocalizedText>
          {pdf?.numPages || "…"}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={!pdf || page >= pdf.numPages - 1}
          aria-label={t("Keyingi sahifa")}
          onClick={() => setPage((value) => value + 1)}
        >
          <ChevronRight size={18} />
        </Button>
        <div className="pdf-zoom-controls">
          <Button
            variant="outline"
            size="icon"
            disabled={zoom <= 1}
            aria-label={t("Kichraytirish")}
            onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
          >
            <ZoomOut size={17} />
          </Button>
          <span>{Math.round(zoom * 100)}%</span>
          <Button
            variant="outline"
            size="icon"
            disabled={zoom >= 3}
            aria-label={t("Kattalashtirish")}
            onClick={() => setZoom((value) => Math.min(3, value + 0.5))}
          >
            <ZoomIn size={17} />
          </Button>
        </div>
      </div>
      <div
        className="pdf-preview-surface"
        ref={container}
        tabIndex={0}
        role="region"
        aria-label={t("Kelishuv PDF sahifasi")}
      >
        {loading && (
          <span className="pdf-render-loading">
            <Loader2 className="spin" size={24} />
            <LocalizedText>PDF tayyorlanmoqda</LocalizedText>
          </span>
        )}
        {error && (
          <p className="form-error" role="alert">
            <LocalizedText>{error}</LocalizedText>
          </p>
        )}
        <div
          className="pdf-preview-page"
          style={{ width: `${width * zoom}px` }}
        >
          <canvas ref={canvas} aria-label={t("Kelishuv PDF sahifasi")} />
          {editable &&
            boxes.map(
              (box, index) =>
                box.page === page && (
                  <div
                    className="signature-box-overlay"
                    key={box.role}
                    style={{
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.width * 100}%`,
                      height: `${box.height * 100}%`,
                      touchAction: "none",
                    }}
                    onPointerDown={(event) => move(event, index)}
                  >
                    <span>
                      {box.role === "FIRST_PARTY"
                        ? t("Birinchi taraf")
                        : box.role === "SECOND_PARTY"
                          ? t("Ikkinchi taraf")
                          : t("Mediator")}
                    </span>
                  </div>
                ),
            )}
        </div>
      </div>
    </div>
  );
}
