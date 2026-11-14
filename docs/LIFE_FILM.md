# A Lifetime in Bloom — production brief and integration

> One garden. One life. Many stages. A lifetime of care.

**Status:** the website section is built and tested; **the footage does not exist yet.** It was not generated here: no video-generation
tool was available, and nothing was substituted for it (no still image, no CSS animation). The section stays out of the page until the real
files are in place and it is switched on (see "Switching it on").

---

## 1. What the visitor experiences

The film sits directly under the hero. As she scrolls, the screen pins (CSS `position: sticky`: the scroll bar is never taken over or blocked),
and the film's clock follows her scroll position. One quiet word names each stage. At the end the closing words hold, and the section lets go.
Scrolling up runs the film backwards.

| Scroll through the section | Film | Word on screen |
|---|---|---|
| 0 – 17% | Scene 1, childhood | *Childhood* |
| 17 – 33% | Scene 2, adolescence | *Growing* |
| 33 – 48% | Scene 3, young adulthood | *Becoming* |
| 48 – 66% | Scene 4, midlife | *Flourishing* |
| 66 – 83% | Scene 5, later adulthood | *Evolving* |
| 83 – 90% | Scene 6, older age | *A lifetime* |
| 90 – 100% | Scene 6 ends on the loop frame | **Every stage of her life matters.** / Women's health and wellbeing, considered across a lifetime. |

The section is 2.3 screens tall on landscape screens (1.3 screens of pinned scrolling) and 2.1 on phones held upright (1.1 screens).

**The loop.** Scrolling plays the film once. The film is still made to loop seamlessly (its last frame leads into its first), because that is
what makes it reusable: as an idle hero loop, in social cut-downs, at events, and so that scrolling back up from the end never feels like a seam.

## 2. Production route — choose one

1. **A real shoot (recommended for this brand).** Six performers of one family resemblance, one real garden, a gimbal or motion-control rig repeating
   the same arc for each age. This is the surest way to avoid every item on the "avoid" list, especially artificial faces and skin. Cast and contract
   carefully: a child is in the film (licensed chaperone, parental consent, no identifying details), and all performers need releases for web use.
2. **Generative video**, using an image-to-video tool that supports first-and-last-frame control and reference images. Section 6 is written for this
   route. Plan for many takes per shot; reject any shot with uncanny faces or hands rather than "fixing it in the grade".
3. **Hybrid.** Shoot the garden plates (empty garden, the full camera arc) for real; generate or shoot the character passes; composite.

Whichever route: the footage must not depict any real, identifiable person who has not agreed to it, and the licence must permit commercial use on the web.

## 3. Deliverables and technical spec

| | Landscape (wide screens) | Portrait (phones held upright) |
|---|---|---|
| Composition | 16:9, its own framing | **9:16, composed for the tall frame**: not a crop of the wide film |
| Master | 3840×2160, ProRes 422 HQ (or better), 24 fps | 2160×3840, ProRes 422 HQ, 24 fps |
| Web file 1 | `life-landscape.mp4`: H.264 High, 1920×1080 | `life-portrait.mp4`: H.264 High, 1080×1920 |
| Web file 2 | `life-landscape.webm`: VP9, 1920×1080 | `life-portrait.webm`: VP9, 1080×1920 |
| Poster | `poster-landscape.jpg`: frame 0, 1920×1080 | `poster-portrait.jpg`: frame 0, 1080×1920 |
| Size budget | MP4 ≤ 12 MB, WebM ≤ 10 MB | MP4 ≤ 7 MB, WebM ≤ 6 MB |

- **Length: exactly 14.5 s = 348 frames at 24 fps**, scene lengths as in section 5. If the edit must change, change `SCENES` in
  `src/content/lifeFilm.ts` to match (the tests require whole frames).
- **No audio track** (it is always muted), **no text, no logos** in the picture: the words are drawn by the page so they stay sharp, translatable and readable by screen readers.
- **Keep the bottom 35% calm.** The stage words and the headline sit at the lower left (lower edge, centred-left on phones) over a soft darkening gradient.
  Avoid faces, bright highlights or key action there in the final 10% of the film.
- **Dense keyframes** (every 6 frames, no B-frames) so the film can be scrubbed frame by frame without stutter: see the encoding commands in section 8.
- Colour: Rec.709, gentle contrast, no crushed blacks. Subtle, real-looking 35 mm grain is welcome (it also hides compression banding).

## 4. Continuity bible

