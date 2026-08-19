import { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-maroon-900 text-white p-12">
        <Link to="/" className="font-display text-2xl font-semibold">Women360</Link>
        <div>
          <p className="font-display text-3xl leading-snug max-w-sm">
            Your health, understood — across every stage of life.
          </p>
          <p className="text-maroon-200 mt-4 max-w-sm text-sm">
            One place to track your cycle, nutrition, activity, sleep and wellbeing — built to grow simpler as you need it to.
          </p>
        </div>
        <p className="text-xs text-maroon-300">Women360 · Personal health, not a diagnosis.</p>
      </div>
      <div className="flex flex-col justify-center px-6 sm:px-12 py-16">
        <div className="w-full max-w-sm mx-auto">
          <Link to="/" className="lg:hidden font-display text-xl font-semibold mb-10 block">Women360</Link>
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="text-[var(--w360-text-muted)] text-sm mt-1.5">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
