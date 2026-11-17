import type { ChatRun } from "./chat.events";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fixed answers, free and offline, for the browser tests and for trying the screen without a key (CHATBOT_PROVIDER=scripted; refused in
 * production). It behaves like the real chat in shape: steps, sources it "saw", paragraphs, a plan with tick-off tasks and follow-up
 * questions on the last line. The sources are example.org pages, so nothing here can be mistaken for real health advice.
 */
export async function runScriptedChat(run: ChatRun): Promise<void> {
  const { emit, signal } = run;
  const say = async (text: string) => {
    // A few characters at a time, like a model streaming.
    for (let i = 0; i < text.length; i += 12) {
      if (signal.aborted) return;
      emit({ type: "delta", text: text.slice(i, i + 12) });
      await wait(4);
    }
  };

  let sleepLine = "I can't see your logs, because you haven't shared them with this chat.";
  if (run.summary) {
    emit({ type: "step", id: "s1", label: "Reading your last 30 days", state: "running" });
    await wait(60);
    const summary = (await run.summary()) as { daily?: { sleepHours?: { whole?: { average: number | null } } } };
    const avg = summary.daily?.sleepHours?.whole?.average ?? null;
    emit({ type: "step", id: "s1", label: "Read your last 30 days", state: "done" });
    sleepLine = avg !== null ? `From your logs, you slept about ${avg} hours a night on the nights you logged.` : "You haven't logged sleep in the last 30 days.";
  }

  emit({ type: "step", id: "s2", label: "Searching: sleep and mood", state: "running" });
  await wait(60);
  emit({ type: "sources", sources: [{ url: "https://example.org/sleep-guide", title: "Example sleep guide" }] });
  emit({ type: "step", id: "s2", label: "Searched the web", state: "done" });

  await say(`${sleepLine} Poor sleep and low mood often travel together, though neither proves the other [Example sleep guide](https://example.org/sleep-guide).\n\n`);
  await say("My pick for you: keep a steady wake-up time for two weeks, because a regular rhythm is the easiest thing to change. Runner-up: an earlier wind-down, if mornings are fixed.\n\n");
  await say("- [ ] Wake at the same time every day this week\n- [ ] Log your sleep each morning in [Sleep](/app/sleep)\n- [ ] Note your mood each evening\n\n");
  await say(">> Why does sleep affect mood? | Help me prepare for a doctor visit | How do I wind down?");
  emit({ type: "done" });
}
