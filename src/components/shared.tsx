"use client";
import { T as LocalizedText, translate as localizeText } from "@/lib/i18n";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { useUI } from "@/lib/client-store";
import {
  STATUS_LABELS,
  TYPE_LABELS,
  type CaseRecord,
  type CaseStatus,
} from "@/lib/types";
import { fullDate, money } from "@/lib/utils";
import { translate, useI18n } from "@/lib/i18n";
export function Brand({
  compact = false,
  href = "/",
}: {
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link className={`brand${compact ? " brand-compact" : ""}`} href={href}>
      <span className="brand-visual">
        <Image
          src="/images/kelishuv-logo.png"
          alt="Kelishuv"
          width={1774}
          height={887}
          sizes={compact ? "160px" : "(max-width: 700px) 200px, 320px"}
          quality={90}
        />
      </span>
    </Link>
  );
}
export function StatusBadge({ status }: { status: CaseStatus }) {
  useI18n();
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <span />
      {translate(STATUS_LABELS[status])}
    </span>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>
          <LocalizedText>{title}</LocalizedText>
        </h1>
        {description && (
          <p>
            <LocalizedText>{description}</LocalizedText>
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
export function Loading({
  label = "Ma’lumotlar yuklanmoqda",
}: {
  label?: string;
}) {
  return (
    <div className="loading-state">
      <Loader2 size={25} className="spin" />
      <span>
        <LocalizedText>{label}</LocalizedText>
      </span>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="empty-state">
      <AlertCircle size={32} />
      <h3>
        <LocalizedText>Ma’lumotlarni ochib bo‘lmadi</LocalizedText>
      </h3>
      <p>
        <LocalizedText>{message}</LocalizedText>
      </p>
      {retry && (
        <Button onClick={retry}>
          <LocalizedText>Qayta urinish</LocalizedText>
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <FileText size={28} />
      </div>
      <h3>
        <LocalizedText>{title}</LocalizedText>
      </h3>
      <p>
        <LocalizedText>{description}</LocalizedText>
      </p>
      {children}
    </div>
  );
}
export function CaseTable({
  cases,
  compact = false,
}: {
  cases: CaseRecord[];
  compact?: boolean;
}) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label={localizeText("Ishlar jadvali")}
      tabIndex={0}
    >
      <table className={`case-table ${compact ? "compact" : ""}`}>
        <thead>
          <tr>
            <th>
              <LocalizedText>Nizo</LocalizedText>
            </th>
            <th>
              <LocalizedText>Holati</LocalizedText>
            </th>
            {!compact && (
              <th>
                <LocalizedText>Talab miqdori</LocalizedText>
              </th>
            )}
            <th>
              <LocalizedText>Sana</LocalizedText>
            </th>
            <th>
              <span className="sr-only">
                <LocalizedText>Batafsil</LocalizedText>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cases.map((record) => (
            <tr key={record.id}>
              <td>
                <Link
                  href={`/dashboard/cases/${record.id}${record.journeyVersion === 3 ? "/workbench" : ""}`}
                  className="case-cell"
                >
                  <span
                    className={`case-type-icon type-${record.type.toLowerCase()}`}
                  >
                    <FileText size={19} />
                  </span>
                  <span>
                    <strong>{record.title}</strong>
                    <small>
                      {record.number}
                      <i />
                      <LocalizedText>{TYPE_LABELS[record.type]}</LocalizedText>
                    </small>
                  </span>
                </Link>
              </td>
              <td>
                <StatusBadge status={record.status} />
              </td>
              {!compact && (
                <td className="amount-cell">
                  {money(record.claimAmount)}{" "}
                  <small>
                    <LocalizedText>so‘m</LocalizedText>
                  </small>
                </td>
              )}
              <td className="date-cell">{fullDate(record.createdAt)}</td>
              <td>
                <Link
                  className="table-next"
                  href={`/dashboard/cases/${record.id}${record.journeyVersion === 3 ? "/workbench" : ""}`}
                  aria-label={`${record.title} tafsilotlari`}
                >
                  <ChevronRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Toasts() {
  const { toasts, removeToast } = useUI();
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`}>
          {toast.kind === "error" ? (
            <AlertCircle size={19} />
          ) : (
            <CheckCircle2 size={19} />
          )}
          <span>
            <LocalizedText>{toast.message}</LocalizedText>
          </span>
          <button
            onClick={() => removeToast(toast.id)}
            aria-label={localizeText("Xabarni yopish")}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
