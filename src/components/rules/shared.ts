// Shared types and constants for the rule editor system

export interface RuleEditorProps {
  config: Record<string, unknown>;
  effect: string;
  effectMessage: string | null;
  onChange: (config: Record<string, unknown>) => void;
  onEffectChange: (effect: string) => void;
  onEffectMessageChange: (message: string | null) => void;
}

export const RULE_TYPE_LABELS: Record<string, string> = {
  high_school: "شهادة ثانوية",
  twelve_years: "12 سنة دراسة",
  bachelor: "شهادة بكالوريوس",
  language_cert: "شهادة لغة",
  sat: "SAT",
  gpa: "المعدل",
  a_levels: "A Levels",
  as_levels: "AS Levels",
  o_levels: "O Levels / GCSE",
  entrance_exam: "امتحان قبول",
  portfolio: "بورتفوليو",
  research_plan: "خطة بحث",
  custom_yes_no: "سؤال نعم/لا",
  custom_select: "سؤال اختيار من قائمة",
};

export const EFFECT_LABELS: Record<string, string> = {
  blocks_admission: "يمنع القبول",
  makes_conditional: "مشروط",
  scholarship: "منحة",
  info_only: "معلومات فقط",
  none: "بدون تأثير",
};

export const EFFECT_COLORS: Record<string, string> = {
  blocks_admission: "bg-red-500/15 text-red-400",
  makes_conditional: "bg-yellow-500/15 text-yellow-400",
  scholarship: "bg-green-500/15 text-green-400",
  info_only: "bg-blue-500/15 text-blue-400",
  none: "bg-slate-500/15 text-slate-400",
};
