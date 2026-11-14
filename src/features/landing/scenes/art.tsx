import type { CSSProperties, ReactNode } from "react";

/*
 * Five scenes drawn from the five reference films, in one hand: ink outlines over soft, slightly misregistered washes.
 * Stage is 1600 x 900; every figure stands around x = 1250 so a phone (which keeps x 1000-1500 in view) still sees her.
 *
 *   opening  the burgundy textured title card -> a wash and a single stem that draws itself as she scrolls
 *   window   young woman by a jali lamp and a bright window, eyes lowered -> lifts her head as the light grows
 *   kitchen  a woman slicing tomatoes at a marble counter -> slices gather as she scrolls, the pot steams
 *   park     an older woman in a teal kurta in a garden, holding up her phone -> raises it to show the large tiles
 *   walk     a woman walking a park path at sunrise -> the sun climbs as she scrolls
 *   closing  the opening stem again, now flowering
 *
 * `--p` (0 to 1, how far through the scene's section she has read) drives the scroll-linked parts.
 */

type V = CSSProperties & Record<`--${string}`, string | number>;

/** A drawn outline. `w` thickness, `soft` a lighter secondary line, `dl` draw delay in seconds. */
function L({ d, w, soft, dl, className, style }: { d: string; w?: number; soft?: boolean; dl?: number; className?: string; style?: CSSProperties }) {
  return (
    <path
      d={d}
      pathLength={1}
      className={`sc-line sc-draw${soft ? " sc-soft" : ""}${className ? ` ${className}` : ""}`}
      style={{ ...(w ? { strokeWidth: w } : {}), ...(dl ? ({ "--dl": `${dl}s` } as V) : {}), ...style }}
    />
  );
}

/** A colour wash. */
function W({ d, c, o = 0.85, dl, style }: { d: string; c: string; o?: number; dl?: number; style?: CSSProperties }) {
  return <path d={d} className="sc-wash" fill={`var(--sc-${c})`} fillOpacity={o} style={{ ...(dl ? ({ "--dl": `${dl}s` } as V) : {}), ...style }} />;
}

function Dot({ x, y, r, c, o = 0.9 }: { x: number; y: number; r: number; c: string; o?: number }) {
  return <circle cx={x} cy={y} r={r} className="sc-wash" fill={`var(--sc-${c})`} fillOpacity={o} />;
}

const origin = (x: number, y: number): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });

// A small fixed scatter (deterministic, so every visit draws the same garden).
function scatter(n: number, seed: number, x0: number, x1: number, y0: number, y1: number) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () => ({ x: x0 + rnd() * (x1 - x0), y: y0 + rnd() * (y1 - y0), r: 3 + rnd() * 5, k: rnd() }));
}

/* ------------------------------------------------------------------ shared defs */

export function SceneDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        {/* Watercolour: wobbly edges and paper granulation. Used only on still background layers (rendered once). */}
        <filter id="sc-wc" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9" result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.25" result="ga" />
          <feComposite in="d" in2="ga" operator="in" />
        </filter>
        {/* A pen line that is never quite straight. */}
        <filter id="sc-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <radialGradient id="sc-glow">
          <stop offset="0" style={{ stopColor: "var(--sc-light)", stopOpacity: 1 }} />
          <stop offset="0.45" style={{ stopColor: "var(--sc-sun)", stopOpacity: 0.55 }} />
          <stop offset="1" style={{ stopColor: "var(--sc-sun)", stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id="sc-sunglow">
          <stop offset="0" style={{ stopColor: "var(--sc-light)", stopOpacity: 1 }} />
          <stop offset="0.3" style={{ stopColor: "var(--sc-sun)", stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: "var(--sc-sun)", stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient id="sc-ray" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--sc-light)", stopOpacity: 0.95 }} />
          <stop offset="1" style={{ stopColor: "var(--sc-light)", stopOpacity: 0 }} />
        </linearGradient>
        <linearGradient id="sc-dawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--sc-cream)" }} />
          <stop offset="0.6" style={{ stopColor: "var(--sc-sun)" }} />
          <stop offset="1" style={{ stopColor: "var(--sc-light)" }} />
        </linearGradient>
        {/* Carved jali: interlocking circles. */}
        <pattern id="sc-jali" width="56" height="56" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="var(--sc-ink)" strokeWidth="2" opacity="0.8">
            <circle cx="28" cy="12" r="16" />
            <circle cx="28" cy="44" r="16" />
            <circle cx="12" cy="28" r="16" />
            <circle cx="44" cy="28" r="16" />
          </g>
        </pattern>
      </defs>
    </svg>
  );
}

/* ------------------------------------------------------------------ 1 & 6: opening / closing */

const STEM = "M1440 940 C1420 800 1478 670 1452 540 C1430 430 1446 340 1446 250";
const LEAVES: { d: string; at: number; o: [number, number] }[] = [
  { d: "M1442 780 C1400 760 1360 770 1336 744 C1372 726 1420 740 1442 780 Z", at: 0.22, o: [1442, 780] },
  { d: "M1456 660 C1500 632 1540 640 1566 612 C1528 596 1480 616 1456 660 Z", at: 0.4, o: [1456, 660] },
  { d: "M1446 520 C1404 500 1376 506 1350 478 C1388 464 1426 482 1446 520 Z", at: 0.6, o: [1446, 520] },
  { d: "M1444 380 C1480 356 1512 362 1532 336 C1500 324 1462 340 1444 380 Z", at: 0.78, o: [1444, 380] },
];
const PETAL = "M0 0 C-20 -22 -18 -58 0 -72 C18 -58 20 -22 0 0 Z";

