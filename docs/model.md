# Where the numbers come from

The model's constants come from published measurements where they exist, not from tuning the output. `src/model/calibration.test.ts` then checks the model against independent published observations of saddle height and knee angle.

| Constant | Value | Source | Evidence |
|---|---|---|---|
| Hip joint relative to the sit bones (pelvis frame) | 0.0387 H up, 0.0178 H forward | Peng et al. 2013 (CT of 48 pelves); Seidel et al. 1995 agrees | Moderate |
| Pelvic tilt | 12° at a 55° torso, rising as the torso lowers | Sauer et al. 2007 (21 to 24° on the drops); Bressel and Larson 2003. The mapping to torso angle is ours | Weak to moderate |
| Tissue and saddle padding under the sit bones | 20 mm | Sonenblum et al. 2020 (5.6 to 32 mm, seated on foam) | Weak |
| Sit bones behind the saddle reference point | 40 mm | Assumption | None |
| Thigh, shank and ankle as fractions of stature | 0.245, 0.246, 0.039 H | Winter (Drillis and Contini); de Leva 1996 agrees | Strong |
| Knee extension band | 30 to 40° of flexion (140 to 150° included) | Ferrer-Roca et al. 2012; Millour et al. 2019; Swart and Holliday 2019 | Moderate |
| Torso, hip, shoulder and hand-load bands | per style | Anchored on stock builds of manufacturer-recommended sizes (below) | Calibrated, not research |

Checked, not tuned: Peveler et al. 2005 (0.883 x inseam gives about 24° of static knee flexion), Bini and Hume 2016 and Millour et al. 2019 (pedalling adds about 8°), Millour et al. 2021 (30 to 40° for medium inseams).

Known gaps:

- The pedal angle through the stroke is flatter in Kautz et al. 1991 than modelled.
- ANSUR II crotch height is 0.481 of stature, not the 0.47 used to scale the legs.
- Hand load reads about 10 points above the one measured figure found (about 15% of body weight at 2 W/kg).
- Riders over about 190 cm trend one size up and top out near a score of 85, because the ideal reach grows faster with height than frames do.
- The standover estimate reads up to 38 mm high on sloping frames (the Domane), so it only flags a frame below zero estimated clearance and rules one out below −40 mm.

Adopting the first two alone puts saddle heights about 5 cm too low, so they wait for a source that pins down the whole chain. Standover is an estimate from stack and seat tube length. Saddle height from height and inseam is good to about ±15 mm; set it finally by knee angle or feel.

## Styles and size picks

The torso, hip, shoulder and hand-load bands of each style are centred on what the model itself reads for a stock build of the size the manufacturer recommends:

| Style | Reference build |
|---|---|
| Relaxed | Trek Domane, stock stem, −6°, 25 mm of spacers |
| Sporty | Specialized Tarmac SL8, stock stem, −6°, 20 mm of spacers |
| Aggressive | Specialized Tarmac SL8, stock stem + 10 mm, −6°, no spacers |
| Gravel | Between Sporty and Relaxed (about a Domane with 15 mm of spacers) |

Each centre is the average over the four middle sizes, for a rider at the midpoint of the size's published height range with an inseam of 0.472 × height. The model's torso line runs from the hip joint to the shoulder joint, so it reads a few degrees higher than studio figures taken from other landmarks. `src/model/sizing.test.ts` holds the reference geometry and fails if a centre drifts.

Sources: Specialized's Tarmac size chart (44 to 61: 142–155, 155–163, 163–170, 170–175, 175–180, 180–188, 188–196 cm; stock stems 70, 80, 90, 100, 100, 110, 110 mm) and Trek's Domane 2019–2023 chart (47 to 62: 152–158, 158–163, 163–168, 168–174, 174–180, 180–185, 185–190, 190–195 cm; stock stems 70, 80, 90, 90, 100, 100, 110, 110 mm).

Inside the bands, a frame size moves the angles by a degree or two, so angles alone cannot tell sizes apart. For a new build (not a bike you already ride) the optimizer and the size ranking therefore add a sizing cost:

- 0.15 per (20 mm)² that the hoods land away from the rider's ideal hoods point;
- 0.2 per (20 mm)² that the stem is away from the frame's stock length, estimated as 100 + 0.45 × (effective top tube − 552 mm), between 70 and 110 mm;
- small terms for stems angled up or at −17°, and for more than 25 mm of spacers;
- 0.1 for a build that only fits with compromises.

Hoods more than 30 mm from the ideal point count as a compromise.

Angle bands, hand-load bands and body proportions live in `src/model/styles.ts`, `src/model/body.ts` and `src/model/pose.ts`.
