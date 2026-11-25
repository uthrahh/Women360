import {
  LayoutGrid, HeartPulse, CalendarHeart, Apple, Activity, Moon, Smile,
  Target, TrendingUp, FileBarChart2, BookOpen, MessageCircle, Settings,
  Pill, CalendarClock, Phone, Flame, MessageSquareText, Route, Users, Trophy, Lightbulb,
} from "lucide-react";
import type { SeniorEssential, SeniorEssentialKey } from "@/types";

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
  { to: "/app/habits", label: "Habits", icon: Flame },
  { to: "/app/goals", label: "Goals", icon: Target },
  { to: "/app/programme", label: "Programme", icon: Route },
  { to: "/app/family", label: "Family", icon: Users },
  { to: "/app/advisor", label: "Health advisor", icon: Lightbulb },
  { to: "/app/game", label: "Game", icon: Trophy },
  { to: "/app/insights", label: "Insights", icon: TrendingUp },
  { to: "/app/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/app/learn", label: "Learn", icon: BookOpen },
  { to: "/app/messages", label: "Messages", icon: MessageCircle },
  { to: "/app/chat", label: "Ask Women360", icon: MessageSquareText },
];

const byTo = (to: string): NavItem => {
  const found = standardNav.find((n) => n.to === to) ?? (to === "/app/settings" ? { to, label: "Settings", icon: Settings } : undefined);
  if (!found) throw new Error(`Unknown nav route: ${to}`);
  return found;
};

// The signed-in menu: a few grouped branches rather than twelve flat links, so
// the whole app is reachable from one place at any screen size. A group with a
// single destination (Dashboard, Settings) is a plain leaf.
export type MenuNode = { leaf: NavItem } | { label: string; items: NavItem[] };

export const menuTree: MenuNode[] = [
  { leaf: byTo("/app/dashboard") },
  { label: "Track", items: ["/app/game", "/app/habits", "/app/cycle", "/app/nutrition", "/app/activity", "/app/sleep", "/app/wellbeing"].map(byTo) },
  { label: "Care", items: ["/app/health", "/app/advisor", "/app/family", "/app/programme", "/app/goals", "/app/insights", "/app/reports"].map(byTo) },
  { label: "Support", items: ["/app/chat", "/app/learn", "/app/messages"].map(byTo) },
  { leaf: byTo("/app/settings") },
];

/** The screens that show a family member's records when she is looking at them (the rest are her own account's). */
export const FAMILY_SCREENS = ["/app/dashboard", "/app/habits", "/app/cycle", "/app/nutrition", "/app/activity", "/app/sleep", "/app/wellbeing", "/app/goals", "/app/health", "/app/insights", "/app/reports"];

export interface NavContext {
  isDemo?: boolean;
  /** The cycle screens, for the person whose records are shown. */
  cycleTracking?: boolean;
  /** Game mode, switched on by her. */
  gameMode?: boolean;
  /** She is looking at a family member's records. */
  acting?: boolean;
}

/**
 * Screens that exist only while something is switched on: Learn (clinical review), the AI chat (owner's switch and key),
 * Programme (an administrator has published one, or she is in one; a demonstration account always has the sample one), Cycle
 * (unless the person turned the tracker off), Game (only in game mode). While she looks at a family member's records only
 * their tracking screens are shown. The menu, bottom bar, Senior Mode tiles and command menu all ask this.
 */
export function navVisible(to: string, f: { clinicalContent: boolean; chatbot: boolean; programmes: boolean }, ctx: NavContext = {}): boolean {
  const path = to.split("?")[0];
  if (path === "/app/cycle" && ctx.cycleTracking === false) return false;
  if (ctx.acting) return FAMILY_SCREENS.includes(path);
  if (path === "/app/learn") return f.clinicalContent;
  if (path === "/app/chat") return f.chatbot;
  if (path === "/app/programme") return f.programmes || !!ctx.isDemo;
  if (path === "/app/game") return !!ctx.gameMode;
  return true;
}

// Primary items surfaced in the mobile bottom nav (kept short by design)
export const mobileBottomNav: NavItem[] = [
  { to: "/app/dashboard", label: "Today", icon: LayoutGrid },
  { to: "/app/cycle", label: "Cycle", icon: CalendarHeart },
  { to: "/app/insights", label: "Insights", icon: TrendingUp },
  { to: "/app/habits", label: "Habits", icon: Flame },
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

// A new user's Senior Mode "Customize essentials" selection before they
// change anything in Settings.
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
