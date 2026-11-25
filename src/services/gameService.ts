import { request } from "./apiClient";
import { localDateISO } from "./mappers";

export interface GameState {
  enabled: true;
  xp: number;
  level: number;
  levelFrom: number;
  levelTo: number;
  newLevel: number | null;
  today: { points: number; quests: { id: string; label: string; done: boolean }[] };
  run: { current: number; best: number; freezes: number; restLeftThisWeek: boolean };
  badges: { id: string; label: string; description: string; earned: boolean }[];
  rules: { label: string; points: number; perDay: number }[];
}

export const gameService = {
  state: () => request<GameState | { enabled: false }>(`/game?today=${localDateISO()}`),
  seen: (level: number) => request("/game/seen", { method: "POST", body: JSON.stringify({ level }) }),
};
