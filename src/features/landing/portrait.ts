// The landing hero's portrait, drawn in code so it can be recoloured for the
// light and dark themes and needs no image file, licence or network request.
// It's an elegant bust — long wavy hair framing a quiet face, bare shoulders, a
// fine pendant — rendered as an SVG data URI for DitherVeil, which stipples it
// and lets the real colours show through under the cursor.

interface Palette {
  bg: string;
  halo: string;
  hairTop: string;
  hairBottom: string;
  hairBack: string;
  hairHighlight: string;
  skinLight: string;
  skinMid: string;
  skinShade: string;
  blush: string;
  feature: string;
  lips: string;
  garmentTop: string;
  garmentBottom: string;
  chain: string;
}

const LIGHT: Palette = {
  bg: "#FBF8F4",
  halo: "#F3E1E6",
  hairTop: "#6B1D30",
  hairBottom: "#2A0910",
  hairBack: "#3D0F1A",
  hairHighlight: "#9A2C45",
  skinLight: "#F8DDD6",
  skinMid: "#EDBDB3",
  skinShade: "#D58E8A",
  blush: "#E58C94",
  feature: "#6B1D30",
  lips: "#B85468",
  garmentTop: "#82233A",
  garmentBottom: "#3D0F1A",
  chain: "#D0899A",
};

const DARK: Palette = {
  bg: "#15100E",
  halo: "#3A1A24",
  hairTop: "#E6BFC9",
  hairBottom: "#B85468",
  hairBack: "#9A2C45",
  hairHighlight: "#F8E8EC",
  skinLight: "#F8E8EC",
  skinMid: "#EDC9CF",
  skinShade: "#D0899A",
  blush: "#D0899A",
  feature: "#521626",
  lips: "#82233A",
  garmentTop: "#D0899A",
  garmentBottom: "#82233A",
  chain: "#F3E1E6",
};

function svg(p: Palette): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs>
  <radialGradient id="halo" cx="400" cy="400" r="400" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${p.halo}"/><stop offset="1" stop-color="${p.bg}"/>
  </radialGradient>
  <linearGradient id="hairFront" x1="0" y1="150" x2="0" y2="820" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${p.hairTop}"/><stop offset="1" stop-color="${p.hairBottom}"/>
  </linearGradient>
  <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${p.skinLight}"/><stop offset="1" stop-color="${p.skinMid}"/>
  </linearGradient>
  <radialGradient id="face" cx="400" cy="320" r="190" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${p.skinLight}"/><stop offset="0.75" stop-color="${p.skinMid}"/><stop offset="1" stop-color="${p.skinShade}"/>
  </radialGradient>
  <linearGradient id="neck" x1="340" y1="0" x2="460" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${p.skinShade}"/><stop offset="0.35" stop-color="${p.skinMid}"/><stop offset="0.65" stop-color="${p.skinMid}"/><stop offset="1" stop-color="${p.skinShade}"/>
  </linearGradient>
  <clipPath id="neckClip"><path d="M358 430 C360 500 356 542 340 584 L460 584 C444 542 440 500 442 430 Z"/></clipPath>
  <radialGradient id="chinShadow" cx="400" cy="470" r="80" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${p.skinShade}" stop-opacity="0.85"/><stop offset="1" stop-color="${p.skinShade}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="cheek" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${p.blush}" stop-opacity="0.55"/><stop offset="1" stop-color="${p.blush}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="garment" x1="0" y1="690" x2="0" y2="1000" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${p.garmentTop}"/><stop offset="1" stop-color="${p.garmentBottom}"/>
  </linearGradient>
  <g id="hairHalf">
    <path fill="url(#hairFront)" d="M400 168 C330 166 262 214 252 320 C246 395 262 450 248 520 C236 580 196 620 188 700 C182 762 214 802 264 808 C232 762 262 722 288 692 C314 652 308 602 302 562 C298 522 294 482 298 442 C302 402 306 342 324 302 C346 256 380 218 400 206 Z"/>
    <path fill="none" stroke="${p.hairHighlight}" stroke-opacity="0.55" stroke-width="5" stroke-linecap="round" d="M394 186 C332 192 288 252 280 340"/>
    <path fill="none" stroke="${p.hairHighlight}" stroke-opacity="0.45" stroke-width="4" stroke-linecap="round" d="M300 388 C292 456 270 526 250 604 C236 664 224 704 230 762"/>
    <path fill="none" stroke="${p.hairHighlight}" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round" d="M268 470 C256 540 222 600 212 676"/>
  </g>
