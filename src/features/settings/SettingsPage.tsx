import { useSearchParams } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const { auth, theme, senior } = useApp();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const [shareWithCoach, setShareWithCoach] = useState(true);
  const [emailReminders, setEmailReminders] = useState(true);

  function handleSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    toast.show("Profile saved");
  }

  function handleSaveEmergency(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    toast.show("Emergency contact saved");
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">Your profile, accessibility and privacy preferences.</p>
      </div>

      <Tabs
        defaultTab={params.get("tab") === "essentials" ? "essentials" : params.get("tab") === "emergency" ? "emergency" : "profile"}
        tabs={[
          {
            id: "profile", label: "Profile",
            content: (
              <Card><CardBody className="pt-5">
                <form className="flex flex-col gap-4" onSubmit={handleSaveProfile}>
                  <Input label="Full name" name="name" defaultValue={auth.user?.name ?? "Sarah Menon"} />
                  <Input label="Email" name="email" defaultValue={auth.user?.email ?? "sarah.menon@example.com"} type="email" />
                  <Input label="Date of birth" name="dob" type="date" defaultValue={auth.user?.dateOfBirth ?? "1969-04-12"} />
                  <div className="flex gap-2">
                    <Button size="sm" type="submit">Save changes</Button>
                    <Button size="sm" variant="danger" type="button" onClick={() => { auth.logout(); nav("/login"); }}>Log out</Button>
                  </div>
                </form>
              </CardBody></Card>
            ),
          },
          {
            id: "accessibility", label: "Accessibility",
            content: (
              <Card><CardBody className="pt-5 flex flex-col gap-5">
                <ToggleRow
                  title="Senior Mode"
                  description="A simplified, larger, single-purpose way to use Women360."
                  checked={senior.seniorMode}
                  onChange={senior.toggleSeniorMode}
                />
                <ToggleRow
                  title="Dark mode"
                  description="Easier on the eyes in low light — deliberately designed, not just inverted."
                  checked={theme.theme === "dark"}
                  onChange={theme.toggle}
                />
              </CardBody></Card>
            ),
          },
          {
            id: "essentials", label: "Customize essentials",
            content: (
              <Card><CardBody className="pt-5">
                <p className="text-sm text-[var(--w360-text-muted)] mb-4">Choose which functions appear on your Senior Mode home screen.</p>
                <div className="flex flex-col gap-1">
                  {senior.essentials.map((e) => (
                    <label key={e.key} className="flex items-center gap-3 py-2.5 border-b border-[var(--w360-border)] last:border-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={e.enabled}
                        onChange={() => senior.toggleEssential(e.key)}
                        className="w-5 h-5 accent-[#6B1D30]"
                      />
                      <span className="text-sm senior:text-lg">{e.label}</span>
                    </label>
                  ))}
                </div>
              </CardBody></Card>
            ),
          },
          {
            id: "emergency", label: "Emergency contact",
            content: (
              <Card><CardBody className="pt-5">
                <form className="flex flex-col gap-4" onSubmit={handleSaveEmergency}>
                  <Input label="Contact name" name="contactName" placeholder="e.g. Priya Menon (daughter)" />
                  <Input label="Phone number" name="contactPhone" placeholder="+91 98xxxxxxx" type="tel" />
                  <Button size="sm" type="submit" className="w-fit">Save emergency contact</Button>
                </form>
              </CardBody></Card>
            ),
          },
          {
            id: "privacy", label: "Privacy & sharing",
            content: (
              <Card><CardBody className="pt-5 flex flex-col gap-5">
                <ToggleRow
                  title="Share data with wellness coach"
                  description="Your coach can only see what you explicitly share."
                  checked={shareWithCoach}
                  onChange={() => {
                    setShareWithCoach((v) => !v);
                    toast.show(!shareWithCoach ? "Coach sharing enabled" : "Coach sharing turned off");
                  }}
                />
                <ToggleRow
                  title="Email reminders"
                  description="Preventive care and goal reminders by email."
                  checked={emailReminders}
                  onChange={() => {
                    setEmailReminders((v) => !v);
                    toast.show(!emailReminders ? "Email reminders enabled" : "Email reminders turned off");
                  }}
                />
              </CardBody></Card>
            ),
          },
        ]}
      />
    </div>
  );
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-[var(--w360-text-muted)] mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${checked ? "bg-maroon-700" : "bg-warmgrey-300 dark:bg-white/15"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
