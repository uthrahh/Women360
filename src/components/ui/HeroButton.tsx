import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import SpecularButton from "@/components/reactbits/SpecularButton";
import { useBrandColors } from "@/hooks/useBrandColors";

// The landing page's large calls to action: a router link drawn with a light
// that travels the edge toward the cursor (React Bits SpecularButton). The
// light is a canvas, so its colours are concrete hex values for the theme.
export function HeroButton({
  to,
  variant = "primary",
  children,
}: {
  to: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  const c = useBrandColors();
  const primary = variant === "primary";

  return (
    <SpecularButton
      as={Link}
      to={to}
      size="lg"
      radius={999}
      tint={primary ? c.accent : c.dark ? "#FFFFFF" : c.accent}
      tintOpacity={primary ? 1 : c.dark ? 0.04 : 0}
      textColor={primary ? c.inkOnAccent : c.ink}
      lineColor={primary ? (c.dark ? "#FFFFFF" : "#F3E1E6") : c.dark ? "#E6BFC9" : c.accent}
      baseColor={primary ? c.accentStrong : c.dark ? "#5A4D44" : "#C9BCAF"}
      idleIntensity={0.45}
      proximity={220}
    >
      {children}
    </SpecularButton>
  );
}
