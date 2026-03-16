"use client";

import { useState, useRef, useEffect } from "react";
import { RULE_TYPE_LABELS } from "./shared";

interface RuleGroup {
  label: string;
  types: string[];
}

function getRuleGroups(certSlug: string | null): RuleGroup[] {
  const groups: RuleGroup[] = [];

  // Basic requirements — show per cert type
  const basicTypes: string[] = [];
  if (!certSlug || certSlug === "arabic" || certSlug === "american") {
    basicTypes.push("high_school", "twelve_years");
  }
  basicTypes.push("bachelor");
  if (basicTypes.length > 0) {
    groups.push({ label: "شروط أساسية", types: basicTypes });
  }

  // Certs and scores
  const certTypes: string[] = ["language_cert", "sat"];
  if (!certSlug || certSlug === "arabic" || certSlug === "american") {
    certTypes.push("gpa");
  }
  groups.push({ label: "شهادات ومعدلات", types: certTypes });

  // British qualifications
  if (!certSlug || certSlug === "british") {
    groups.push({
      label: "شروط الشهادة البريطانية",
      types: ["a_levels", "as_levels", "o_levels"],
    });
  }

  // Additional requirements
  groups.push({
    label: "شروط إضافية",
    types: ["entrance_exam", "portfolio", "research_plan"],
  });

  // Custom questions
  groups.push({
    label: "أسئلة مخصصة",
    types: ["custom_yes_no", "custom_select"],
  });

  return groups;
}

interface AddRuleMenuProps {
  certSlug: string | null;
  existingRuleTypes: string[];
  onAdd: (ruleType: string) => void;
}

export default function AddRuleMenu({ certSlug, existingRuleTypes, onAdd }: AddRuleMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const groups = getRuleGroups(certSlug);

  // For non-custom rules, check if already added (only one of each type allowed, except customs)
  const isCustomType = (type: string) => type.startsWith("custom_");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-lg bg-blue-600/20 px-4 py-2 text-sm font-medium text-blue-400 transition hover:bg-blue-600/30 border border-blue-500/20"
      >
        + إضافة شرط
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 rounded-xl border border-white/10 bg-[#0f1c2e] shadow-2xl overflow-hidden">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-white/[0.02]">
                {group.label}
              </div>
              {group.types.map((type) => {
                const alreadyExists = !isCustomType(type) && existingRuleTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={alreadyExists}
                    onClick={() => {
                      onAdd(type);
                      setOpen(false);
                    }}
                    className={`w-full text-right px-4 py-2.5 text-sm transition ${
                      alreadyExists
                        ? "text-slate-600 cursor-not-allowed"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {RULE_TYPE_LABELS[type] || type}
                    {alreadyExists && (
                      <span className="mr-2 text-[10px] text-slate-600">(مضاف)</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
