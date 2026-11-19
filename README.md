# Bleile · Glasshouses

[Play the game](https://andystats.github.io/bleile-glasshouses/)

Explore three fictional studies with a spotlight. Hover over a bug to see the concern it represents. Hold on a blue bug to apply its named repair; coral bugs remain. The corner lamp represents existing knowledge and illuminates a small patch without removing concerns.

The tally of Bleile points is a teaching metaphor for discussing causal assumptions. **Review this round**, beside each verdict, lists what is still repairable, what you repaired and what persists, with links to the matching roadmap steps (the links need an internet connection). Confounding and positivity retain separate scores. Finding a hidden concern never worsens the study. The numbers are illustrative, not a validated index or an estimate of bias.

The game is a companion to the [causal roadmap primer](https://ishuryak.github.io/causal-roadmap-primer/v2/) and [Susan's CAST story](https://ishuryak.github.io/cast_demo_website/tutorial/).

## Play or share offline

Download `index.html` and open it in a modern browser with WebGL 2 enabled. All renderer code, geometry and materials are embedded in that one file. No account or runtime network connection is needed.

Mouse: hover to inspect, then hold on blue to clear. Keyboard: use **Find next**, then hold Space. Touch: tap a bug, then hold **Neutralize**. Each press acts on one bug. Turning the spotlight off cancels a held repair. Sound is opt-in, and the game respects reduced-motion preferences.

## Edit and rebuild

Use Node.js 20 or later. Edit the files in `src/`, which are the source of truth. Do not edit the generated HTML directly.

```sh
npm ci
npm test
npm run build
```

The build preserves the source and writes identical `index.html` and `Bleile-in-the-Light.html` files. Three.js 0.187.0 is bundled locally; its license is embedded in the HTML and included in `THIRD_PARTY_LICENSES.txt`.

GitHub Pages serves `index.html` from the root of `main`. Commit the rebuilt HTML with source changes. Local review artifacts and earlier prototypes are excluded from publication.

## Rendering

WebGL provides physically based materials and shadow mapping. Clear panes keep the interior readable. A continuous shader mask hides each bug fragment outside the spotlight and corner lamp; conservative geometry bounds prevent whole bugs or legs from popping at the beam edge. The canvas follows browser display-scale changes, capped at 1.5 device pixels per CSS pixel.

The portable tests cover the study model and the one-target-per-press controller. Browser review additionally checks real pointer and touch interaction, all available repairs, darkness outside the lights, changing display scale, and WebGL failure handling.
