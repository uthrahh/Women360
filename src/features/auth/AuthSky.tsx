// Stars: a fixed scatter, so the night sky is the same every visit.
const STARS = (() => {
  let s = 11;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: 46 }, () => ({ x: rnd() * 100, y: rnd() * 62, r: 0.5 + rnd() * 1.1, o: 0.25 + rnd() * 0.6 }));
})();

function Cloud({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 150 70" className={className} style={style} aria-hidden focusable="false">
      <g fill="var(--sky-cloud)">
        <circle cx="42" cy="42" r="22" />
        <circle cx="74" cy="31" r="28" />
        <circle cx="110" cy="43" r="20" />
        <rect x="18" y="42" width="112" height="22" rx="11" />
      </g>
    </svg>
  );
}

/**
 * The sky behind the sign-in screens. By day, a pale morning with a low sun and a few clouds drifting; by night, black with
 * stars and a moon. Pure decoration: hidden from assistive technology, never takes a tap, and the clouds are the only movement
 * (slow, transform-only, off for reduced motion and Senior Mode).
 */
export function AuthSky() {
  return (
    <div aria-hidden className="auth-sky">
      <div className="auth-sky__glow" />
      <div className="auth-sky__sun" />
      <div className="auth-sky__moon" />
      <svg className="auth-sky__stars" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" focusable="false">
        {STARS.map((st, i) => (
          <circle key={i} cx={st.x} cy={st.y} r={st.r * 0.22} fill="#fff" opacity={st.o} />
        ))}
      </svg>
      <Cloud className="auth-sky__cloud auth-sky__cloud--a" />
      <Cloud className="auth-sky__cloud auth-sky__cloud--b" />
      <Cloud className="auth-sky__cloud auth-sky__cloud--c" />
    </div>
  );
}
