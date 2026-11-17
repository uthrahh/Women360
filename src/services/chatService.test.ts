import { describe, expect, it } from "vitest";
import { takeEvents } from "./chatService";

describe("takeEvents", () => {
  it("returns whole events and keeps a half event for later", () => {
    const first = takeEvents('data: {"type":"delta","text":"Hel"}\n\ndata: {"type":"delta","te');
    expect(first.events).toEqual([{ type: "delta", text: "Hel" }]);
    const second = takeEvents(first.rest + 'xt":"lo"}\n\n');
    expect(second.events).toEqual([{ type: "delta", text: "lo" }]);
    expect(second.rest).toBe("");
  });

  it("ignores keep-alive comments and malformed events", () => {
    const r = takeEvents(': keep-alive\n\ndata: not json\n\ndata: {"type":"done"}\n\n');
    expect(r.events).toEqual([{ type: "done" }]);
  });
});
