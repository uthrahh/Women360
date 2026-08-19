import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-3">
      <p className="font-display text-6xl font-semibold text-maroon-700 dark:text-maroon-300">404</p>
      <h1 className="font-display text-2xl font-semibold">This page doesn't exist</h1>
      <p className="text-[var(--w360-text-muted)] max-w-sm">The page you're looking for may have moved. Let's get you back on track.</p>
      <Link to="/"><Button className="mt-2">Back to home</Button></Link>
    </div>
  );
}
