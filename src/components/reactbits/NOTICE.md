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

The full licence, copied verbatim from https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md on 2026-11-18:

```
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

The same restriction covers the React Bits tools (Background Studio, Texture Lab, Shape Magic, Center Stage, Sound Lab and any tools added later) and the sounds in the sound library. **You may not sell, sublicense, or redistribute the tools or the sounds themselves, or offer the tools or a substantially similar copy of them as a hosted service-whether alone, in a bundle, or as a ported version.**

What you make with the tools is yours to use. You can use exported code, images, videos, and audio files in any personal or commercial application, website, or product, including paid ones. **You may not sell or redistribute the exports on their own, either individually or as the product itself, such as a sound, texture, background, or template pack.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Colour mixing in these files was moved from sRGB to OKLCH (`color-mix(in oklch, ...)`), like the rest of the app, on 2026-11-15. The vendored heart-and-count component (`PulseHeart`) was removed on the same date because the app no longer uses it.
