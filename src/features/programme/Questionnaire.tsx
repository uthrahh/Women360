import { useState } from "react";
import type { Answers, AssessmentKind, Question } from "@/types/programme";
import { ChoiceRow, MultiChoiceRow } from "@/components/ui/ChoiceRow";
import { NumberField } from "@/components/ui/NumberField";
import { TextArea } from "@/components/ui/TextArea";
import { Button } from "@/components/ui/Button";

const SECTION: Record<Question["section"], string> = { goals: "What you'd like", routine: "Your usual week", you: "About you" };

/**
 * The questions at the start (BASELINE) and the end (FINAL) of a programme. Nothing is filled in for her; she can save
 * what she has and come back. Sending checks the required ones here first so a round trip isn't spent on a missed answer.
 */
export function Questionnaire({
  kind,
  questions,
  initial,
  onSave,
}: {
  kind: AssessmentKind;
  questions: Question[];
  initial: Answers;
  onSave: (answers: Answers, submit: boolean) => Promise<string | null>;
}) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [error, setError] = useState("");

  const set = (id: string, v: Answers[string] | null) =>
    setAnswers((a) => {
      const next = { ...a };
      if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) delete next[id];
      else next[id] = v;
      return next;
    });

  async function save(submit: boolean) {
    setError("");
    if (submit) {
      const gaps = questions.filter((q) => q.required && answers[q.id] === undefined).map((q) => q.id);
      setMissing(new Set(gaps));
      if (gaps.length > 0) {
        setError(`${gaps.length === 1 ? "One question needs" : `${gaps.length} questions need`} an answer before you send.`);
        document.getElementById(`q-${gaps[0]}`)?.scrollIntoView({ block: "center" });
        return;
      }
    }
    setBusy(submit ? "submit" : "draft");
    const problem = await onSave(answers, submit);
    setBusy(null);
    if (problem) setError(problem);
  }

  const sections = (["goals", "routine", "you"] as const).filter((s) => questions.some((q) => q.section === s));
  const need = (q: Question) => (missing.has(q.id) && answers[q.id] === undefined ? "Please answer this." : undefined);

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        void save(true);
      }}
    >
      {sections.map((s) => (
        <fieldset key={s} className="flex flex-col gap-6 min-w-0">
          <legend className="font-display text-lg font-semibold mb-4">{SECTION[s]}</legend>
          {questions
            .filter((q) => q.section === s)
            .map((q) => (
              <div key={q.id} id={`q-${q.id}`}>
                <QuestionField q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} error={need(q)} />
              </div>
            ))}
        </fieldset>
      ))}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy !== null}>
          {busy === "submit" ? "Sending…" : kind === "BASELINE" ? "Send to my coach" : "Send my final answers"}
        </Button>
        <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void save(false)}>
          {busy === "draft" ? "Saving…" : "Save and finish later"}
        </Button>
      </div>
    </form>
  );
}

function QuestionField({ q, value, onChange, error }: { q: Question; value: Answers[string] | undefined; onChange: (v: Answers[string] | null) => void; error?: string }) {
  switch (q.type) {
    case "multi":
      return (
        <MultiChoiceRow
          label={q.label}
          choices={q.options}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          max={q.maxPick}
          error={error}
        />
      );
    case "choice":
      return <ChoiceRow label={q.label} choices={q.options} value={typeof value === "string" ? value : null} onChange={onChange} optional={!q.required} error={error} />;
    case "scale":
      return (
        <ChoiceRow
          label={q.label}
          note={`1 is ${q.lowLabel.toLowerCase()}, 5 is ${q.highLabel.toLowerCase()}.`}
          choices={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
          value={typeof value === "number" ? value : null}
          onChange={onChange}
          optional={!q.required}
          error={error}
        />
      );
    case "number":
      return (
        <div className="flex flex-col gap-1.5 max-w-xs">
          <p className="text-sm font-medium senior:text-lg">{q.label}</p>
          <NumberField
            label={q.unit ? q.unit[0].toUpperCase() + q.unit.slice(1) : "Number"}
            min={q.min}
            max={q.max}
            value={value === undefined ? "" : String(value)}
            onChange={(v) => onChange(v === "" ? null : Number(v))}
            optional
            error={error}
          />
        </div>
      );
    case "text":
      return (
        <TextArea
          label={q.label}
          optional={!q.required}
          maxLength={q.maxLength}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      );
  }
}
