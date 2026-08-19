import type {
  User, CycleSummary, CycleDay, NutritionSummary, ActivitySummary,
  SleepSummary, WellbeingEntry, Goal, Appointment, Medication,
  Message, LearnArticle, VitalMeasurement, ReportRecord, SeniorEssential,
} from "@/types";

export const mockUser: User = {
  id: "u_1001",
  name: "Sarah Menon",
  email: "sarah.menon@example.com",
  role: "woman",
  dateOfBirth: "1969-04-12",
  avatarInitials: "SM",
  lifeStage: "perimenopause",
  onboarded: true,
};

function lastNDays(n: number): CycleDay[] {
  const days: CycleDay[] = [];
  const today = new Date();
  for (let i = n; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayInCycle = ((28 - (i % 28)) % 28) + 1;
    days.push({
      date: d.toISOString().slice(0, 10),
      isPeriod: dayInCycle <= 5,
      flow: dayInCycle <= 5 ? (dayInCycle <= 2 ? "medium" : "light") : undefined,
      pain: dayInCycle <= 3 ? 2 : 0,
      energy: dayInCycle > 14 && dayInCycle < 20 ? 4 : 2,
      mood: dayInCycle <= 5 ? "Low" : dayInCycle > 12 && dayInCycle < 17 ? "Great" : "Okay",
      symptoms: dayInCycle <= 3 ? ["Cramps", "Fatigue"] : [],
    });
  }
  return days;
}

export const mockCycle: CycleSummary = {
  currentDay: 21,
  phase: "luteal",
  cycleLength: 29,
  periodLength: 5,
  nextPeriodDate: addDays(8),
  lastCycleLengths: [28, 30, 27, 29, 29],
  history: lastNDays(90),
};

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export const mockNutrition: NutritionSummary = {
  date: new Date().toISOString().slice(0, 10),
  hydrationMl: 1350,
  hydrationGoalMl: 2200,
  proteinG: 48,
  proteinGoalG: 70,
  fibreG: 18,
  fibreGoalG: 28,
  fruitVeg: 3,
  fruitVegGoal: 5,
  meals: [
    { id: "m1", time: "7:40 AM", name: "Oats with berries & almonds", calories: 340, protein: 12, fibre: 7, servings: "1 bowl" },
    { id: "m2", time: "12:30 PM", name: "Grilled chicken salad", calories: 420, protein: 32, fibre: 6, servings: "1 plate" },
    { id: "m3", time: "4:00 PM", name: "Greek yoghurt", calories: 140, protein: 14, fibre: 0, servings: "150g" },
  ],
};

export const mockActivity: ActivitySummary = {
  steps: 6240,
  stepsGoal: 8000,
  activeMinutes: 32,
  activeMinutesGoal: 45,
  weeklyMinutes: [
    { day: "Mon", minutes: 40 }, { day: "Tue", minutes: 25 }, { day: "Wed", minutes: 55 },
    { day: "Thu", minutes: 20 }, { day: "Fri", minutes: 32 }, { day: "Sat", minutes: 60 }, { day: "Sun", minutes: 15 },
  ],
  entries: [
    { id: "a1", type: "Brisk walk", duration: 32, intensity: "moderate", date: "Today", notes: "Around the park" },
    { id: "a2", type: "Strength — lower body", duration: 25, intensity: "moderate", date: "Yesterday" },
    { id: "a3", type: "Yoga / mobility", duration: 20, intensity: "low", date: "2 days ago" },
  ],
};

export const mockSleep: SleepSummary = {
  durationHours: 6.6,
  quality: 74,
  bedtime: "11:10 PM",
  wakeTime: "6:20 AM",
  consistencyScore: 68,
  weeklyHours: [
    { day: "Mon", hours: 6.2 }, { day: "Tue", hours: 7.1 }, { day: "Wed", hours: 6.8 },
    { day: "Thu", hours: 5.9 }, { day: "Fri", hours: 6.6 }, { day: "Sat", hours: 7.4 }, { day: "Sun", hours: 6.6 },
  ],
};

export const mockWellbeing: WellbeingEntry[] = [
  { date: "Mon", mood: 3, stress: 2, energy: 3 },
  { date: "Tue", mood: 2, stress: 3, energy: 2 },
  { date: "Wed", mood: 4, stress: 1, energy: 4 },
  { date: "Thu", mood: 3, stress: 2, energy: 3 },
  { date: "Fri", mood: 2, stress: 3, energy: 2 },
  { date: "Sat", mood: 4, stress: 1, energy: 4 },
  { date: "Sun", mood: 3, stress: 2, energy: 3 },
];

export const mockGoals: Goal[] = [
  { id: "g1", title: "Sleep 7+ hours a night", category: "sleep", target: "7 hrs nightly", progress: 62, completed: false, reminder: "10:30 PM wind-down" },
  { id: "g2", title: "Walk 8,000 steps daily", category: "activity", target: "8,000 steps", progress: 78, completed: false },
  { id: "g3", title: "Drink 2.2L of water", category: "hydration", target: "2.2 L / day", progress: 61, completed: false },
  { id: "g4", title: "Two strength sessions a week", category: "strength", target: "2 sessions / wk", progress: 100, completed: true },
];

