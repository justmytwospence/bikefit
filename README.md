# bikefit

A client-side bike fit explorer for road and gravel. Enter your body, pick a frame, then play with the fit parameters and watch the whole layout respond. Optimize moves every adjustable part towards a target riding style.

Four concepts are kept separate:

- **Body**: height, inseam, flexibility and optional segment lengths.
- **Bike**: frame geometry plus cockpit and contact dimensions.
- **Fit parameters**: the knobs (saddle height and fore/aft, seatpost setback, spacers, stem, cranks). Changing one moves the contact points relative to all the others.
- **Style**: target joint-angle bands (endurance, race, gravel). The ideal saddle and hand positions are derived from your body and shown as targets.

The Compare tab ranks all saved frames for your body and style, with the build each needs.

```sh
npm install
npm run dev     # local dev server
npm test        # model and optimizer tests
npm run check   # svelte-check
npm run build
```

Needs Node 22 (`.nvmrc`). Angle bands and body proportions are heuristics kept in `src/model/styles.ts` and `src/model/body.ts`.

A starting point, not a substitute for a professional fit.
