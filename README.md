# bikefit

A client-side bike fit explorer for road and gravel. Enter your body, pick a frame, then play with the fit parameters and watch the whole layout respond. Optimize moves every adjustable part towards a target riding style.

Four concepts are kept separate:

- **Body**: height, inseam, flexibility and optional segment lengths.
- **Bike**: frame geometry plus cockpit and contact dimensions.
- **Fit parameters**: the knobs (saddle height and fore/aft, seatpost setback, spacers, stem, cranks). Changing one moves the contact points relative to all the others.
- **Style**: target joint-angle bands (endurance, race, gravel). The ideal saddle and hand positions are derived from your body and shown as targets.

The Compare tab ranks all saved frames for your body and style, with the build each needs.

## Detail levels

Every section (Rider, Bike, Setup, Results) has a Simple, Detailed and Expert level, set globally from the header menu and overridable per section. Inputs are things you can measure or already know; hidden inputs keep their estimated or entered values. At Simple, Optimize only changes the visible setup knobs (saddle height and setback, spacers, stem).

## What is modelled

Feet (shoe size, cleat position, ankling), pelvic tilt, effective seat angle, hand load at your effort level (a whole-body balance estimate), knee angle at the top of the stroke, a second drops pose, toe overlap and contact-point readouts. Knee-over-pedal is shown for information only.

The rider is drawn as a technical line diagram of the fit model's skeleton, like a fit-studio motion-capture view.

```sh
npm install
npm run dev     # local dev server
npm test        # model and optimizer tests
npm run check   # svelte-check
npm run build
```

Needs Node 22 (`.nvmrc`). Angle bands, hand-load bands and body proportions are heuristics kept in `src/model/styles.ts`, `src/model/body.ts` and `src/model/pose.ts`.

A starting point, not a substitute for a professional fit.
