import { describe, expect, it } from "vitest";
import { passwordAcceptable, passwordStrength, suggestPassword } from "./passwordPolicy";

describe("password strength", () => {
  it("says one calm thing at a time, and never accepts a password the rules refuse", () => {
    expect(passwordStrength("").level).toBe(0);
    expect(passwordStrength("abc").message).toMatch(/9 more characters/);
    expect(passwordStrength("meera-loves-tea-99", { name: "Meera Iyer" }).message).toMatch(/name and email/);
    expect(passwordStrength("abcdefgh12345").message).toMatch(/runs/);
    for (const p of ["abc", "aaaaaaaaaaaaaaaa", "qwertyuiopasdfgh"]) expect(passwordStrength(p).acceptable).toBe(false);
  });

  it("rises with length and variety", () => {
    const ok = passwordStrength("tulip harbour");
    const strong = passwordStrength("Tulip-harbour-74");
    const very = passwordStrength("Tulip-harbour-74-quiet-Lantern");
    expect(ok.acceptable).toBe(true);
    expect(strong.level).toBeGreaterThanOrEqual(ok.level);
    expect(very.level).toBe(4);
    expect(very.fraction).toBe(1);
  });
});

describe("suggested passwords", () => {
  it("are long, mixed, readable, accepted by the rules, and different each time", () => {
    const a = suggestPassword({ name: "Asha", email: "asha@example.com" });
    const b = suggestPassword();
    expect(a).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
    expect(a).not.toMatch(/[01OIl]/);
    expect(passwordAcceptable(a)).toBe(true);
    expect(passwordStrength(a).level).toBeGreaterThanOrEqual(3);
    expect(a).not.toBe(b);
  });
});
