"use client";

import { useTranslations } from "next-intl";
import type { EvaluationQuestion } from "@/lib/evaluation-engine";

export function QuestionWizard({
  questions,
  currentIndex,
  loading,
  onAnswer,
  answers = [],
}: {
  questions: EvaluationQuestion[];
  currentIndex: number;
  loading: boolean;
  onAnswer: (value: string) => void;
  answers?: { questionId: string; value: string }[];
}) {
  const t = useTranslations();

  if (loading) {
    return (
      <p className="text-slate-400">{t("evaluation.loadingProgram")}</p>
    );
  }

  if (questions.length === 0) return null;

  const currentQ = questions[currentIndex];

  // Count visible questions (exclude those whose showIf condition is not met)
  const answerMap = new Map(answers.map((a) => [a.questionId, a.value]));
  const visibleCount = questions.filter((q) => {
    if (!q.showIf) return true;
    return answerMap.get(q.showIf.questionId) === q.showIf.value;
  }).length;
  const visibleIndex = questions.slice(0, currentIndex + 1).filter((q) => {
    if (!q.showIf) return true;
    return answerMap.get(q.showIf.questionId) === q.showIf.value;
  }).length;

  return (
    <div>
      <div className="mt-4">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {t("evaluation.questionOf", {
              current: visibleIndex,
              total: visibleCount,
            })}
          </span>
          <div className="h-1.5 flex-1 mx-4 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{
                width: `${(visibleIndex / visibleCount) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-8">
          <h3 className="text-xl font-semibold text-white mb-8">
            {currentQ.text}
          </h3>

          {currentQ.type === "yes_no" ? (
            <div className="flex gap-4">
              <button
                onClick={() => onAnswer("yes")}
                className="flex-1 rounded-xl border-2 border-green-500/30 bg-green-500/10 px-6 py-4 text-lg font-semibold text-green-400 transition hover:bg-green-500/20 hover:border-green-500/50"
              >
                {t("evaluation.yes")}
              </button>
              <button
                onClick={() => onAnswer("no")}
                className="flex-1 rounded-xl border-2 border-red-500/30 bg-red-500/10 px-6 py-4 text-lg font-semibold text-red-400 transition hover:bg-red-500/20 hover:border-red-500/50"
              >
                {t("evaluation.no")}
              </button>
            </div>
          ) : currentQ.options && currentQ.options.length > 6 ? (
            <select
              className="w-full rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-base text-white appearance-none cursor-pointer"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) onAnswer(e.target.value);
              }}
            >
              <option value="" disabled className="bg-slate-800 text-white">
                {t("evaluation.selectOption")}
              </option>
              {currentQ.options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-800 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-3">
              {currentQ.options?.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onAnswer(opt.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-right text-base font-medium text-white transition hover:border-blue-500/50 hover:bg-white/10"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