export const mockAppointments: Appointment[] = [
  { id: "ap1", title: "Annual wellness checkup", provider: "Dr. Anita Rao", date: addDays(6), time: "10:30 AM", location: "City Health Clinic", kind: "checkup" },
  { id: "ap2", title: "Bone density screening", provider: "Radiology Dept.", date: addDays(19), time: "2:00 PM", location: "Metro Diagnostics", kind: "screening" },
  { id: "ap3", title: "Coach check-in", provider: "Coach Meera", date: addDays(2), time: "6:00 PM", location: "Video call", kind: "coach" },
];

export const mockMedications: Medication[] = [
  { id: "md1", name: "Vitamin D3", dose: "1000 IU", schedule: "Every morning", remaining: 14 },
  { id: "md2", name: "Calcium + Magnesium", dose: "500mg", schedule: "With dinner", remaining: 6 },
];

export const mockMessages: Message[] = [
  { id: "ms1", from: "Coach Meera", preview: "Great progress on your sleep goal this week!", time: "Yesterday", unread: true },
  { id: "ms2", from: "Women360 Care Team", preview: "Your bone density screening is coming up.", time: "2 days ago", unread: false },
];

export const mockLearn: LearnArticle[] = [
  { id: "l1", title: "Understanding perimenopause: what's actually changing", category: "Menopause", readMins: 6, dek: "The hormonal shifts behind the symptoms, explained plainly." },
  { id: "l2", title: "Strength training after 40: why it matters more, not less", category: "Fitness", readMins: 5, dek: "Bone density, metabolism, and the case for lifting." },
  { id: "l3", title: "Reading your own cycle: a field guide", category: "Menstrual health", readMins: 7, dek: "What each phase tends to feel like, and why." },
  { id: "l4", title: "Sleep and hormones: the two-way street", category: "Sleep", readMins: 4, dek: "Why sleep quality shifts across the life course." },
  { id: "l5", title: "Preventive screenings, by decade", category: "Preventive health", readMins: 6, dek: "A practical guide to what to schedule and when." },
  { id: "l6", title: "Fibre, protein, and the midlife plate", category: "Nutrition", readMins: 5, dek: "Small, sustainable shifts that add up." },
];

export const mockVitals: VitalMeasurement[] = [
  { id: "v1", type: "weight", value: "68.4 kg", date: "Today" },
  { id: "v2", type: "bloodPressure", value: "118/76", date: "3 days ago" },
  { id: "v3", type: "restingHR", value: "64 bpm", date: "Today" },
];

export const mockReports: ReportRecord[] = [
  { id: "r1", title: "Quarterly Health Summary", generatedOn: addDays(-2), range: "May – Jul 2026" },
  { id: "r2", title: "Cycle & Symptom Report", generatedOn: addDays(-30), range: "Last 3 cycles" },
];

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  time: string;
  read: boolean;
}

export const mockNotifications: AppNotification[] = [
  { id: "n1", title: "Preventive care reminder", detail: "Your bone density screening is coming up next week.", time: "2h ago", read: false },
  { id: "n2", title: "Period expected soon", detail: "Based on your cycle history, your period may start in the next few days.", time: "1d ago", read: false },
  { id: "n3", title: "Goal milestone", detail: "You've hit your hydration goal 4 days in a row.", time: "2d ago", read: true },
];

export const mockInsights = {
  sleepMood: [
    { sleep: 5.5, mood: 2 }, { sleep: 6.2, mood: 3 }, { sleep: 7.1, mood: 4 },
    { sleep: 6.6, mood: 3 }, { sleep: 7.4, mood: 4 }, { sleep: 5.9, mood: 2 }, { sleep: 6.8, mood: 3 },
  ],
  cards: [
    { q: "Does sleep affect your mood?", a: "On nights you slept 7+ hours, your mood the next day was noticeably higher." },
    { q: "How does activity relate to energy?", a: "Days with 30+ active minutes show consistently higher self-reported energy." },
    { q: "Any changes in your cycle symptoms?", a: "Cramping intensity has been steady across your last 3 cycles — no notable shift." },
    { q: "Are you meeting your hydration goal?", a: "You've hit your hydration goal on 4 of the last 7 days — most often earlier in the week." },
  ],
};

export const defaultSeniorEssentials: SeniorEssential[] = [
  { key: "health", label: "My health", enabled: true },
  { key: "medicines", label: "My medicines", enabled: true },
  { key: "appointments", label: "My appointments", enabled: true },
  { key: "activity", label: "My activity", enabled: true },
  { key: "sleep", label: "My sleep", enabled: true },
  { key: "nutrition", label: "My nutrition", enabled: false },
  { key: "messages", label: "My messages", enabled: true },
  { key: "cycle", label: "My cycle", enabled: false },
  { key: "emergency", label: "Emergency contact", enabled: true },
];