function OpeningBack() {
  return (
    <g>
      <g filter="url(#sc-wc)">
        <path className="sc-wash" fill="var(--sc-maroon)" fillOpacity={0.55} d="M760 -60 C980 60 1110 -30 1330 40 C1560 110 1700 20 1700 20 L1700 960 L820 960 C930 760 760 640 850 500 C940 360 700 220 760 -60 Z" />
        <path className="sc-wash" fill="var(--sc-maroon-deep)" fillOpacity={0.4} d="M1160 -60 C1300 40 1420 0 1700 60 L1700 960 L1250 960 C1330 800 1180 680 1260 520 C1330 380 1120 160 1160 -60 Z" />
        <path className="sc-wash" fill="var(--sc-rose)" fillOpacity={0.35} d="M560 900 C620 780 760 760 820 840 C860 900 840 960 840 960 L540 960 Z" />
      </g>
    </g>
  );
}

function Bloom({ open }: { open: string }) {
  // Five petals turn outward as `open` goes from 0 (a closed bud) to 1 (in flower).
  return (
    <g transform="translate(1446 250)">
      {[-2, -1, 0, 1, 2].map((k) => (
        <g key={k} style={{ transform: `rotate(calc(${k} * (9deg + ${open} * 30deg))) scale(calc(0.55 + ${open} * 0.45))`, transformOrigin: "0 0" }}>
          <W d={PETAL} c="rose" o={0.9} dl={1.2} />
          <L d={PETAL} w={2.4} dl={1.1} />
        </g>
      ))}
      <circle r="9" className="sc-wash" fill="var(--sc-sun)" style={{ opacity: `calc(${open})` } as CSSProperties} />
    </g>
  );
}

