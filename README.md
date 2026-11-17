# bikefit

A client-side bike fit explorer for road and gravel. Enter your body, pick a frame, then play with the fit parameters and watch the whole layout respond. Optimize moves every adjustable part towards a target riding style.

Four concepts are kept separate:

- **Body**: height, inseam, flexibility and optional segment lengths.
- **Bike**: frame geometry plus cockpit and contact dimensions.
- **Fit parameters**: the knobs (saddle height and fore/aft, seatpost setback, spacers, stem, cranks). Changing one moves the contact points relative to all the others.
- **Style**: target joint-angle bands (relaxed, sporty, aggressive, gravel), picked under How you ride on the Rider tab, on Compare, or from the score. The ideal saddle and hand positions are derived from your body and shown as targets.

The Fit tab starts as a new build: Optimize suggests the whole setup for the frame. Switch to My current setup (or press Mark as my setup) and changes are counted from your setup, with Optimize preferring adjustments over new parts. When the frame came from the catalog, Optimize also tries the model's other sizes and says if one fits better; tap a size to switch to it.

The Compare tab sorts all saved frames into three groups for your body and style: fits, fits with compromises (a raised stem, maxed spacers, tight standover, little or a lot of seatpost, heavy toe overlap) and does not fit. Each frame shows the build it needs, the saddle-to-bar drop and the estimated standover. Saved sizes of one model share a card led by the best size. All bikes checks the whole catalog (the two likeliest sizes of each model) and lists what fits, ranked by fit score, with search and brand, category and verdict filters; New build in Fit links to it.

Find a bike (Bike tab) searches a bundled catalog of manufacturer geometry (`src/data/frames/`, one JSON file per brand, each model with its source URL) and copies a size, or every size, into your saved frames.

The settings menu (gear at the end of the tab row) exports and imports everything as `bikefit.json`, and copies a link carrying your body, setup and current frame. Opening a link asks before replacing what this browser has saved; nothing leaves the browser otherwise.

## Detail levels

Each tab asks its own question. Rider has Simple, Detailed and Expert, for how much you have measured; hidden inputs keep their estimated or entered values. Bike shows stack and reach until you ask for all measurements. Fit asks what you can change: Tools only (saddle, spacers, cleats), New parts (also stem and seatpost) or Everything (also cranks). Optimize leaves the rest as it is, and the lock on each part makes your own mix. The Simple, Detailed and Expert switch on the drawing sets how much the drawing, metric strip and results show.

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

To add a frame model, edit its brand's file in `src/data/frames/`; `npm test` validates every entry.

Needs Node 22 (`.nvmrc`). Angle bands, hand-load bands and body proportions live in `src/model/styles.ts`, `src/model/body.ts` and `src/model/pose.ts`.

## Where the numbers come from

The model's constants come from published measurements where they exist, not from tuning the output. `src/model/calibration.test.ts` then checks the model against independent published observations of saddle height and knee angle.

| Constant | Value | Source | Evidence |
|---|---|---|---|
| Hip joint relative to the sit bones (pelvis frame) | 0.0387 H up, 0.0178 H forward | Peng et al. 2013 (CT of 48 pelves); Seidel et al. 1995 agrees | Moderate |
| Pelvic tilt | 12° at a 55° torso, rising as the torso lowers | Sauer et al. 2007 (21 to 24° on the drops); Bressel and Larson 2003. The mapping to torso angle is ours | Weak to moderate |
| Tissue and saddle padding under the sit bones | 20 mm | Sonenblum et al. 2020 (5.6 to 32 mm, seated on foam) | Weak |
| Sit bones behind the saddle reference point | 40 mm | Assumption | None |
| Thigh, shank and ankle as fractions of stature | 0.245, 0.246, 0.039 H | Winter (Drillis and Contini); de Leva 1996 agrees | Strong |
| Knee extension band | 30 to 40° of flexion (140 to 150° included) | Ferrer-Roca et al. 2012; Millour et al. 2019; Swart and Holliday 2019 | Moderate |
| Torso, hip and shoulder bands | per style | Fitting practice (Burt 2014; Pruitt) | Not research |

Checked, not tuned: Peveler et al. 2005 (0.883 x inseam gives about 24° of static knee flexion), Bini and Hume 2016 and Millour et al. 2019 (pedalling adds about 8°), Millour et al. 2021 (30 to 40° for medium inseams).

Known gaps:

- The pedal angle through the stroke is flatter in Kautz et al. 1991 than modelled.
- ANSUR II crotch height is 0.481 of stature, not the 0.47 used to scale the legs.
- Hand load reads about 10 points above the one measured figure found (about 15% of body weight at 2 W/kg).

Adopting the first two alone puts saddle heights about 5 cm too low, so they wait for a source that pins down the whole chain. Standover is an estimate from stack and seat tube length. Saddle height from height and inseam is good to about ±15 mm; set it finally by knee angle or feel.

A starting point, not a substitute for a professional fit.
