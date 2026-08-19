import {
  LayoutGrid, HeartPulse, CalendarHeart, Apple, Activity, Moon, Smile,
  Target, TrendingUp, FileBarChart2, BookOpen, MessageCircle, Settings,
  Pill, CalendarClock, Phone,
} from "lucide-react";
import type { SeniorEssentialKey } from "@/types";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
}

export const standardNav: NavItem[] = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/app/health", label: "Health", icon: HeartPulse },
  { to: "/app/cycle", label: "Cycle", icon: CalendarHeart },
  { to: "/app/nutrition", label: "Nutrition", icon: Apple },
  { to: "/app/activity", label: "Activity", icon: Activity },
  { to: "/app/sleep", label: "Sleep", icon: Moon },
  { to: "/app/wellbeing", label: "Wellbeing", icon: Smile },
  { to: "/app/goals", label: "Goals", icon: Target },
  { to: "/app/insights", label: "Insights", icon: TrendingUp },
  { to: "/app/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/app/learn", label: "Learn", icon: BookOpen },
  { to: "/app/messages", label: "Messages", icon: MessageCircle },
];

// Primary items surfaced in the mobile bottom nav (kept short by design)
export const mobileBottomNav: NavItem[] = [
  { to: "/app/dashboard", label: "Today", icon: LayoutGrid },
  { to: "/app/cycle", label: "Cycle", icon: CalendarHeart },
  { to: "/app/insights", label: "Insights", icon: TrendingUp },
  { to: "/app/goals", label: "Goals", icon: Target },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export const seniorNavMap: Record<SeniorEssentialKey, NavItem & { plainLabel: string }> = {
  health: { to: "/app/health", label: "My health", plainLabel: "How I'm doing", icon: HeartPulse },
  medicines: { to: "/app/health?tab=medicines", label: "My medicines", plainLabel: "My medicines", icon: Pill },
  appointments: { to: "/app/health?tab=appointments", label: "My appointments", plainLabel: "My appointments", icon: CalendarClock },
  activity: { to: "/app/activity", label: "My activity", plainLabel: "My activity", icon: Activity },
  sleep: { to: "/app/sleep", label: "My sleep", plainLabel: "My sleep", icon: Moon },
  nutrition: { to: "/app/nutrition", label: "My nutrition", plainLabel: "My nutrition", icon: Apple },
  messages: { to: "/app/messages", label: "My messages", plainLabel: "My messages", icon: MessageCircle },
  cycle: { to: "/app/cycle", label: "My cycle", plainLabel: "My cycle", icon: CalendarHeart },
  emergency: { to: "/app/settings?tab=emergency", label: "Emergency contact", plainLabel: "Emergency contact", icon: Phone },
};