/** `closing` = the same stem fully grown, flowering as she reaches the end of the page. */
function OpeningFront({ closing }: { closing?: boolean }) {
  const drawn = closing ? "1" : "calc(0.3 + var(--p, 0) * 0.7)";
  const open = closing ? "var(--p, 0)" : "0";
  return (
    <g className="sc-a-sway-sm" style={origin(1440, 900)}>
      <path
        d={STEM}
        pathLength={1}
        className="sc-line"
        style={{ strokeWidth: 3.2, strokeDasharray: "1 1", strokeDashoffset: `calc(1 - ${drawn})`, transition: "stroke-dashoffset 0.25s linear" }}
      />
      <path d="M1452 600 C1470 560 1462 520 1470 490" pathLength={1} className="sc-line sc-soft" style={{ strokeDasharray: "1 1", strokeDashoffset: `calc(1 - ${drawn})` }} />
      {LEAVES.map((leaf) => (
        <g key={leaf.d} style={{ opacity: `clamp(0, calc((${drawn} - ${leaf.at}) * 9), 1)`, transform: `scale(clamp(0.4, calc((${drawn} - ${leaf.at}) * 6 + 0.4), 1))`, ...origin(...leaf.o) } as CSSProperties}>
          <path d={leaf.d} fill="var(--sc-sage)" fillOpacity={0.8} transform="translate(4 3)" />
          <path d={leaf.d} className="sc-line" style={{ strokeWidth: 2.4 }} />
        </g>
      ))}
      <g style={{ opacity: `clamp(0, calc((${drawn} - 0.9) * 10), 1)` } as CSSProperties}>
        <Bloom open={open} />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ 2: by the window */

function WindowBack() {
  return (
    <g>
      <g filter="url(#sc-wc)">
        <rect className="sc-wash" x="-40" y="-40" width="1700" height="1000" fill="var(--sc-cream)" fillOpacity={0.7} />
        <rect className="sc-wash" x="1400" y="-20" width="260" height="960" fill="var(--sc-light)" fillOpacity={0.95} />
        <path className="sc-wash" d="M860 920 L860 300 C860 160 960 92 1000 80 C1040 92 1140 160 1140 300 L1140 920 Z" fill="var(--sc-wood)" fillOpacity={0.35} />
      </g>
      <g filter="url(#sc-rough)">
        <path d="M876 900 L876 304 C876 176 966 112 1000 100 C1034 112 1124 176 1124 304 L1124 900 Z" fill="url(#sc-jali)" opacity={0.55} />
        <path className="sc-line" d="M860 920 L860 300 C860 160 960 92 1000 80 C1040 92 1140 160 1140 300 L1140 920" />
        <path className="sc-line sc-soft" d="M876 920 L876 304 C876 176 966 112 1000 100 C1034 112 1124 176 1124 304 L1124 920" />
        {/* window, distant tower, curtain */}
        <path className="sc-line" d="M1400 -20 L1400 920 M1410 -20 L1410 920" />
        <path className="sc-line sc-soft" d="M1520 920 L1520 380 Q1540 350 1560 380 L1560 920 M1508 382 Q1540 316 1572 382 M1540 316 L1540 296" />
        <path className="sc-line sc-soft" d="M1430 820 C1460 790 1480 800 1500 780 M1580 760 C1600 740 1620 750 1640 730" />
        <path className="sc-line sc-soft" d="M1362 -20 C1374 200 1352 400 1366 600 C1378 760 1358 860 1366 920 M1384 -20 C1392 220 1376 420 1388 620 C1398 760 1382 860 1388 920" />
      </g>
    </g>
  );
}

function WindowFront() {
  return (
    <g>
      {/* light from the window grows as she reads */}
      <path d="M1400 30 L1400 760 L1040 920 L1320 920 Z" fill="url(#sc-ray)" style={{ opacity: "calc(0.25 + var(--p, 0) * 0.55)" } as CSSProperties} />
      {/* the jali lamp */}
      <circle cx="1000" cy="360" r="130" fill="url(#sc-glow)" className="sc-a-flicker" />
      <L d="M1000 230 L1000 306" soft />
      <W d="M984 330 Q1000 300 1016 330 L1019 390 Q1000 406 981 390 Z" c="sun" o={0.9} />
      <L d="M984 330 Q1000 300 1016 330 L1019 390 Q1000 406 981 390 Z" w={2.4} />
      <L d="M984 352 L1016 352 M982 372 L1018 372" soft />

      {/* her: hair falling behind her shoulders first, then the body, then her face */}
      <g style={{ transform: "rotate(calc(7deg - var(--p, 0) * 6deg))", ...origin(1238, 430) }}>
        <W d="M1188 252 C1166 296 1158 360 1150 420 C1140 490 1152 560 1132 640 C1158 662 1188 654 1206 622 C1194 560 1198 480 1212 420 L1264 420 C1278 480 1282 560 1272 630 C1300 672 1340 670 1360 650 C1338 580 1346 500 1330 430 C1320 370 1312 300 1292 258 C1270 222 1210 220 1188 252 Z" c="hair-dark" o={0.85} />
      </g>
      <g className="sc-a-breathe" style={origin(1240, 900)}>
        <W d="M1090 920 C1090 700 1100 560 1150 500 C1175 470 1200 462 1210 458 L1240 500 L1270 458 C1285 462 1310 470 1335 500 C1385 560 1390 700 1392 920 Z" c="kurta" o={0.95} />
        <L d="M1090 920 C1090 700 1100 560 1150 500 C1175 470 1200 462 1210 458 M1270 458 C1285 462 1310 470 1335 500 C1385 560 1390 700 1392 920" />
        <L d="M1210 458 L1240 500 L1270 458" w={2.4} dl={0.3} />
        <L d="M1212 470 L1240 512 L1268 470" soft dl={0.4} />
        <L d="M1168 610 C1180 700 1172 800 1184 920 M1312 610 C1300 700 1310 800 1300 920" soft dl={0.5} />
        {[0, 1, 2, 3, 4].map((i) => (
          <Dot key={i} x={1222 + i * 9 - (i > 2 ? (i - 2) * 18 : 0)} y={480 + (i > 2 ? (4 - i) * 14 : i * 14)} r={2.4} c="maroon" />
        ))}
      </g>
      {/* her head lifts a little as the light grows */}
      <g style={{ transform: "rotate(calc(7deg - var(--p, 0) * 6deg))", ...origin(1238, 430) }}>
        <L d="M1218 404 C1220 425 1216 440 1210 458 M1260 400 C1258 425 1262 442 1270 458" w={2.4} />
        <W d="M1188 300 C1186 255 1215 238 1240 240 C1272 243 1290 270 1288 310 C1286 360 1268 398 1238 408 C1212 404 1192 372 1188 330 Z" c="skin-1" o={0.9} />
        <L d="M1188 300 C1186 255 1215 238 1240 240 C1272 243 1290 270 1288 310 C1286 360 1268 398 1238 408 C1212 404 1192 372 1188 330 Z" />
        <L d="M1182 318 C1180 262 1212 228 1252 232 C1290 238 1306 270 1300 320" w={4} />
        <L d="M1240 236 C1232 252 1222 266 1206 282" soft />
        {/* lowered eyes, brows, nose, a small smile */}
        <L d="M1208 322 Q1219 328 1230 322 M1252 320 Q1263 326 1274 319" w={2.2} dl={0.6} />
        <L d="M1210 325 L1206 331 M1218 327 L1216 334 M1256 323 L1254 330 M1265 325 L1264 332" soft dl={0.7} />
        <L d="M1205 306 Q1218 300 1232 304 M1250 302 Q1264 297 1278 302" w={2} dl={0.6} />
        <L d="M1243 326 C1244 344 1240 356 1234 362 Q1240 366 1248 362" w={2} dl={0.7} />
        <L d="M1226 384 Q1239 391 1252 383" w={2.2} dl={0.8} />
        <circle cx="1194" cy="356" r="3" className="sc-wash" fill="var(--sc-sun)" />
        {/* loose waves over her shoulders, moving in the draught from the window */}
        <g className="sc-a-sway" style={origin(1240, 290)}>
          <W d="M1194 296 C1174 360 1180 420 1164 480 C1150 540 1170 600 1150 664 C1176 650 1190 610 1194 566 C1200 500 1196 440 1212 380 Z" c="hair-dark" o={0.9} />
          <W d="M1286 296 C1310 370 1298 430 1318 494 C1336 560 1312 624 1336 684 C1356 650 1350 600 1342 556 C1330 490 1330 420 1300 340 Z" c="hair-dark" o={0.9} />
          <L d="M1192 300 C1170 360 1180 420 1160 480 C1145 540 1170 600 1150 660" w={3.4} dl={0.4} />
          <L d="M1186 330 C1165 400 1185 460 1170 520 C1160 560 1176 600 1166 640" soft dl={0.5} />
          <L d="M1290 300 C1312 370 1300 430 1320 490 C1338 560 1310 620 1335 680" w={3.4} dl={0.4} />
          <L d="M1300 340 C1318 400 1306 450 1326 520" soft dl={0.5} />
        </g>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ 3: the kitchen */

function KitchenBack() {
  return (
    <g>
      <g filter="url(#sc-wc)">
        <rect className="sc-wash" x="-40" y="-40" width="1700" height="700" fill="var(--sc-cream)" fillOpacity={0.6} />
        <rect className="sc-wash" x="120" y="80" width="440" height="440" fill="var(--sc-light)" fillOpacity={0.9} />
        <rect className="sc-wash" x="1440" y="130" width="160" height="470" fill="var(--sc-wood)" fillOpacity={0.3} />
        <rect className="sc-wash" x="-40" y="640" width="1700" height="320" fill="var(--sc-marble)" fillOpacity={0.95} />
      </g>
      <g filter="url(#sc-rough)">
        <path className="sc-line" d="M120 80 L560 80 L560 520 L120 520 Z M340 80 L340 520 M120 300 L560 300" />
        <path className="sc-line sc-soft" d="M140 470 C220 420 300 440 380 400 C440 372 500 390 540 370" />
        <path className="sc-line" d="M1450 140 L1590 140 L1590 590 L1450 590 Z M1466 170 L1574 170 L1574 350 L1466 350 Z M1466 380 L1574 380 L1574 560 L1466 560 Z M1480 190 L1560 190 M1480 400 L1560 400" />
        <path className="sc-line" d="M-20 640 L1620 640 M-20 652 L1620 652" />
        <path className="sc-line sc-soft" d="M80 720 C300 740 420 690 640 770 M900 870 C1100 810 1300 850 1560 790 M200 890 C400 830 520 870 700 850 M640 700 C700 730 760 720 820 760" />
      </g>
    </g>
  );
}

const SLICES = [0, 1, 2, 3, 4, 5];

function KitchenFront() {
  return (
    <g>
      {/* her */}
      <g className="sc-a-breathe" style={origin(1190, 645)}>
        <W d="M1040 645 C1040 520 1070 440 1120 410 C1150 395 1165 388 1170 385 Q1190 398 1210 385 C1225 390 1250 400 1280 420 C1330 455 1345 540 1348 645 Z" c="sweater" o={0.95} />
        <L d="M1040 645 C1040 520 1070 440 1120 410 C1150 395 1165 388 1170 385 M1210 385 C1225 390 1250 400 1280 420 C1330 455 1345 540 1348 645" />
        <L d="M1165 386 Q1190 410 1215 385 M1162 392 Q1190 420 1218 391" w={2.2} dl={0.3} />
        <path d="M1090 460 L1090 640 M1130 440 L1130 640 M1250 440 L1250 640 M1290 460 L1290 640 M1210 430 L1210 640" className="sc-line sc-soft" style={{ strokeDasharray: "3 9" }} />
      </g>
      <g>
        <W d="M1110 300 C1100 220 1150 180 1195 182 C1250 186 1275 230 1268 290 C1275 340 1290 380 1270 420 C1250 440 1245 410 1240 390 L1140 395 C1130 420 1110 425 1100 400 C1095 360 1112 340 1110 300 Z" c="hair-blonde" o={0.9} />
        <L d="M1172 360 L1170 386 M1206 356 L1210 386" w={2.2} />
        <W d="M1140 280 C1140 240 1165 228 1190 230 C1220 234 1234 258 1232 292 C1230 330 1214 356 1190 362 C1164 358 1144 330 1140 300 Z" c="skin-2" o={0.95} />
        <L d="M1140 280 C1140 240 1165 228 1190 230 C1220 234 1234 258 1232 292 C1230 330 1214 356 1190 362 C1164 358 1144 330 1140 300 Z" />
        <L d="M1110 300 C1100 220 1150 180 1195 182 C1250 186 1275 230 1268 290 C1275 340 1290 380 1270 420" w={3.2} dl={0.3} />
        <L d="M1112 310 C1100 350 1112 380 1100 404 M1150 262 C1170 236 1210 230 1236 250 M1254 300 C1262 340 1256 370 1266 400" soft dl={0.4} />
        <L d="M1160 290 Q1170 295 1180 290 M1198 289 Q1208 294 1218 288" w={2.2} dl={0.6} />
        <L d="M1158 278 Q1170 273 1182 277 M1197 276 Q1208 271 1220 275" w={1.8} dl={0.6} />
        <L d="M1192 296 C1193 312 1190 320 1185 324 Q1191 327 1198 324" w={2} dl={0.7} />
        <L d="M1178 338 Q1190 344 1202 337" w={2.2} dl={0.8} />
      </g>
      {/* the hand that steadies the tomato */}
      <W d="M1062 470 C1040 540 1060 600 1110 626 L1150 616 C1110 590 1100 540 1110 480 Z" c="sweater" o={0.95} />
      <L d="M1062 470 C1040 540 1060 600 1110 626 M1110 480 C1100 540 1110 590 1150 616" />
      <W d="M1112 612 C1124 598 1150 600 1160 614 C1162 628 1140 636 1120 632 Z" c="skin-2" o={0.95} />
      <L d="M1112 612 C1124 598 1150 600 1160 614 C1162 628 1140 636 1120 632 Z" w={2.2} />
      {/* board, food, bowl */}
      <W d="M1030 650 L1370 650 L1392 690 L1008 690 Z" c="wood" o={0.55} />
      <L d="M1030 650 L1370 650 L1392 690 L1008 690 Z M1008 690 L1008 700 L1392 700 L1392 690" w={2.4} />
      <Dot x={1166} y={636} r={19} c="tomato" />
      <L d="M1147 636 a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0 M1160 618 l6 -6 l6 6" w={2.2} />
      {SLICES.map((i) => (
        <g key={i} style={{ opacity: `clamp(0, calc((var(--p, 0) - ${i / 7}) * 14), 1)` } as CSSProperties}>
          <path d={`M${1196 + i * 24} 668 a11 11 0 0 1 22 0 Z`} fill="var(--sc-tomato)" fillOpacity={0.85} />
          <path d={`M${1196 + i * 24} 668 a11 11 0 0 1 22 0 Z M${1201 + i * 24} 664 l3 0 M${1210 + i * 24} 663 l3 0`} className="sc-line" style={{ strokeWidth: 1.8 }} />
        </g>
      ))}
      <L d="M1300 668 C1312 650 1330 648 1344 660 M1310 672 C1330 660 1350 662 1362 676 M1322 664 L1330 680" soft />
      {/* the knife hand, keeping time */}
      <g className="sc-a-chop" style={origin(1300, 540)}>
        <W d="M1316 470 C1342 540 1310 590 1250 612 L1236 598 C1280 576 1290 530 1280 480 Z" c="sweater" o={0.95} />
        <L d="M1316 470 C1342 540 1310 590 1250 612 M1280 480 C1290 530 1280 576 1236 598" />
        <W d="M1226 604 C1236 590 1258 592 1262 606 C1260 620 1240 624 1230 618 Z" c="skin-2" o={0.95} />
        <L d="M1226 604 C1236 590 1258 592 1262 606 C1260 620 1240 624 1230 618 Z" w={2.2} />
        <W d="M1232 612 L1188 650 L1198 656 L1242 620 Z" c="steel" o={0.95} />
        <L d="M1232 612 L1188 650 L1198 656 L1242 620 Z M1246 604 L1268 588" w={2.2} />
      </g>
      <W d="M1400 628 C1400 668 1430 684 1450 684 C1470 684 1500 668 1500 628 Z" c="cream" o={0.95} />
      <L d="M1400 628 C1400 668 1430 684 1450 684 C1470 684 1500 668 1500 628 M1400 628 C1420 618 1480 618 1500 628" />
      <Dot x={1430} y={626} r={6} c="avocado" />
      <Dot x={1452} y={622} r={5} c="sun" />
      <Dot x={1470} y={627} r={6} c="tomato" />
      <W d="M1510 690 C1500 660 1540 646 1556 668 C1566 690 1540 708 1520 704 Z" c="avocado" o={0.9} />
      <L d="M1510 690 C1500 660 1540 646 1556 668 C1566 690 1540 708 1520 704 Z" w={2.2} />
      <Dot x={1532} y={680} r={9} c="wood" />
      {[[1470, 728], [1500, 742], [1440, 744], [1080, 736], [1104, 752]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <Dot x={x} y={y} r={15} c="tomato" />
          <path d={`M${x - 15} ${y} a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0`} className="sc-line" style={{ strokeWidth: 2 }} />
        </g>
      ))}
      {/* phone on the counter, and the pot */}
      <W d="M930 702 L1012 690 L1022 706 L940 718 Z" c="ink" o={0.5} />
      <L d="M930 702 L1012 690 L1022 706 L940 718 Z" w={2} />
      <L d="M1560 600 L1600 600 M1556 600 C1556 660 1570 680 1600 680" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${1574 + i * 10} 580 C${1566 + i * 10} 560 ${1584 + i * 10} 548 ${1576 + i * 10} 528`} className="sc-line sc-soft sc-a-steam" style={{ animationDelay: `${i * 1.05}s` }} />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ 4: the garden (Senior Mode) */

const FLOWERS_L = scatter(70, 7, 0, 900, 660, 900);
const FLOWERS_R = scatter(28, 21, 1420, 1600, 700, 900);
const FLOWER_COLOURS = ["rose", "tomato", "sun", "kurta"];

function ParkBack() {
  return (
    <g>
      <g filter="url(#sc-wc)">
        <rect className="sc-wash" x="-40" y="-40" width="1700" height="1000" fill="var(--sc-light)" fillOpacity={0.6} />
        <path className="sc-wash" fill="var(--sc-sage)" fillOpacity={0.7} d="M-40 -40 L760 -40 C800 120 720 200 760 300 C780 400 640 480 520 470 C380 520 200 460 120 520 C40 560 -40 500 -40 500 Z" />
        <path className="sc-wash" fill="var(--sc-sage-deep)" fillOpacity={0.5} d="M-40 -40 L520 -40 C560 80 480 160 500 260 C460 340 320 360 220 400 C120 430 -40 380 -40 380 Z" />
        <path className="sc-wash" fill="var(--sc-sage)" fillOpacity={0.65} d="M1340 -40 L1660 -40 L1660 460 C1580 480 1500 430 1440 440 C1380 380 1400 300 1360 240 C1320 160 1360 60 1340 -40 Z" />
        <path className="sc-wash" fill="var(--sc-sage)" fillOpacity={0.45} d="M-40 600 C300 580 700 620 1000 600 C1300 580 1500 620 1660 600 L1660 960 L-40 960 Z" />
        <path className="sc-wash" fill="var(--sc-cream)" fillOpacity={0.9} d="M980 960 C1030 800 1170 720 1400 670 L1660 640 L1660 700 C1420 730 1260 800 1220 960 Z" />
        <circle className="sc-wash" cx="1180" cy="120" r="150" fill="var(--sc-sun)" fillOpacity={0.4} />
      </g>
      <g filter="url(#sc-rough)">
        <path className="sc-line" d="M520 470 C526 540 516 600 530 660 M548 468 C552 540 548 600 560 660 M1480 440 C1486 520 1476 600 1490 700" />
        <path className="sc-line sc-soft" d="M240 600 L420 600 M250 600 L246 640 M410 600 L414 640 M236 582 L424 582" />
        <path className="sc-line sc-soft" d="M980 960 C1030 800 1170 720 1400 670 M1220 960 C1260 800 1420 730 1660 700" />
      </g>
      {FLOWERS_L.concat(FLOWERS_R).map((f, i) => (
        <circle key={i} cx={f.x} cy={f.y} r={f.r} fill={`var(--sc-${FLOWER_COLOURS[Math.floor(f.k * 4)]})`} fillOpacity={0.85} className="sc-wash" />
      ))}
    </g>
  );
}

function ParkFront() {
  return (
    <g>
      {[[690, 300], [740, 420], [1390, 280], [1420, 400], [620, 200]].map(([x, y], i) => (
        <g key={i} className="sc-a-flutter" style={{ ...origin(x, y), animationDelay: `${i * 0.6}s` }}>
          <path d={`M${x} ${y} c14 -10 28 -8 34 4 c-12 10 -26 8 -34 -4 Z`} fill="var(--sc-sage-deep)" fillOpacity={0.8} />
          <path d={`M${x} ${y} c14 -10 28 -8 34 4 c-12 10 -26 8 -34 -4 Z`} className="sc-line" style={{ strokeWidth: 1.6 }} />
        </g>
      ))}
      <g className="sc-a-breathe" style={origin(1220, 900)}>
        <W d="M1080 920 C1080 700 1095 520 1140 450 C1160 425 1185 412 1194 410 Q1215 432 1240 410 C1255 414 1285 428 1310 452 C1350 500 1360 700 1362 920 Z" c="teal" o={0.9} />
        <L d="M1080 920 C1080 700 1095 520 1140 450 C1160 425 1185 412 1194 410 Q1215 432 1240 410 C1255 414 1285 428 1310 452 C1350 500 1360 700 1362 920" />
        <L d="M1216 432 L1216 610" soft dl={0.4} />
        {scatter(26, 5, 1100, 1340, 470, 900).map((m, i) => (
          <circle key={i} cx={m.x} cy={m.y} r={2.6} fill="var(--sc-sun)" className="sc-wash" />
        ))}
        {/* left arm, bangles */}
        <W d="M1132 470 C1100 560 1096 620 1112 650 L1136 646 C1130 610 1140 560 1160 490 Z" c="teal" o={0.95} />
        <L d="M1132 470 C1100 560 1096 620 1112 650 M1160 490 C1140 560 1130 610 1136 646" />
        <W d="M1108 650 C1104 676 1118 690 1132 686 C1142 676 1140 656 1136 646 Z" c="skin-3" o={0.95} />
        <L d="M1108 650 C1104 676 1118 690 1132 686 C1142 676 1140 656 1136 646 M1108 646 L1138 642 M1108 640 L1138 636" w={2} />
      </g>
      {/* head turned to her right, smiling, glasses, a silver bun */}
      <g>
        <circle cx="1160" cy="262" r="27" className="sc-wash" fill="var(--sc-hair-grey)" />
        <L d="M1133 262 a27 27 0 1 0 54 0 a27 27 0 1 0 -54 0 M1146 254 C1156 244 1172 250 1170 264" w={2.4} />
        <L d="M1196 388 L1194 412 M1236 386 L1240 412" w={2.2} />
        <W d="M1168 300 C1166 262 1192 250 1222 254 C1252 258 1270 280 1266 318 C1262 360 1240 386 1214 390 C1190 386 1172 356 1168 320 Z" c="skin-3" o={0.95} />
        <L d="M1168 300 C1166 262 1192 250 1222 254 C1252 258 1270 280 1266 318 C1262 360 1240 386 1214 390 C1190 386 1172 356 1168 320 Z" />
        <W d="M1160 300 C1155 248 1188 222 1222 222 C1260 224 1278 256 1272 292 C1262 270 1240 258 1214 260 C1190 264 1176 280 1170 310 Z" c="hair-grey" o={0.95} />
        <L d="M1160 300 C1155 248 1188 222 1222 222 C1260 224 1278 256 1272 292 M1186 236 C1204 230 1230 232 1250 244" w={2.4} />
        <L d="M1177 312 a15 11 0 1 0 30 0 a15 11 0 1 0 -30 0 M1221 310 a15 11 0 1 0 30 0 a15 11 0 1 0 -30 0 M1207 311 L1221 310 M1251 308 L1266 304" w={2} dl={0.6} />
        <L d="M1184 314 Q1192 308 1200 314 M1228 312 Q1236 306 1244 312" w={2} dl={0.7} />
        <L d="M1210 320 C1206 336 1204 344 1212 348" w={2} dl={0.7} />
        <L d="M1194 360 Q1212 376 1232 358 M1188 352 Q1186 358 1190 362 M1238 350 Q1242 356 1238 360" w={2.2} dl={0.8} />
        <circle cx="1268" cy="336" r="4" className="sc-wash" fill="var(--sc-sun)" />
      </g>
      {/* the phone, raised to show its large tiles as she scrolls */}
      <g style={{ transform: "rotate(calc(18deg - var(--p, 0) * 18deg))", ...origin(1300, 470) }}>
        <W d="M1290 460 C1330 500 1352 540 1356 570 L1330 586 C1320 556 1300 520 1270 486 Z" c="teal" o={0.95} />
        <L d="M1290 460 C1330 500 1352 540 1356 570 M1270 486 C1300 520 1320 556 1330 586" />
        <W d="M1330 586 C1350 540 1372 470 1392 430 L1414 440 C1394 482 1374 550 1356 570 Z" c="skin-3" o={0.95} />
        <L d="M1330 586 C1350 540 1372 470 1392 430 M1414 440 C1394 482 1374 550 1356 570 M1342 560 L1362 568 M1346 550 L1366 558" w={2.2} />
        <g transform="rotate(8 1410 370)">
          <rect x="1378" y="310" width="66" height="122" rx="12" className="sc-wash" fill="var(--sc-cream)" />
          <rect x="1378" y="310" width="66" height="122" rx="12" pathLength={1} className="sc-line sc-draw" style={{ strokeWidth: 2.6 }} />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={1386 + (i % 2) * 26} y={324 + Math.floor(i / 2) * 44} width="22" height="36" rx="5" fill="var(--sc-maroon)" className="sc-a-tile" style={{ animationDelay: `${i}s` }} />
          ))}
          <W d="M1388 400 C1380 380 1396 368 1410 372 C1424 380 1418 404 1402 408 Z" c="skin-3" o={0.95} />
        </g>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ 5: the morning walk */

function WalkBack() {
  return (
    <g>
      <g filter="url(#sc-wc)">
        <rect className="sc-wash" x="-40" y="-40" width="1700" height="620" fill="url(#sc-dawn)" fillOpacity={0.7} />
        <path className="sc-wash" fill="var(--sc-sage-deep)" fillOpacity={0.55} d="M-40 520 C40 400 160 360 240 420 C300 330 420 320 480 400 C560 360 620 420 640 470 L640 560 L-40 560 Z" />
        <path className="sc-wash" fill="var(--sc-sage-deep)" fillOpacity={0.5} d="M900 560 C940 420 1040 360 1120 420 C1180 330 1320 320 1380 410 C1460 360 1580 380 1660 440 L1660 560 Z" />
        <path className="sc-wash" fill="var(--sc-sage)" fillOpacity={0.7} d="M-40 560 C300 540 700 570 1000 550 C1300 530 1500 560 1660 550 L1660 960 L-40 960 Z" />
        <path className="sc-wash" fill="var(--sc-sage-deep)" fillOpacity={0.45} d="M240 600 C300 560 380 560 440 590 C520 560 600 566 660 596 C720 570 800 576 840 606 L840 640 L240 640 Z" />
        <path className="sc-wash" fill="var(--sc-cream)" fillOpacity={0.95} d="M1060 960 C1040 800 980 660 880 560 L930 560 C1060 650 1220 780 1480 960 Z" />
      </g>
      <g filter="url(#sc-rough)">
        <path className="sc-line sc-soft" d="M1060 960 C1040 800 980 660 880 560 M1480 960 C1220 780 1060 650 930 560" />
        <path className="sc-line sc-soft" d="M300 410 L304 560 M1180 400 L1176 560 M1350 420 L1356 560" />
        <path className="sc-line" d="M120 330 L120 600 M104 330 L136 330 M110 320 Q120 304 130 320" />
      </g>
    </g>
  );
}

function WalkFront() {
  return (
    <g>
      {/* the sun climbs as she scrolls */}
      <g style={{ transform: "translateY(calc(110px - var(--p, 0) * 110px))" } as CSSProperties}>
        <circle cx="760" cy="440" r="210" fill="url(#sc-sunglow)" />
        <circle cx="760" cy="440" r="46" className="sc-wash" fill="var(--sc-light)" />
      </g>
      {[[860, 520, 6], [930, 580, 4], [1010, 650, 9], [1090, 700, 5]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="var(--sc-light)" className="sc-a-twinkle" style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
      <ellipse cx="1250" cy="890" rx="80" ry="10" fill="var(--sc-ink)" fillOpacity={0.12} />
      <g className="sc-a-bob">
        {/* far arm and leg, a shade deeper */}
        <g className="sc-a-leg-a" style={origin(1250, 340)}>
          <W d="M1240 335 C1232 390 1236 440 1240 480 C1242 500 1246 515 1250 522 L1264 518 C1262 500 1262 480 1262 460 C1264 420 1262 380 1260 340 Z" c="skin-4" o={0.75} />
          <L d="M1240 335 C1232 390 1236 440 1240 480 C1242 500 1246 515 1250 522 M1260 340 C1262 380 1264 420 1262 460 C1262 480 1262 500 1264 518" soft />
        </g>
        <g className="sc-a-leg-b" style={origin(1252, 540)}>
          <W d="M1236 540 C1232 620 1236 690 1240 760 C1242 810 1240 850 1238 870 L1262 870 C1264 840 1266 800 1266 760 C1270 690 1272 610 1270 540 Z" c="slate-deep" o={0.9} />
          <L d="M1236 540 C1232 620 1236 690 1240 760 C1242 810 1240 850 1238 870 M1270 540 C1272 610 1270 690 1266 760 C1266 800 1264 840 1262 870" soft />
          <W d="M1226 868 C1220 880 1222 890 1236 890 L1272 890 C1276 880 1270 870 1262 866 Z" c="cream" o={0.9} />
          <L d="M1226 868 C1220 880 1222 890 1236 890 L1272 890 C1276 880 1270 870 1262 866 Z" w={2} />
        </g>
        {/* body */}
        <W d="M1224 495 L1280 495 C1290 520 1288 540 1280 555 L1228 555 C1220 535 1220 515 1224 495 Z" c="slate" o={0.95} />
        <L d="M1224 495 C1220 515 1220 535 1228 555 M1280 495 C1290 520 1288 540 1280 555 M1222 500 L1282 500" w={2.6} />
        <W d="M1222 430 L1282 430 C1284 460 1282 480 1278 495 L1226 495 C1222 475 1220 450 1222 430 Z" c="skin-4" o={0.9} />
        <L d="M1222 430 C1220 450 1222 475 1226 495 M1282 430 C1284 460 1282 480 1278 495" w={2.4} />
        <W d="M1215 330 C1225 322 1255 322 1275 330 C1290 370 1290 410 1282 430 L1222 430 C1212 400 1208 360 1215 330 Z" c="slate" o={0.95} />
        <L d="M1215 330 C1225 322 1255 322 1275 330 C1290 370 1290 410 1282 430 L1222 430 C1212 400 1208 360 1215 330 Z" />
        {/* near leg */}
        <g className="sc-a-leg-a" style={origin(1252, 540)}>
          <W d="M1236 540 C1232 620 1236 690 1240 760 C1242 810 1240 850 1238 870 L1262 870 C1264 840 1266 800 1266 760 C1270 690 1272 610 1270 540 Z" c="slate" o={0.95} />
          <L d="M1236 540 C1232 620 1236 690 1240 760 C1242 810 1240 850 1238 870 M1270 540 C1272 610 1270 690 1266 760 C1266 800 1264 840 1262 870" />
          <W d="M1226 868 C1220 880 1222 890 1236 890 L1272 890 C1276 880 1270 870 1262 866 Z" c="cream" o={0.95} />
          <L d="M1226 868 C1220 880 1222 890 1236 890 L1272 890 C1276 880 1270 870 1262 866 Z" w={2.2} />
        </g>
        {/* head: profile to the left, hair up in a high bun */}
        <L d="M1240 304 L1236 332 M1262 288 L1268 330" w={2.2} />
        <W d="M1270 230 C1262 205 1235 198 1215 210 C1203 218 1200 232 1202 246 L1194 262 L1202 266 C1200 276 1204 284 1210 288 C1208 296 1212 304 1222 306 C1236 308 1252 300 1262 290 C1276 276 1280 252 1270 230 Z" c="skin-4" o={0.95} />
        <L d="M1270 230 C1262 205 1235 198 1215 210 C1203 218 1200 232 1202 246 L1194 262 L1202 266 C1200 276 1204 284 1210 288 C1208 296 1212 304 1222 306 C1236 308 1252 300 1262 290 C1276 276 1280 252 1270 230 Z" />
        <W d="M1212 214 C1224 196 1258 192 1276 210 C1290 228 1288 258 1276 276 C1270 260 1262 248 1254 238 C1244 228 1228 222 1212 214 Z" c="hair-dark" o={0.95} />
        <circle cx="1274" cy="188" r="24" className="sc-wash" fill="var(--sc-hair-dark)" />
        <L d="M1250 188 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0 M1212 214 C1224 196 1258 192 1276 210" w={2.4} />
        <L d="M1216 242 Q1222 238 1228 242 M1213 232 Q1222 227 1231 231 M1206 286 Q1214 284 1218 280" w={2} dl={0.6} />
        <L d="M1252 248 C1260 244 1264 256 1256 262" soft dl={0.6} />
        <circle cx="1256" cy="268" r="3" className="sc-wash" fill="var(--sc-sun)" />
        {/* near arm, swinging against the near leg */}
        <g className="sc-a-leg-b" style={origin(1250, 340)}>
          <W d="M1240 335 C1232 390 1236 440 1240 480 C1242 500 1246 515 1250 522 L1264 518 C1262 500 1262 480 1262 460 C1264 420 1262 380 1260 340 Z" c="skin-4" o={0.95} />
          <L d="M1240 335 C1232 390 1236 440 1240 480 C1242 500 1246 515 1250 522 M1260 340 C1262 380 1264 420 1262 460 C1262 480 1262 500 1264 518" w={2.4} />
        </g>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ registry */

export interface Scene {
  id: string;
  back: () => ReactNode;
  front: () => ReactNode;
}

export const SCENES: Record<string, Scene> = {
  opening: { id: "opening", back: OpeningBack, front: () => <OpeningFront /> },
  window: { id: "window", back: WindowBack, front: WindowFront },
  kitchen: { id: "kitchen", back: KitchenBack, front: KitchenFront },
  park: { id: "park", back: ParkBack, front: ParkFront },
  walk: { id: "walk", back: WalkBack, front: WalkFront },
  closing: { id: "closing", back: OpeningBack, front: () => <OpeningFront closing /> },
};