**The woman.** One person across a lifetime. Fix these across all six ages:
- Warm medium-brown skin; dark brown almond-shaped eyes; a small mole just above the left eyebrow (the continuity mark).
- Hair: dark, thick and wavy; worn loose as a child, gathered low later; first grey at temples in midlife, silver-white in older age. Same hairline and parting.
- Build: slim to average, natural; no glamour styling at any age. Natural skin texture at every age, with real lines in later life. No smoothing filters.
- **One thin silver bangle on the left wrist in every scene** (small on the child, the same design throughout). It carries the final match cut.
- Expression range: curious → composed → confident → easy → content → serene. Never mournful, never performative.

**Clothing.** One colour story so the stages read as one life: ivory, soft sage and a little muted clay. Simple natural cotton and linen at every age,
no logos, nothing branded, nothing that dates the film to a year.
- Child: ivory cotton frock with a sage hem, barefoot.
- Adolescent: ivory cotton top, sage skirt or loose trousers, simple sandals.
- Twenties: ivory linen shirt, clay trousers, sandals.
- Forties: sage cotton dress or kurta, light cardigan over the shoulders.
- Sixties/seventies: soft ivory cotton, a light shawl.
- Older age: ivory and sage, a fine wool shawl; slow, sure steps (a walking stick is fine if it is hers, not a prop of frailty).

Avoid stereotyped signs of adulthood (wedding imagery, babies, handbags, phones, laptops, aprons).

**The garden.** A real, lived-in garden, not a fantasy: a lawn, a curving path of worn stone or packed earth, mixed borders, a few older trees, and at
its heart **one large flowering tree** (pale pink or white blossom: kachnar/Bauhinia, magnolia or a cherry — choose what grows where you shoot). The path curves
around the tree; the whole film travels about three-quarters of the way around it, so the last framing echoes the first.
- Same geography, same tree, same path, same direction of travel (she always moves left to right in frame) in every scene.
- Seasons turn gently: late spring (child) → early summer → high summer → early autumn → late autumn → early spring blossom (older age), which leads naturally
  back to the child's late spring.
- Light moves through one day as well as the seasons: soft morning → warm late morning → bright midday → warm afternoon → low golden light → soft morning again.

**The camera.** One continuous move, as if it never stopped: a side-tracking dolly at about the subject's chest height, slightly behind her shoulder line,
following the curve. Long lens look (50–85 mm equivalent), shallow but not dreamy depth of field. The camera's speed follows hers: brisk for the child,
slowing with each stage, and in older age it moves closer and almost settles. No handheld shake, no whip pans, no drones, no cuts that read as cuts.

**Her pace** (for the edit and for any retiming): child running ≈ 3.5 m/s → adolescent ≈ 3 m/s → twenties ≈ 2.6 m/s (light running) → forties jog
then walk ≈ 1.6 m/s → sixties/seventies walk ≈ 1.1 m/s → older age ≈ 0.8 m/s, pausing.

## 5. The six scenes

Frame numbers are for the finished 348-frame film. Each scene **ends on its bridge** into the next.

| # | Frames | Seconds | Who | What happens | Bridge into next scene |
|---|---|---|---|---|---|
| 1 | 0 – 59 | 2.5 | Girl, 6–8 | Runs barefoot along the curve, hair and frock moving, looks up at the leaves. Morning sun through foliage. | She passes behind the **trunk of a foreground tree** (frames 52–59). |
| 2 | 60 – 113 | 2.25 | Adolescent | Emerges from behind the trunk older, running more composedly. Flowers opening; warmer light. | **Tall foreground flower heads** sweep across the lens (106–113). |
| 3 | 114 – 167 | 2.25 | Twenties | Through the flowers: a young woman, confident and energetic. Garden fuller, high summer. | **Sunlight flare through branches** briefly blooms the frame (160–167), never blown out. |
| 4 | 168 – 227 | 2.5 | Forties | Light settles: she slows from a jog to a relaxed walk; a few leaves fall. Soft, warm. | She passes behind **a second foreground trunk** (220–227). |
| 5 | 228 – 287 | 2.5 | Sixties/seventies | Walking slowly, peaceful; she touches a flower as she passes (the hand with the bangle, in close shot). Camera slows and closes in. | **Her hand leaves the flower** as the camera drifts on (280–287). |
| 6 | 288 – 347 | 2.5 | Older age | Walks to the flowering tree, pauses, looks across the garden and smiles a little. A **single blossom drifts across the lens** (330–347). | **Loop**: the blossom clears to reveal frame 0 (the girl, same framing). |

**The loop rule.** Frame 347 and frame 0 must match in camera position, lens, light direction and colour. The safest method: the blossom fills the frame
at 344–347, and frame 0 is the same blossom leaving the frame from the child's scene. Check it by playing the film on loop in an editor and looking for any jump.
An alternative bridge that also works: a match cut from the older woman's hand (with the bangle) touching the blossom to the child's hand (with the bangle)
reaching for a leaf.

