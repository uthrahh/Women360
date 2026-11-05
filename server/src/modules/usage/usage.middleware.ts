import type { NextFunction, Request, Response } from "express";
import { countEvent, noteActive, type Action } from "./usage.service";

/** Which successful request counts as which action: method, then the path under /api/v1 (a path segment such as an id or a date matches any one segment). */
const ACTIONS_BY_REQUEST: [method: string, path: RegExp, action: Action][] = [
  ["POST", /^\/auth\/register$/, "signup"],
  ["PUT", /^\/sleep\/entries\/[^/]+$/, "sleep_logged"],
  ["POST", /^\/nutrition\/meals$/, "meal_logged"],
  ["POST", /^\/nutrition\/hydration$/, "water_logged"],
  ["POST", /^\/activity\/entries$/, "activity_logged"],
  ["POST", /^\/activity\/quick-log$/, "activity_logged"],
  ["PUT", /^\/cycle\/entries\/[^/]+$/, "cycle_logged"],
  ["PUT", /^\/wellbeing\/entries\/[^/]+$/, "mood_logged"],
  ["POST", /^\/goals$/, "goal_created"],
  ["POST", /^\/habits$/, "habit_created"],
  ["PUT", /^\/habits\/[^/]+\/logs\/[^/]+$/, "habit_ticked"],
  ["POST", /^\/health\/medications$/, "medication_added"],
  ["POST", /^\/health\/appointments$/, "appointment_added"],
  ["POST", /^\/health\/medications\/[^/]+\/log$/, "dose_recorded"],
  ["POST", /^\/reports$/, "report_generated"],
  ["POST", /^\/push\/subscribe$/, "reminders_on"],
];

/**
 * Counts an action when the request succeeded. Runs after the response is sent, so it can never slow or break
 * a request, and only records that something happened: not who did it, not what was in it. Staff and the shared
 * demonstration accounts are not counted. See usage.service.ts for exactly what is stored.
 */
export function trackUsage(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    if (res.statusCode >= 300) return;
    const path = req.originalUrl.split("?")[0].replace(/^\/api\/v1/, "").replace(/\/+$/, "");
    const action = ACTIONS_BY_REQUEST.find(([method, pattern]) => method === req.method && pattern.test(path))?.[2];
    if (!action) return;
    // Sign-ups have no signed-in user yet; everything else counts only real women's accounts.
    if (action === "signup") return void countEvent(action);
    if (!req.user || req.user.role !== "WOMAN" || req.user.isDemo) return;
    void countEvent(action);
    void noteActive(req.user.id);
  });
  next();
}
