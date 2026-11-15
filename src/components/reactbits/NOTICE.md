# Third-party notice: React Bits

The components in this folder are vendored from **React Bits** (https://github.com/DavidHDev/react-bits),
Copyright (c) 2026 David Haz, licensed under **"MIT + Commons Clause License Condition v1.0"**.

What that means for Women360 (checked against the project's licence on 2026-11-15):

- Using, modifying and shipping these components as part of Women360, including commercially, is allowed.
- The copyright and permission notice must stay with the copied code (this file, plus the full licence text below).
- Selling, sublicensing or redistributing the components themselves (alone, bundled, or ported) is not allowed.
  Never publish this folder as a package, template or kit.

Changes made for Women360 are marked in each file with a "Women360 change" comment.

## Licence text

The full licence text is the project's `LICENSE.md`:
https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md
**Owner action:** paste that file's text here verbatim before the first public release, so the full notice ships with the code.

Colour mixing in these files was moved from sRGB to OKLCH (`color-mix(in oklch, ...)`), like the rest of the app, on 2026-11-15. The vendored heart-and-count component (`PulseHeart`) was removed on the same date because the app no longer uses it.
