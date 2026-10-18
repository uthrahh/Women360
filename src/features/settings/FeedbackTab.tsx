import { useState, type FormEvent } from "react";
import PeekRating from "@/components/reactbits/PeekRating";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { feedbackService } from "@/services/feedbackService";

const LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"];
const MAX_MESSAGE = 2000;

export function FeedbackTab() {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating < 1) return;
    setSending(true);
    try {
      await feedbackService.submit({ rating, message: message.trim() || undefined });
      setSent(true);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't send your feedback. Please try again.", { tone: "error" });
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <CardBody className="pt-5 flex flex-col gap-3" role="status">
          <p className="font-display text-xl font-semibold">Thank you.</p>
          <p className="text-sm text-[var(--w360-text-muted)] max-w-md">
            Your feedback has been sent to the Women360 team.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="w-fit"
            onClick={() => {
              setRating(0);
              setMessage("");
              setSent(false);
            }}
          >
            Send something else
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="pt-5">
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <div>
            <p className="text-sm font-medium" id="feedback-rating-label">How is Women360 working for you?</p>
            <div className="mt-1">
              <PeekRating
                value={rating}
                onChange={setRating}
                count={5}
                shape="star"
                labels={LABELS}
                size={34}
                ariaLabel="Overall rating"
                activeColor="var(--w360-accent)"
                idleColor="color-mix(in srgb, var(--w360-text-muted) 40%, transparent)"
                tipColor="var(--w360-text)"
                tipTextColor="var(--w360-bg)"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="feedback-message" className="text-sm font-medium">Anything we should know? (optional)</label>
            <textarea
              id="feedback-message"
              rows={4}
              maxLength={MAX_MESSAGE}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's working, what's confusing, what's missing"
              className="px-3.5 py-2.5 rounded-xl border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] text-sm senior:text-lg placeholder:text-[var(--w360-text-muted)]"
            />
            <p className="text-xs text-[var(--w360-text-muted)]">
              Sent to the Women360 team with your account. Please leave out health details you'd rather keep private.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={sending || rating < 1}>
              {sending ? "Sending…" : "Send feedback"}
            </Button>
            {rating < 1 && <span className="text-xs text-[var(--w360-text-muted)]">Choose a rating to send.</span>}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
