import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NumberField } from "@/components/ui/NumberField";
import { MultiSelect, NONE } from "@/components/ui/MultiSelect";
import { FlowStepper, Step } from "@/components/ui/FlowStepper";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/components/ui/Toast";
import { userService, type HealthProfileInput } from "@/services/userService";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Check } from "lucide-react";
import clsx from "clsx";

const STEP_COUNT = 6;

const ALLERGY_OPTIONS = [
  "Penicillin",
  "Sulfa drugs",
  "Aspirin or NSAIDs",
  "Latex",
  "Peanuts",
  "Tree nuts",
  "Shellfish",
  "Eggs",
  "Milk or dairy",
  "Gluten or wheat",
  "Soy",
  "Pollen or hay fever",
  "Dust mites",
  "Pet dander",
  "Insect stings",
];

// Categories rather than brand names: easy to recognise, and enough to flag
// things worth knowing about. Doses and reminders are set up later, under
// Health → My medicines.
const MEDICATION_OPTIONS = [
  "Hormonal contraception",
  "Hormone replacement therapy",
  "Thyroid medication",
  "Blood pressure medication",
  "Cholesterol medication",
  "Diabetes medication",
  "Antidepressant or anxiety medication",
  "Pain relief (e.g. paracetamol, ibuprofen)",
  "Antihistamines",
  "Asthma inhaler",
  "Blood thinners",
  "Iron, folate or vitamin supplements",
];

export default function OnboardingPage() {
  usePageTitle("Set up your profile");
  const { auth } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function finish() {
    try {
      await auth.completeOnboarding();
      nav("/app/dashboard");
    } catch {
      toast.show("Couldn't save that — please try again.");
    }
  }

  // Only what was answered is saved. "None" is an answer (an empty list); a
  // question left alone stays unanswered, so the profile never claims "no
  // allergies" for someone who simply skipped the question.
  async function saveHealth() {
    const input: HealthProfileInput = {};
    if (allergies.length) input.allergies = allergies.filter((v) => v !== NONE);
    if (medications.length) input.currentMedications = medications.filter((v) => v !== NONE);
    if (Object.keys(input).length) await userService.updateHealthProfile(input);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b border-[var(--w360-border)] px-6 py-4 flex items-center justify-between">
        <span className="font-display text-lg font-semibold">Women360</span>
        {step <= STEP_COUNT && (
          <button onClick={finish} className="text-sm text-[var(--w360-text-muted)] hover:text-[var(--w360-text)]">
            Skip for now
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center px-4 sm:px-6 py-10">
        <FlowStepper
          step={step}
          onStepChange={setStep}
          width={560}
          nextButtonText="Continue"
          completeButtonText="Finish"
          nextButtonProps={{
            disabled: saving,
            onClick: async (event) => {
              if (step !== STEP_COUNT) return;
              // Last step: save what was answered, and only move on once it's saved.
              event.preventDefault();
              setSaving(true);
              try {
                await saveHealth();
                setStep(STEP_COUNT + 1);
              } catch (err) {
                toast.show(err instanceof Error ? err.message : "Couldn't save your health details. Please try again.", { tone: "error" });
              } finally {
                setSaving(false);
              }
            },
          }}
          completedContent={
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-maroon-700 text-white dark:bg-maroon-300 dark:text-ink-900 flex items-center justify-center mx-auto mb-5">
                <Check size={26} />
              </div>
              <h2 className="font-display text-2xl font-semibold">You're all set, {auth.user?.name?.split(" ")[0] ?? "there"}.</h2>
              <p className="text-[var(--w360-text-muted)] mt-2 max-w-sm mx-auto">
                Your dashboard is ready with a snapshot of your health, built around what you just told us.
              </p>
              <Button className="mt-6" onClick={finish}>Go to my dashboard</Button>
            </div>
          }
        >
          <Step title="About you">
            <FormStep title="About you" subtitle="This helps us personalize your experience.">
              <Input label="Full name" placeholder="Your name" defaultValue={auth.user?.name} />
              <Input label="Date of birth" type="date" defaultValue={auth.user?.dateOfBirth ?? undefined} />
            </FormStep>
          </Step>

          <Step title="Lifestyle">
            <FormStep title="Lifestyle" subtitle="A quick sense of your day-to-day — all optional.">
              <ChoiceGroup label="How active are you most weeks?" options={["Mostly sedentary", "Lightly active", "Active", "Very active"]} />
              <ChoiceGroup label="How would you describe your sleep?" options={["Poor", "Fair", "Good", "Excellent"]} />
            </FormStep>
          </Step>

          <Step title="Health">
            <FormStep title="Health" subtitle="Baseline health information — you can update this anytime.">
              <MultiSelect
                label="Any known allergies?"
                options={ALLERGY_OPTIONS}
                value={allergies}
                onChange={setAllergies}
                customPlaceholder="Another allergy"
              />
              <MultiSelect
                label="Current medications"
                options={MEDICATION_OPTIONS}
                value={medications}
                onChange={setMedications}
                customPlaceholder="Another medicine"
                hint="Saved to your health profile. You'll set doses and reminders later, under Health."
              />
            </FormStep>
          </Step>

          <Step title="Cycle">
            <FormStep title="Menstrual health" subtitle="Skip if this doesn't apply to you.">
              <ChoiceGroup label="Where are you in your reproductive life?" options={["Regular cycles", "Perimenopause", "Menopause", "Prefer not to say"]} />
              <CycleLengthField />
            </FormStep>
          </Step>

          <Step title="Goals">
            <FormStep title="Goals" subtitle="Pick what matters most right now — you can change these later.">
              <ChoiceGroup
                multi
                label="What would you like to focus on?"
                options={["Better sleep", "More activity", "Nutrition", "Cycle tracking", "Mental wellbeing", "Preventive care"]}
              />
            </FormStep>
          </Step>

          <Step title="Preferences">
            <FormStep title="Preferences" subtitle="You can change any of this later in Settings.">
              <ChoiceGroup label="How would you like Women360 to feel?" options={["Standard experience", "Senior Mode — simple & spacious"]} />
            </FormStep>
          </Step>
        </FlowStepper>
      </div>
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
            aria-pressed={selected.includes(opt)}
            className={clsx(
              "px-3.5 py-2 rounded-full text-sm border transition-colors",
              selected.includes(opt)
                ? "bg-maroon-700 text-white border-maroon-700 dark:bg-maroon-300 dark:text-ink-900 dark:border-maroon-300"
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

function CycleLengthField() {
  const [value, setValue] = useState("");
  return <NumberField label="Cycle length" suffix="days" optional min={15} max={90} startAt={28} value={value} onChange={setValue} hint="Your typical cycle, if you know it." />;
}
