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
import { cycleService } from "@/services/cycleService";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Check } from "lucide-react";
import clsx from "clsx";

const STEP_COUNT = 4;

// What she picks for "where are you in your reproductive life?", as the stored life stage.
type LifeStageValue = "REPRODUCTIVE" | "PERIMENOPAUSE" | "MENOPAUSE" | "POSTMENOPAUSE";
const LIFE_STAGE: Record<string, LifeStageValue> = {
  "Regular cycles": "REPRODUCTIVE",
  "Perimenopause": "PERIMENOPAUSE",
  "Menopause": "MENOPAUSE",
  "Postmenopause": "POSTMENOPAUSE",
};

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
  const { auth, senior } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(auth.user?.name ?? "");
  const [dob, setDob] = useState(auth.user?.dateOfBirth ?? "");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [lifeStage, setLifeStage] = useState<string>("");
  const [cycleLength, setCycleLength] = useState("");
  const [periodLength, setPeriodLength] = useState("");
  const [feel, setFeel] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function finish() {
    try {
      await auth.completeOnboarding();
      nav("/app/dashboard");
    } catch {
      toast.show("Couldn't save that. Please try again.", { tone: "error" });
    }
  }

  // Everything asked here is saved. Only what was answered is sent: "None" is an
  // answer (an empty list); a question left alone stays unanswered, so the
  // profile never claims "no allergies" for someone who skipped the question.
  async function saveAll() {
    const profile: { name?: string; dateOfBirth?: string; lifeStage?: LifeStageValue } = {};
    if (name.trim() && name.trim() !== auth.user?.name) profile.name = name.trim();
    if (dob && dob !== auth.user?.dateOfBirth) profile.dateOfBirth = dob;
    if (lifeStage && LIFE_STAGE[lifeStage]) profile.lifeStage = LIFE_STAGE[lifeStage];
    if (Object.keys(profile).length) auth.refreshUser(await userService.updateProfile(profile));

    const health: HealthProfileInput = {};
    if (allergies.length) health.allergies = allergies.filter((v) => v !== NONE);
    if (medications.length) health.currentMedications = medications.filter((v) => v !== NONE);
    if (Object.keys(health).length) await userService.updateHealthProfile(health);

    // The cycle profile always holds both numbers, so one that was left blank keeps its current value.
    if (cycleLength || periodLength) {
      const current = await cycleService.getProfile();
      await cycleService.upsertProfile({
        averageCycleLength: cycleLength ? Number(cycleLength) : current.averageCycleLength,
        averagePeriodLength: periodLength ? Number(periodLength) : current.averagePeriodLength,
      });
    }

    if (feel.startsWith("Senior")) senior.setSeniorMode(true);
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
                await saveAll();
                setStep(STEP_COUNT + 1);
              } catch (err) {
                toast.show(err instanceof Error ? err.message : "Couldn't save your details. Please try again.", { tone: "error" });
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
                What you told us is saved. You can change any of it later in Settings and Health.
              </p>
              <Button className="mt-6" onClick={finish}>Go to my dashboard</Button>
            </div>
          }
        >
          <Step title="About you">
            <FormStep title="About you" subtitle="This helps us show what applies to you, such as which check-ups are due at your age.">
              <Input label="Full name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              <Input label="Date of birth" type="date" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} />
            </FormStep>
          </Step>

          <Step title="Health">
            <FormStep title="Health" subtitle="Baseline health information. You can update this anytime.">
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
              <ChoiceGroup
                label="Where are you in your reproductive life?"
                options={Object.keys(LIFE_STAGE).concat("Prefer not to say")}
                value={lifeStage}
                onChange={setLifeStage}
              />
              <div className="grid grid-cols-2 gap-3 items-start">
                <NumberField label="Cycle length" suffix="days" optional min={15} max={90} startAt={28} value={cycleLength} onChange={setCycleLength} hint="Your typical cycle, if you know it." />
                <NumberField label="Period length" suffix="days" optional min={1} max={15} startAt={5} value={periodLength} onChange={setPeriodLength} hint="How long it usually lasts." />
              </div>
            </FormStep>
          </Step>

          <Step title="Preferences">
            <FormStep title="Preferences" subtitle="You can change this later in Settings.">
              <ChoiceGroup
                label="How would you like Women360 to feel?"
                options={["Standard experience", "Senior Mode: simple and spacious"]}
                value={feel}
                onChange={setFeel}
              />
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

/** One choice from a short list. Choosing the selected one again clears it, so a question can go back to unanswered. */
function ChoiceGroup({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="group" aria-label={label}>
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            type="button"
            key={opt}
            onClick={() => onChange(value === opt ? "" : opt)}
            aria-pressed={value === opt}
            className={clsx(
              "px-3.5 py-2 rounded-full text-sm border transition-colors",
              value === opt
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
