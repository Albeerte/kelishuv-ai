"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useProfile } from "./application";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { T, useI18n } from "@/lib/i18n";
import { useData } from "@/lib/use-data";
import { useUI } from "@/lib/client-store";
import { api } from "@/lib/utils";
import type { CaseRecord } from "@/lib/types";

export function CaseClosureControls({ record, compact = false }: { record: CaseRecord; compact?: boolean }) {
  const { user } = useProfile();
  const { t } = useI18n();
  const { refresh } = useUI();
  const party =
    user.id === record.userId || user.id === record.mediation?.respondentId;
  const state = useData<{
    closure: CaseRecord["closure"] | null;
    status: CaseRecord["status"];
  }>(party ? `/api/cases/${record.id}/closure` : null);
  const closure = state.data?.closure || record.closure;
  const [kind, setKind] = useState<"WITHDRAWN" | "SETTLED_EXTERNALLY" | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef("");
  const refreshed = useRef("");
  const closed = ["CLOSED", "RESOLVED", "ESCALATED"].includes(
    state.data?.status || record.status,
  );
  useEffect(() => {
    if (!party || closed) return;
    const timer = setInterval(() => {
      if (!document.hidden) state.reload();
    }, 5000);
    return () => clearInterval(timer);
  }, [party, closed, state.reload]);
  useEffect(() => {
    if (
      closure?.status === "CLOSED" &&
      record.status !== "CLOSED" &&
      refreshed.current !== closure.id
    ) {
      refreshed.current = closure.id;
      refresh();
    }
  }, [closure, record.status, refresh]);
  async function submit(values: object) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/cases/${record.id}/closure`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      setKind(null);
      state.reload();
      refresh();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!party) return null;
  const actions = (
    <div className="closure-actions">
      <Button
        variant="outline"
        onClick={() => {
          setKind("SETTLED_EXTERNALLY");
          setReason("");
          requestId.current = "";
        }}
      >
        <CheckCircle2 size={18} />
        <T>O‘zaro kelishib oldik</T>
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          setKind("WITHDRAWN");
          setReason("");
          requestId.current = "";
        }}
      >
        <XCircle size={18} />
        <T>Murojaatni qaytarib olish</T>
      </Button>
    </div>
  );
  return (
    <section className="case-closure-controls">
      {closure?.status === "CLOSED" ? (
        <div className="success-note" role="status">
          <CheckCircle2 size={22} />
          <div>
            <strong>
              <T>Nizo yopilgan</T>
            </strong>
            <p>{closure.reason}</p>
          </div>
        </div>
      ) : closure?.status === "PENDING" ? (
        <div className="panel service-panel">
          <h2>
            <T>Mustaqil kelishuv bo‘yicha yopish so‘rovi</T>
          </h2>
          <p>{closure.reason}</p>
          <p>
            <T>Nizo yopilishi uchun ikkala tarafning tasdig‘i kerak.</T>
          </p>
          <div className="closure-actions">
            {!closure.confirmations.includes(user.id) && (
              <Button
                disabled={busy}
                onClick={() =>
                  submit({
                    action: "RESPOND",
                    requestId: closure.id,
                    accept: true,
                  })
                }
              >
                <T>Kelishdik, nizoni yopish</T>
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                submit({
                  action: "RESPOND",
                  requestId: closure.id,
                  accept: false,
                })
              }
            >
              <T>Yopish so‘rovini bekor qilish</T>
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setKind("WITHDRAWN");
                setReason("");
                requestId.current = "";
              }}
            >
              <T>Murojaatni qaytarib olish</T>
            </Button>
          </div>
        </div>
      ) : (
        !closed && (
          compact ? (
            <details className="workbench-closure-options">
              <summary><T>Nizoni yakunlash</T></summary>
              {actions}
            </details>
          ) : actions
        )
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Dialog
        open={Boolean(kind)}
        onOpenChange={(open) => {
          if (!open && !busy) setKind(null);
        }}
        title={t(
          kind === "WITHDRAWN"
            ? "Murojaatni qaytarib olish"
            : "O‘zaro kelishib oldik",
        )}
      >
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            requestId.current ||= crypto.randomUUID();
            submit({
              action: "REQUEST",
              requestId: requestId.current,
              kind,
              reason,
            });
          }}
        >
          <p>
            <T>
              {kind === "WITHDRAWN"
                ? "Ishtirokingiz yakunlanadi, mediatorlar navbatidagi nizo yopiladi. Izoh jarayon tarixida qayd etiladi."
                : "Qarshi taraf qo‘shilgan bo‘lsa, u ham kelishganini tasdiqlagach nizo yopiladi."}
            </T>
          </p>
          <label>
            <T>Qisqa izoh</T>
            <textarea
              required
              minLength={3}
              maxLength={1000}
              rows={3}
              value={reason}
              disabled={busy}
              onChange={(event) => {
                setReason(event.target.value);
                requestId.current = "";
              }}
            />
          </label>
          <Button disabled={busy} type="submit">
            <T>
              {kind === "WITHDRAWN"
                ? "Qaytarib olishni tasdiqlash"
                : "Yopish so‘rovini yuborish"}
            </T>
          </Button>
        </form>
      </Dialog>
    </section>
  );
}
