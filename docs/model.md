# Where the numbers come from

The model's constants come from published measurements where they exist, not from tuning the output. `src/model/calibration.test.ts` then checks the model against independent published observations of saddle height and knee angle.

| Constant | Value | Source | Evidence |
|---|---|---|---|
| Hip joint relative to the sit bones (pelvis frame) | 0.0387 H up, 0.0178 H forward | Peng et al. 2013 (CT of 48 pelves); Seidel et al. 1995 agrees | Moderate |
| Pelvic tilt | 12° at a 55° torso, rising as the torso lowers | Sauer et al. 2007 (21 to 24° on the drops); Bressel and Larson 2003. The mapping to torso angle is ours | Weak to moderate |
| Tissue and saddle padding under the sit bones | 20 mm | Sonenblum et al. 2020 (5.6 to 32 mm, seated on foam) | Weak |
| Sit bones behind the saddle reference point | 40 mm | Assumption | None |
| Thigh, shank and ankle as fractions of stature | 0.245, 0.246, 0.039 H | Winter (Drillis and Contini); de Leva 1996 agrees | Strong |
| Crank length | 20.5% of inseam, 150 to 175 mm; the targets choose among the nearest three lengths | The ratio of a stock mid-size build (172.5 mm at an 84 cm inseam). Martin and Spirduso 2001: maximum power varies 4% from 120 to 220 mm cranks. Barratt et al. 2011: no change in joint powers from 150 to 190 mm at an optimised cadence. Ferrer-Roca et al. 2017: 5 mm more adds 1.8 to 3.4° of hip and knee flexion and no efficiency, "the shorter one might be recommended" | Calibrated; the studies only say length matters little |
| Shoes at standover | 20 mm | Assumption | None |
| Torso and arm length against leg length | −0.6 mm of torso and +0.34 mm of arm per mm of inseam beyond 0.472 × stature, within ±5% of stature | ANSUR II public data (4,082 men, 1,986 women): acromion height minus trochanterion height, and shoulder-to-grip length, regressed on crotch height and stature | Moderate (R² 0.53 with stature) |
| Knee extension band | 30 to 40° of flexion (140 to 150° included) | Ferrer-Roca et al. 2012; Millour et al. 2019; Swart and Holliday 2019 | Moderate |
| Torso, hip, shoulder and hand-load bands | per style | Anchored on stock builds of manufacturer-recommended sizes (below) | Calibrated, not research |

Sternal-notch height is not asked for: with stature and crotch height known, it lifts the torso fit only from R² 0.53 to 0.56.

Checked, not tuned: Peveler et al. 2005 (0.883 x inseam gives about 24° of static knee flexion), Bini and Hume 2016 and Millour et al. 2019 (pedalling adds about 8°), Millour et al. 2021 (30 to 40° for medium inseams).

Known gaps:

- The pedal angle through the stroke is flatter in Kautz et al. 1991 than modelled.
- ANSUR II crotch height is 0.481 of stature, not the 0.47 used to scale the legs.
- Hand load reads about 10 points above the one measured figure found (about 15% of body weight at 2 W/kg).
- Size picks are anchored on Specialized's and Trek's charts. Canyon's charts put the same rider about half a size (Ultimate) to a full size (Endurace) smaller on frames of the same dimensions, so the pick can be one size above Canyon's own advice.
- Riders under about 155 cm still score lower on the smallest frames (72 on a Tarmac 44 and 82 on a Domane 47 at the middle of their chart ranges, against 97 to 98 for mid sizes), and the tallest riders score about 90 on a Domane 62. Before cranks followed leg length the same two small frames scored 55 and 77.
- The standover estimate reads up to 38 mm high on sloping frames (the Domane). Clearance is inseam plus 20 mm for shoes minus the estimate; a frame is flagged below zero and ruled out below −40 mm.

Reaching the pedal: the foot keeps the rider's chosen ankling while it can, and points its toes (the Toes point curve) when the leg would otherwise come up short. The saddle is out of reach only when even that fails, so the limit does not depend on the ankling chosen. For a 175 cm rider with an 81 cm inseam it sits at about 750 mm, 32 mm above 0.883 × inseam.

Cranks: the score charges 0.004 per (5 mm)² a crank is longer than the proportional length and half that when shorter, enough to break ties and no more. The knee and hip angles at the top of the stroke do the rest. Find a bike fits every bike with the crank of your ideal position. On a bike you ride, a crank swap is suggested only when it gains about seven points.

Adopting the first two alone puts saddle heights about 5 cm too low, so they wait for a source that pins down the whole chain. Standover is an estimate from stack and seat tube length. Saddle height from height and inseam is good to about ±15 mm; set it finally by knee angle or feel.

