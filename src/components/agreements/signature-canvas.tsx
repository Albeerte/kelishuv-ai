"use client";
import { T as LocalizedText, translate as localizeText } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import type SignaturePad from "signature_pad";
import type { PointGroup } from "signature_pad";
import { Eraser, Undo2, Check, X } from "lucide-react";
import { Button } from "../ui/button";

import type { SignatureCapture } from "@/lib/kelishuv-types";

export function SignatureCanvas({
  onSave,
  onCancel,
  disabled = false,
}: {
  onSave: (capture: SignatureCapture) => void;
  onCancel?: () => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let finish: (() => void) | undefined;
    let lastWidth = 0;
    let lastHeight = 0;
    async function setup() {
      const { default: Pad } = await import("signature_pad");
      if (disposed || !canvasRef.current || !containerRef.current) return;
      const canvas = canvasRef.current;
      const pad = new Pad(canvas, {
        minWidth: 0.8,
        maxWidth: 2.8,
        penColor: "#18334e",
        backgroundColor: "rgba(0,0,0,0)",
        minDistance: 1,
        throttle: 4,
      });
      padRef.current = pad;
      // Render captured pressure as width on the saved canvas. Point coordinates remain CSS pixels.
      const renderPressure = () => {
        const groups = pad.toData();
        const context = canvas.getContext("2d");
        if (!context) return;
        context.clearRect(0, 0, lastWidth, lastHeight);
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = "#18334e";
        context.fillStyle = "#18334e";
        for (const group of groups) {
          const points = group.points;
          if (points.length === 1) {
            context.beginPath();
            context.arc(points[0].x, points[0].y, 1.5, 0, Math.PI * 2);
            context.fill();
          }
          for (let index = 1; index < points.length; index++) {
            const from = points[index - 1];
            const to = points[index];
            context.lineWidth =
              0.8 + Math.max(0.15, Math.min(1, to.pressure || 0.4)) * 3.2;
            context.beginPath();
            context.moveTo(from.x, from.y);
            context.quadraticCurveTo(
              from.x,
              from.y,
              (from.x + to.x) / 2,
              (from.y + to.y) / 2,
            );
            context.lineTo(to.x, to.y);
            context.stroke();
          }
        }
      };
      finish = () => {
        renderPressure();
        setPreview(pad.isEmpty() ? "" : canvas.toDataURL("image/png"));
        setError("");
      };
      pad.addEventListener("endStroke", finish);
      const resize = () => {
        const width = Math.max(220, containerRef.current?.clientWidth || 600);
        const height = width < 500 ? 250 : 270;
        if (width === lastWidth && height === lastHeight) return;
        const groups: PointGroup[] = pad.toData().map((group) => ({
          ...group,
          points: group.points.map((point) => ({
            ...point,
            x: lastWidth ? (point.x * width) / lastWidth : point.x,
            y: lastHeight ? (point.y * height) / lastHeight : point.y,
          })),
        }));
        const ratio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.getContext("2d")!.setTransform(ratio, 0, 0, ratio, 0, 0);
        lastWidth = width;
        lastHeight = height;
        pad.clear();
        pad.fromData(groups);
        renderPressure();
      };
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(containerRef.current);
      setReady(true);
    }
    void setup().catch(() =>
      setError("Imzo maydonini ochib bo‘lmadi. Sahifani yangilang."),
    );
    return () => {
      disposed = true;
      observer?.disconnect();
      if (finish) padRef.current?.removeEventListener("endStroke", finish);
      padRef.current?.off();
      padRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (disabled) padRef.current?.off();
    else if (ready) padRef.current?.on();
  }, [disabled, ready]);
  function save() {
    const pad = padRef.current;
    const canvas = canvasRef.current;
    const groups = pad?.toData() || [];
    const count = groups.reduce((sum, group) => sum + group.points.length, 0);
    if (!pad || !canvas || pad.isEmpty() || count < 2) {
      setError(
        "Imzo maydoniga barmoq, qalam yoki sichqoncha bilan imzo chizing.",
      );
      return;
    }
    onSave({
      dataUrl: canvas.toDataURL("image/png"),
      strokeCount: groups.length,
      pointCount: count,
      width: canvas.width,
      height: canvas.height,
    });
  }
  return (
    <div className="signature-capture">
      <p className="signature-canvas-hint">
        <LocalizedText>
          Barmoq, stilus yoki sichqoncha bilan quyidagi maydonga imzo chizing.
        </LocalizedText>
      </p>
      <div className="signature-canvas-wrap" ref={containerRef}>
        <canvas
          className="signature-canvas"
          ref={canvasRef}
          aria-label={localizeText("Qo‘lda imzo chizish maydoni")}
          style={{ touchAction: "none" }}
        />
        <span className="signature-baseline" aria-hidden="true" />
      </div>
      <div className="signature-canvas-actions">
        <Button
          variant="outline"
          type="button"
          disabled={!ready || disabled}
          onClick={() => {
            padRef.current?.clear();
            setPreview("");
          }}
        >
          <Eraser size={16} />
          <LocalizedText>Tozalash</LocalizedText>
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={!ready || disabled}
          onClick={() => {
            const pad = padRef.current;
            if (!pad) return;
            const groups = pad.toData();
            groups.pop();
            pad.fromData(groups);
            setPreview(
              pad.isEmpty() ? "" : canvasRef.current!.toDataURL("image/png"),
            );
          }}
        >
          <Undo2 size={16} />
          <LocalizedText>Orqaga</LocalizedText>
        </Button>
      </div>
      {preview && (
        <div className="signature-preview">
          <span>
            <LocalizedText>Imzo ko‘rinishi</LocalizedText>
          </span>
          <img src={preview} alt={localizeText("Chizilgan imzo")} />
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          <LocalizedText>{error}</LocalizedText>
        </p>
      )}
      <div className="signature-canvas-actions">
        <Button type="button" disabled={!ready || disabled} onClick={save}>
          <Check size={16} />
          <LocalizedText>Imzoni saqlash</LocalizedText>
        </Button>
        {onCancel && (
          <Button
            variant="ghost"
            type="button"
            disabled={disabled}
            onClick={onCancel}
          >
            <X size={16} />
            <LocalizedText>Bekor qilish</LocalizedText>
          </Button>
        )}
      </div>
    </div>
  );
}