**Transitions must be organic.** The age change happens while she is hidden by something in the garden (a trunk, flowers, light), never as a dissolve
on her face, and never as a morph. On either side of a bridge the camera, lighting, path and her screen position must continue seamlessly.

## 6. Generation prompts (generative route)

Use reference images for the woman at each age and for the garden, generated first and approved before any video. Generate each scene as its own clip
using **first-frame and last-frame control**, with the last frame of scene N being the first frame of scene N+1 (the bridge frame, where she is hidden).

**Style prefix (use for every shot):**

> Cinematic, photorealistic live-action footage, shot on a full-frame cinema camera with a 65 mm lens at T2.8, 24 fps, natural light, gentle
> film grain, Rec.709, soft contrast, realistic skin texture with pores and fine lines, natural hair movement, a real lived-in garden with a lawn,
> mixed borders and a curving worn stone path around a large tree with pale pink blossom; smooth side-tracking dolly shot at chest height following
> the subject left to right along the curve; understated, editorial, timeless, luxury healthcare campaign; no text, no logos.

**Negative prompt (use for every shot):**

> cartoon, animation, CGI look, plastic skin, airbrushed skin, uncanny face, distorted hands, extra fingers, warped limbs, oversaturated colours,
> fantasy landscape, glowing particles, lens flare streaks, dramatic storm light, fast cuts, handheld shake, drone shot, text, watermark, logo,
> stock-footage look, slow-motion sparkle, crowd, other people, mobile phone, modern buildings, cars.

**Character tokens** (append to each shot, adjusting the age line): *one South Asian woman (the same person throughout her life), warm medium-brown skin,
dark brown almond eyes, a small mole above the left eyebrow, thick dark wavy hair, a thin silver bangle on the left wrist, ivory, sage and clay cotton clothing.*

| Scene | Shot prompt (after the prefix and character tokens) | First frame | Last frame |
|---|---|---|---|
| 1 | A girl of about seven runs barefoot along the curving path in late-spring morning light, ivory cotton frock with a sage hem, hair loose and moving, looking up at sunlight through leaves, joyful and curious; the camera tracks beside her. | Loop frame: girl entering left third, blossom just clearing the lens. | She is hidden behind a dark foreground tree trunk at frame centre. |
| 2 | Emerging from behind the trunk, a girl of about fourteen runs more composedly along the same path, ivory top and sage skirt, early summer, flowers opening, warmer light. | Same as scene 1 last frame. | Tall foreground flower heads sweep across and fill the lens. |
| 3 | Through the flowers, a woman in her twenties runs lightly and confidently along the same path, ivory linen shirt, clay trousers, high summer, full and vibrant garden. | Same as scene 2 last frame. | Warm sunlight through branches briefly fills the frame, soft, not blown out. |
| 4 | A woman in her forties along the same path, early autumn, slowing from a gentle jog to a relaxed walk, sage dress, cardigan over shoulders, a few leaves falling, soft warm light, a first touch of grey at her temples. | Same as scene 3 last frame. | She passes behind a second foreground tree trunk. |
| 5 | A woman in her late sixties walks slowly along the same path in low golden late-autumn light, ivory cotton and a light shawl, peaceful; she touches a flower with her left hand, the silver bangle visible; the camera slows and moves closer. | Same as scene 4 last frame. | Her hand leaves the flower; the camera drifts on along the path. |
| 6 | An elderly woman, about eighty, silver-white hair gathered low, fine wool shawl, walks slowly to the large blossoming tree in soft early-spring morning light, pauses, looks across the garden and smiles subtly; a single pale blossom drifts across the lens. | Same as scene 5 last frame. | The blossom fills the frame, then clears to the exact framing of scene 1 frame 0. |

Make the **portrait composition** as its own set of shots with the same prompts plus: *vertical 9:16 framing, subject kept in the upper-middle third,
the path receding up the frame, camera tracking with a slight upward tilt; keep the lower third calm foliage and lawn.*

## 7. Assembly

1. **Conform** each scene to its exact frame range (section 5). Retime with optical flow only where pace needs smoothing; never speed-ramp visibly.
2. **Bridges:** cut on the occluding frame, then refine with a 4–8 frame wipe following the occluding object (trunk, flowers, flare, blossom) so the
   age change is never seen. Match camera position across the cut with a subtle stabilise/reposition.
3. **Grade** as one film: a single base look, then gentle per-scene adjustments that carry the season and time of day. Keep skin natural.
4. **Grain and finishing:** one grain layer over the whole film; deflicker if needed; no vignette that would fight the page's own darkening gradient.
5. **Loop check:** play on loop for a minute; there must be no visible jump between frames 347 and 0.
6. **Both compositions** go through the same steps, so the story beats land on the same frames in both.
7. Export the ProRes masters, then encode (section 8).