## Checking it on video

Every angle the app shows is predicted from your measurements; it never sees you. To check the one that matters most, film yourself from the side on a trainer, camera level with your hip and square to the bike, and measure the knee angle with the pedal at the bottom of the stroke in a tool that lets you place the angle by hand, such as Kinovea. Fonda et al. 2014 found 2D video valid for the knee there, reading about 2° less flexion than 3D capture. Automatic pose estimation is looser: Bini et al. 2023 found OpenPose 4 to 8° from marker tracking at the hip and knee. The knee moves about 1° per 2.5 mm of saddle height, so the note under the saddle height slider (the heights that keep the knee in range) is about 24 mm wide.

Saddle moves of 10 mm or more carry a note to make them about 5 mm at a time. That is common fitting practice, not a measured threshold.

## Styles and size picks

The torso, hip, shoulder and hand-load bands of each style are centred on what the model itself reads for a stock build of the size the manufacturer recommends:

| Style | Reference build |
|---|---|
| Relaxed | Trek Domane, stock stem, −6°, 25 mm of spacers |
| Sporty | Specialized Tarmac SL8, stock stem, −6°, 20 mm of spacers |
| Aggressive | Specialized Tarmac SL8, stock stem + 10 mm, −6°, no spacers |
| Gravel | Between Sporty and Relaxed (about a Domane with 15 mm of spacers) |

Each centre is the average over the four middle sizes, for a rider at the midpoint of the size's published height range with an inseam of 0.472 × height. The model's torso line runs from the hip joint to the shoulder joint, so it reads a few degrees higher than studio figures taken from other landmarks. `src/model/sizing.test.ts` holds the reference geometry and fails if a centre drifts.

Frames grow more slowly than riders: across those size runs the same stock build reads about 0.12° less shoulder angle per cm of rider height. The shoulder bands follow that line (quoted at 175 cm), so a tall rider is not asked to reach further than any frame is built for, nor a short one less.

Each style also names where its reference build sits on a frame: Relaxed and Sporty 65% of the way up the spacers with the stock stem, Gravel 50%, Aggressive slammed with a stem 10 mm longer than stock.

Sources: Specialized's Tarmac size chart (44 to 61: 142–155, 155–163, 163–170, 170–175, 175–180, 180–188, 188–196 cm; stock stems 70, 80, 90, 100, 100, 110, 110 mm) and Trek's Domane 2019–2023 chart (47 to 62: 152–158, 158–163, 163–168, 168–174, 174–180, 180–185, 185–190, 190–195 cm; stock stems 70, 80, 90, 90, 100, 100, 110, 110 mm).

Inside the bands, a frame size moves the angles by a degree or two, so angles alone cannot tell sizes apart. For a new build (not a bike you already ride) the score therefore adds a sizing cost in two parts.

The frame, before any parts are swapped. With its stock stem at −6° a frame can put the hoods anywhere along a line from no spacers to all of them:

- 0.35 per (20 mm)² that this line passes from the rider's ideal hoods point;
- 0.08 per (20 mm)² of spacers between the nearest point on the line and where the style normally sits on it.

The build that gets the rider into position:

- 0.15 per (20 mm)² that the hoods land away from the ideal point;
- 0.2 per (20 mm)² that the stem is away from the frame's stock length, estimated as 100 + 0.45 × (effective top tube − 552 mm), between 70 and 110 mm;
- small terms for stems angled up or at −17°, and for more than 25 mm of spacers;
- 0.1 for a build that only fits with compromises.

A frame whose line passes more than 25 mm from the ideal point, or a build whose hoods land more than 30 mm from it, counts as a compromise.

What this gives, and what `sizing.test.ts` checks:

- A rider at the midpoint of any chart size of the Tarmac (Sporty and Aggressive) or the Domane (Relaxed) gets that size: 22 of 22.
- A Sporty rider in the middle of the Tarmac's 54 or 56 range sees the sizes either side at least 10 points lower and the size two down at least 40.
- A size next to the best one that scores within 3 points makes the rider between sizes; that is about one rider in six on the Tarmac and one in four on the Domane, in bands 1 to 2 cm wide where two sizes meet.
- A bike built for another style scores lower: Relaxed on a Tarmac or Sporty on a Domane lands 15 points or more below the bike built for it.
- On bikes the bands were not anchored on (Canyon Ultimate and Endurace, Giant TCR) the pick stays within one size of the maker's chart.

Angle bands, hand-load bands and body proportions live in `src/model/styles.ts`, `src/model/body.ts` and `src/model/pose.ts`.
