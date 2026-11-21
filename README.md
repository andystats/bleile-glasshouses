# Bleile · Glasshouses

[Play the game](https://andystats.github.io/bleile-glasshouses/)

Explore three fictional studies with a spotlight. Hover over a bug to see the concern it represents. Hold on a blue bug to apply its named repair; coral bugs remain. The corner lamp represents existing knowledge and illuminates a small patch without removing concerns.

The tally of Bleile points is a teaching metaphor for discussing causal assumptions. **Review this round**, beside each verdict, lists what is still repairable, what you repaired and what persists, with links to the matching roadmap steps (the links need an internet connection). Confounding and positivity retain separate scores. Finding a hidden concern never worsens the study. The numbers are illustrative, not a validated index or an estimate of bias.

The game is a companion to the [causal roadmap primer](https://ishuryak.github.io/causal-roadmap-primer/v2/) and [Susan's CAST story](https://ishuryak.github.io/cast_demo_website/tutorial/).

## Prediction prototype

Add `?predict` to the address to try predicting before the reveal, in the records house only. Bugs there stay pale until predicted. Inspect one, read its short neutral finding, and predict blue or coral: one prediction settles every bug with that finding, so the 24 bugs take 13 predictions. The study's reason then appears as feedback, and repairs work as before. **Review this round** lists the findings you have not predicted yet without giving them away, and counts your predictions. Without `?predict` the game is unchanged. The findings are draft wording: each records story has a `finding` in `src/game-content.js`.

## Play or share offline

Download `index.html` and open it in a modern browser with WebGL 2 enabled. All renderer code, geometry and materials are embedded in that one file. No account or runtime network connection is needed.

Mouse: hover to inspect, then hold on blue to clear. Keyboard: use **Find next**, then hold Space. Touch: tap a bug, then hold **Neutralize**. Each press acts on one bug. Turning the spotlight off cancels a held repair. Sound is opt-in, and the game respects reduced-motion preferences.

## Edit and rebuild

Use Node.js 20 or later. Edit the files in `src/`, which are the source of truth. Do not edit the generated HTML directly.

```sh
npm ci
npm run format
npm test
npm run build
```

`npm run format` applies Prettier to the scripts, styles and tests. `src/index.html` is formatted by hand, because whitespace between inline elements is visible on the page. GitHub Actions runs the format check, the tests and the build on every pull request and on `main`, and fails when the committed `index.html` does not match `src/`.

The study wording and numbers are in `src/game-content.js`: the ten components and, for each study, its verdicts and concerns. A concern's `points` is the number of bugs it puts in the house. `src/game-model.js` holds the rules and reads every study from that file. The tests pin the current totals (5, 24 and 94) and check the starting total, final total and positivity figure that the notes dialog in `src/index.html` quotes for the observational example. Update the tests and reread that paragraph when the points change.

The build preserves the source and writes identical `index.html` and `Bleile-in-the-Light.html` files. Three.js 0.187.0 is bundled locally; its license is embedded in the HTML and included in `THIRD_PARTY_LICENSES.txt`.

GitHub Pages serves `index.html` from the root of `main`. Commit the rebuilt HTML with source changes. Local review artifacts and earlier prototypes are excluded from publication.

## Rendering

WebGL provides physically based materials and shadow mapping. Clear panes keep the interior readable. A continuous shader mask hides each bug fragment outside the spotlight and corner lamp; conservative geometry bounds prevent whole bugs or legs from popping at the beam edge. The canvas follows browser display-scale changes, capped at 1.5 device pixels per CSS pixel.

The portable tests cover the study model and the one-target-per-press controller. Browser review additionally checks real pointer and touch interaction, all available repairs, darkness outside the lights, changing display scale, and WebGL failure handling.