## 8. Encoding (tested commands)

Dense keyframes make scrubbing smooth. These were run successfully with FFmpeg 7 on a sample; adjust `-crf` (higher = smaller) to meet the size budget.

```bash
# Landscape MP4 (H.264): keyframe every 6 frames, no B-frames, web-optimised start
ffmpeg -i master-landscape.mov -vf "scale=1920:1080:flags=lanczos,format=yuv420p" -c:v libx264 -profile:v high -preset slow -crf 23 -g 6 -keyint_min 6 -sc_threshold 0 -bf 0 -movflags +faststart -an life-landscape.mp4
```

```bash
# Landscape WebM (VP9)
ffmpeg -i master-landscape.mov -vf "scale=1920:1080:flags=lanczos,format=yuv420p" -c:v libvpx-vp9 -crf 34 -b:v 0 -g 6 -row-mt 1 -deadline good -cpu-used 2 -an life-landscape.webm
```

```bash
# Posters: frame 0 (the loop frame)
ffmpeg -i master-landscape.mov -vf "select=eq(n\,0),scale=1920:1080" -frames:v 1 -q:v 4 poster-landscape.jpg
```

Repeat for portrait with `scale=1080:1920` and the `portrait` file names. Check the result:

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_frames -show_entries format=duration -of default=nw=1 life-landscape.mp4
```

Expect 348 frames, 24 fps, 14.5 s.

## 9. Switching it on

1. Put the eight files in `public/film/`: `life-landscape.mp4`, `life-landscape.webm`, `poster-landscape.jpg`, `life-portrait.mp4`, `life-portrait.webm`, `poster-portrait.jpg`
   (the webm files are optional; the mp4 is required).
2. Run the film's browser tests against the real footage: `FILM_DIR=public/film npx playwright test e2e/13-film.spec.ts`.
3. Look at it yourself on a laptop, a phone (upright and sideways) and a tablet, scrolling slowly and quickly, forwards and back.
4. Set `VITE_LIFE_FILM=on` in the Vercel project's environment and redeploy. Without it the section is not part of the page.
5. Add a release-notes entry once it is live (`src/content/releaseNotes.ts`).

Hosting: Vercel serves the files with range requests (needed for seeking) and `vercel.json` caches `/film/*` for a week. If you replace the film, give the
new files new names (and update `FILM_FILES` in `src/content/lifeFilm.ts`) so returning visitors don't see a cached old cut.

## 10. How the section is built (for developers)

- `src/content/lifeFilm.ts` — file paths, scene lengths, words, scroll length. `src/lib/filmScrub.ts` — the maths (pure, unit-tested).
- `src/features/landing/LifeFilm.tsx` — the section. A `sticky` screen inside a section 2.3 (or 2.1) screens tall; a `requestAnimationFrame` loop reads
  the section's position, eases the film's clock towards it (`approach`), seeks only when it is more than half a frame away and never while a seek is pending,
  and **stops as soon as it arrives** (no work, no battery, while she is still). Words and the headline are cross-faded from the same progress value.
- **Loading:** nothing is fetched while the page itself loads; after that, only when the film is within half a screen. Poster first, then video, which fades
  in once its first frame is decoded. The pinned screen has a fixed height from the start, so nothing shifts.
- **Phones:** an upright screen (taller than wide) gets the portrait composition; turning it switches. Heights use `svh`, so the address bar doesn't make it jump.
- **Reduced motion or data saver:** a still version (poster, headline, supporting line, the stage words) with no video download and no pinning.
- **Missing files:** the section removes itself; the rest of the page is unaffected.
- **Accessibility:** the video is muted and hidden from assistive technology; a visually hidden heading, description and ordered list of the stages tell the
  story in words; a "Skip the film" link is the section's one Tab stop; no scroll locking. Audited with axe in the browser tests.
- **Tests:** `e2e/13-film.spec.ts` (pinning, forward and backward scrubbing, words in order, release, loading strategy, phones and tablets in both orientations,
  reduced motion, data saver, missing files, no layout shift, no work while still, accessibility) runs against small synthetic test-pattern clips in
  `e2e/fixtures/film/`, which exist only for testing.

## 11. Notes for whoever signs it off

- Women360 accounts are for adults (18+). The childhood scenes are the life-story metaphor the brief asks for, not a sign that the app is for children;
  the landing page copy around the film says nothing to the contrary, and it should stay that way.
- The landing page's own rule is "add a section only by removing one". This section was added at the owner's request; if the page starts to feel long,
  the Senior Mode panel's heading ("Made for every stage, from 18 to 100") overlaps the film's message most and is the first candidate to shorten.
- Check the closing words over the final frames of the real footage for contrast; the page darkens the lower part, but footage varies.
