import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useApp } from "@/context/AppContext";
import { Check } from "lucide-react";
import clsx from "clsx";

const STEPS = ["About you", "Lifestyle", "Health", "Menstrual health", "Goals", "Preferences", "Complete"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const { auth } = useApp();
  const nav = useNavigate();
  const isLast = step === STEPS.length - 1;

  async function finish() {
    await auth.completeOnboarding();
    nav("/app/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b border-[var(--w360-border)] px-6 py-4 flex items-center justify-between">
        <span className="font-display text-lg font-semibold">Women360</span>
        {!isLast && (
          <button onClick={finish} className="text-sm text-[var(--w360-text-muted)] hover:text-[var(--w360-text)]">
            Skip for now
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-lg">
          <ol className="flex items-center gap-2 mb-10" aria-label="Onboarding progress">
            {STEPS.slice(0, -1).map((s, i) => (
              <li key={s} className="flex-1">
                <div className={clsx("h-1.5 rounded-full", i <= step ? "bg-maroon-700 dark:bg-maroon-300" : "bg-warmgrey-100 dark:bg-white/10")} />
              </li>
            ))}
          </ol>

          <StepContent step={step} />

          {!isLast && (
            <div className="flex items-center justify-between mt-10">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
              <Button onClick={() => (step === STEPS.length - 2 ? setStep(STEPS.length - 1) : setStep((s) => s + 1))}>
                {step === STEPS.length - 2 ? "Finish" : "Continue"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepContent({ step }: { step: number }) {
  const nav = useNavigate();
  const { auth } = useApp();

  if (step === 0)
    return (
      <FormStep title="About you" subtitle="This helps us personalize your experience.">
        <Input label="Full name" placeholder="Your name" defaultValue={auth.user?.name} />
        <Input label="Date of birth" type="date" defaultValue={auth.user?.dateOfBirth} />
      </FormStep>
    );

  if (step === 1)
    return (
      <FormStep title="Lifestyle" subtitle="A quick sense of your day-to-day — all optional.">
        <ChoiceGroup label="How active are you most weeks?" options={["Mostly sedentary", "Lightly active", "Active", "Very active"]} />
        <ChoiceGroup label="How would you describe your sleep?" options={["Poor", "Fair", "Good", "Excellent"]} />
      </FormStep>
    );

  if (step === 2)
    return (
      <FormStep title="Health" subtitle="Baseline health information — you can update this anytime.">
        <Input label="Any known allergies?" placeholder="Optional" />
        <Input label="Current medications" placeholder="Optional" />
      </FormStep>
    );

  if (step === 3)
    return (
      <FormStep title="Menstrual health" subtitle="Skip if this doesn't apply to you.">
        <ChoiceGroup label="Where are you in your reproductive life?" options={["Regular cycles", "Perimenopause", "Menopause", "Prefer not to say"]} />
        <Input label="Typical cycle length (days)" type="number" placeholder="e.g. 28" />
      </FormStep>
    );

  if (step === 4)
    return (
      <FormStep title="Goals" subtitle="Pick what matters most right now — you can change these later.">
        <ChoiceGroup
          multi
          label="What would you like to focus on?"
          options={["Better sleep", "More activity", "Nutrition", "Cycle tracking", "Mental wellbeing", "Preventive care"]}
        />
      </FormStep>
    );

  if (step === 5)
    return (
      <FormStep title="Preferences" subtitle="You can change any of this later in Settings.">
        <ChoiceGroup label="How would you like Women360 to feel?" options={["Standard experience", "Senior Mode — simple & spacious"]} />
      </FormStep>
    );

  return (
    <div className="text-center py-8">
      <div className="w-14 h-14 rounded-full bg-maroon-700 text-white flex items-center justify-center mx-auto mb-5">
        <Check size={26} />
      </div>
      <h2 className="font-display text-2xl font-semibold">You're all set, {auth.user?.name?.split(" ")[0] ?? "there"}.</h2>
      <p className="text-[var(--w360-text-muted)] mt-2 max-w-sm mx-auto">
        Your dashboard is ready with a snapshot of your health, built around what you just told us.
      </p>
      <Button
        className="mt-6"
        onClick={async () => {
          await auth.completeOnboarding();
          nav("/app/dashboard");
        }}
      >
        Go to my dashboard
      </Button>
    </div>
  );
}

function FormStep({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {subtitle && <p className="text-[var(--w360-text-muted)] text-sm mt-1">{subtitle}</p>}
      <div className="flex flex-col gap-4 mt-6">{children}</div>
    </div>
  );
}

function ChoiceGroup({ label, options, multi }: { label: string; options: string[]; multi?: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  function toggle(opt: string) {
    if (multi) {
      setSelected((s) => (s.includes(opt) ? s.filter((x) => x !== opt) : [...s, opt]));
    } else {
      setSelected([opt]);
    }
  }
  return (
    <div>
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            type="button"
            key={opt}
            onClick={() => toggle(opt)}
            className={clsx(
              "px-3.5 py-2 rounded-full text-sm border transition-colors",
              selected.includes(opt)
                ? "bg-maroon-700 text-white border-maroon-700"
                : "border-[var(--w360-border)] hover:border-maroon-400"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
