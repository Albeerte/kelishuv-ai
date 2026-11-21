"use client";
import Link from "next/link";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { caseNextStep, caseStage } from "@/lib/case-journey";
import type { CaseRecord } from "@/lib/types";
import { useProfile } from "../application";
import { Button } from "../ui/button";
import { T, useI18n } from "@/lib/i18n";

export function CaseJourney({
  record,
  mediatorName,
}: {
  record: CaseRecord;
  mediatorName?: string;
}) {
  const { user } = useProfile();
  const { t } = useI18n();
  const stage = caseStage(record);
  const next = caseNextStep(record, user.id);
  const assigned = mediatorName ? (
    <p className="friendly-assigned">
      <T>Mediator</T> {mediatorName}
    </p>
  ) : null;
  return (
    <section className="friendly-journey">
      <ol aria-label={t("Ish jarayoni")}>
        {[
          "Murojaat qabul qilindi",
          "Taraflar ishtiroki",
          "Mediator bilan ishlash",
          "Kelishuv va ijro",
        ].map((label, index) => (
          <li
            key={label}
            className={index <= stage ? "reached" : ""}
            aria-current={index === stage ? "step" : undefined}
          >
            <span>{index < stage ? <Check size={16} /> : index + 1}</span>
            <T>{label}</T>
          </li>
        ))}
      </ol>
      {assigned}
      <div className="friendly-next-action">
        <span className="friendly-icon">
          <MessageCircle size={23} />
        </span>
        <div>
          <h2>
            <T>Keyingi qadam</T>
          </h2>
          <p>
            <T>{next.description}</T>
          </p>
        </div>
        <Button asChild>
          <Link href={next.href}>
            <T>{next.label}</T>
            <ArrowRight size={17} />
          </Link>
        </Button>
      </div>
    </section>
  );
}
