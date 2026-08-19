export function ProgressRing({
  value,
  size = 64,
  strokeWidth = 6,
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="stroke-warmgrey-100 dark:stroke-white/10" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-maroon-600 dark:stroke-maroon-300 transition-[stroke-dashoffset] duration-700"
          fill="none"
        />
      </svg>
      {label && (
        <span className="absolute text-sm font-semibold tabular-nums">{label}</span>
      )}
    </div>
  );
}
