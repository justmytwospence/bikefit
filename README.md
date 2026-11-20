# bikefit

A client-side bike fit explorer for road and gravel. Enter your body, pick a frame, then play with the fit parameters and watch the whole layout respond. Optimize moves every adjustable part towards a target riding style.

Four concepts are kept separate:

- **Body**: height, inseam, flexibility and optional segment lengths.
- **Bike**: frame geometry plus cockpit and contact dimensions.
- **Fit parameters**: the knobs (saddle height and fore/aft, seatpost setback, spacers, stem, cranks). Changing one moves the contact points relative to all the others.
- **Style**: target joint-angle bands (relaxed, sporty, aggressive, gravel), anchored on stock builds of manufacturer-recommended sizes, picked under How you ride on the Rider tab or from the score. The ideal saddle and hand positions are derived from your body and shown as targets.

**Fit my bike** is the bike you ride and what to change on it. Pick the frame (one you have saved, or Choose from catalog; Duplicate, New frame of my own and Delete are in the ⋯ menu beside it). The Setup switch picks which side the settings change: Current setup is your bike as you ride it now, Target is what to change it to. Changes are counted from your current setup, and the drawing shows the other side in outline with its score beside the score pill. Optimize works out three targets from your current setup, Tools only (saddle, spacers, cleats), New parts (also stem and seatpost) and Everything (also cranks), with the score of each, and picks the smallest that gets within three points of the best; tap one to make it the target, or Current setup to go back. Once you have made the changes, I've made these changes makes the target your current setup. The lock on a setting keeps it where the target has it. Frame geometry and parts are in the section at the bottom. Sliders and part choices stop where your body could not ride the bike (foot off the pedal, knee past about 140 degrees, hands off the bars). If the setup as a whole cannot be ridden (say, after you change your inseam), one message at the top says why and offers the nearest saddle height that works, or, when no saddle height can on that frame, says it is too big and offers the largest size of the model your legs reach.

**Find a bike** ranks bikes for your body and style. All bikes checks the whole catalog (the two likeliest sizes of each model, walked outward until they stop fitting) and lists each model's best size by how close it gets you to your ideal position with the parts it is sold with, with search and brand, category, year and verdict filters. One size is marked as yours. When the size next to it scores within three points you are between sizes: the card shows how high each can put the bars against your own bar height, compares the two builds line by line, and the drawing shows one with the other in outline behind it. Saved sorts your saved frames into fits, fits with compromises (a raised stem, maxed spacers, standover that looks tight, little or a lot of seatpost, heavy toe overlap) and does not fit; saved sizes of one model share a card led by the best size. Each bike shows the build it needs, the saddle-to-bar drop and the estimated standover. Show puts a bike on the drawing with its suggested build without touching your own bike; the bar at the bottom makes it your bike or stops showing it.

The catalog (`src/data/frames/`, one JSON file per brand, each model with its source URL and a web.archive.org snapshot) holds manufacturer geometry for drop-bar bikes from 2018 on.

The settings menu (gear at the end of the tab row) exports and imports everything as `bikefit.json`, and copies a link carrying your body, setup and current frame. Opening a link asks before replacing what this browser has saved; your measurements and bikes never leave the browser otherwise. Anonymous, cookie-free usage counts go to Vercel Web Analytics and Speed Insights (`src/lib/analytics.ts` lists every event).

## Three questions

Each is asked once, in its own place, because you may want different answers to each:

- **Measurements** (Rider): height, inseam and shoe size up front, then three optional sections under More measurements (Riding effort and hands, Arms and feet, Body segments). Each opens on its own; closed, it shows a one-line summary of what it holds, estimated or entered.
- **How far to go** (Targets on Fit my bike): Tools only, New parts or Everything, each worked out by Optimize from your current setup, so you can see what new parts would buy you.
- **View** (pill on the drawing): Simple, Detailed or Expert, for how much the drawing, metric strip and results show. A Hands pill beside it switches the drawing between hoods and drops.

Frame geometry shows stack and reach until you ask for all measurements.

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

## Catalog

`src/data/frames/*.json` is generated by `pipeline/` from manufacturer geometry pages pinned in the Wayback Machine; do not edit it by hand.

- `pipeline/brands.json` lists the brands; each has an adapter in `pipeline/brands/<brand>.ts` that picks product pages and reads their geometry (brands without one only emit their hand-entered models).
- `pipeline/manifest/<brand>.json` pins every page to a snapshot timestamp and the sha256 of its bytes. `.cache/` (ignored) holds the downloaded pages.
- `npm run catalog -- pin|discover|fetch|build|check [brand]`: `pin` asks the Wayback Machine to save a few current pages, `discover` rewrites a brand's manifest from the archive, `fetch` downloads the pinned pages, `build` writes `src/data/frames/` from them offline, and `check` proves the committed data rebuilds byte-identically.
- A model's years come from its pages. A page that states a model year counts for that year (pages of Specialized, Giant, Liv, Cannondale, Cervélo, Merida, Orbea, Pinarello, Scott, Wilier, Boardman, Fuji, Jamis, Kona, Marin, Norco, Polygon, Ridley, Salsa and Vitus do, some of Felt's, Look's and Ritchey's do, Trek's did until 2023), and one stating a year before 2018 is dropped. A page that states none counts for the calendar year it was captured in; the first page of a URL counts for the model year of the URL's first capture instead (from July on, the next year), never later than the page itself.
- Pages that show the same frame become one model with a year range. Two pages show the same frame when one size list holds the other's and the shared sizes agree within 2 mm and 0.3°; one size of four or more may differ, since makers correct typos, and estimated values are not compared. Related names with the same frame merge as well: the shorter name leads (Émonda over Émonda ALR) unless one names a generation (Domane into Domane Gen 3), and two named generations never merge. Of two frames left with the same name and first year, the one more pages show is kept and the build logs the other as `duplicate`.
- Missing optional measurements are estimated from stack and listed in `estimated`.
- Hand-entered models go in `pipeline/overrides/<brand>.json` under `manual` with their source URL; one is used only when no page extracted that URL. The same file drops pages (`exclude`), renames or recategorises models (`models`) and sets years the pinned pages cannot show (`years`, each with a `note` naming its source).
- `npm test` validates every entry.

Needs Node 22 (`.nvmrc`).

## Deployment

Vercel deploys every branch from Git: `main` to https://bikefitter.app, `dev` to https://dev.bikefitter.app, and a feature branch to `https://<branch>.bikefitter.app` once `npm run preview:domain -- <branch>` has added it. CI runs the tests, svelte-check and the build on every push. AGENTS.md has the branch workflow.

## Where the numbers come from

The model's constants, their published sources, what was checked and the known gaps are in [docs/model.md](docs/model.md). Standover is an estimate from stack and seat tube length. Saddle height from height and inseam is good to about ±15 mm; set it finally by knee angle or feel.

A starting point, not a substitute for a professional fit.