</defs>

<rect width="800" height="1000" fill="${p.bg}"/>
<circle cx="400" cy="400" r="400" fill="url(#halo)"/>

<!-- hair behind the head and shoulders -->
<path fill="${p.hairBack}" d="M400 160 C280 160 250 264 254 384 C258 470 226 560 204 650 C190 716 204 780 252 806 L548 806 C596 780 610 716 596 650 C574 560 542 470 546 384 C550 264 520 160 400 160 Z"/>

<!-- shoulders, then the neck over the join -->
<path fill="url(#skin)" d="M340 584 C290 606 200 626 150 702 C110 764 96 884 92 1000 L708 1000 C704 884 690 764 650 702 C600 626 510 606 460 584 Z"/>
<path fill="url(#neck)" d="M358 430 C360 500 356 542 340 584 L460 584 C444 542 440 500 442 430 Z"/>
<ellipse cx="400" cy="462" rx="70" ry="34" fill="url(#chinShadow)" clip-path="url(#neckClip)"/>
<path fill="none" stroke="${p.skinShade}" stroke-opacity="0.55" stroke-width="4" stroke-linecap="round" d="M322 636 C352 652 380 650 398 640 M478 636 C448 652 420 650 402 640"/>

<!-- dress -->
<path fill="url(#garment)" d="M162 694 C250 646 330 712 400 712 C470 712 550 646 638 694 C680 764 696 884 700 1000 L100 1000 C104 884 120 764 162 694 Z"/>

<!-- face -->
<path fill="url(#face)" d="M295 320 C295 215 345 190 400 190 C455 190 505 215 505 320 C505 400 455 470 400 482 C345 470 295 400 295 320 Z"/>
<ellipse cx="344" cy="384" rx="44" ry="26" fill="url(#cheek)"/>
<ellipse cx="456" cy="384" rx="44" ry="26" fill="url(#cheek)"/>

<!-- features: brows, closed eyes, nose, lips -->
<g fill="none" stroke="${p.feature}" stroke-linecap="round" stroke-linejoin="round">
  <path stroke-width="4.5" stroke-opacity="0.85" d="M338 286 C354 274 380 274 393 282 M407 282 C420 274 446 274 462 286"/>
  <path stroke-width="4" d="M344 314 C358 326 380 326 392 314 M408 314 C420 326 442 326 456 314"/>
  <path stroke-width="3" stroke-opacity="0.8" d="M346 316 L338 322 M358 322 L354 330 M380 324 L380 332 M454 316 L462 322 M442 322 L446 330 M420 324 L420 332"/>
  <path stroke="${p.skinShade}" stroke-width="3" stroke-opacity="0.8" d="M401 326 C397 350 392 366 398 376 C402 380 410 378 412 372"/>
</g>
<path fill="${p.lips}" d="M370 420 C384 411 394 412 400 417 C406 412 416 411 430 420 C419 440 381 440 370 420 Z"/>
<path fill="none" stroke="${p.feature}" stroke-opacity="0.6" stroke-width="2.5" stroke-linecap="round" d="M372 421 C388 426 412 426 428 421"/>

<!-- hair in front: a side-parted wave on each side -->
<use href="#hairHalf"/>
<use href="#hairHalf" transform="translate(800 0) scale(-1 1)"/>

<!-- pendant -->
<path fill="none" stroke="${p.chain}" stroke-width="3" stroke-linecap="round" d="M338 602 C366 690 434 690 462 602"/>
<circle cx="400" cy="676" r="9" fill="${p.chain}"/>
</svg>`;
}

export function portraitDataUri(dark: boolean): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(dark ? DARK : LIGHT))}`;
}
