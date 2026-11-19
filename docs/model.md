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

Adopting the first two alone puts saddle heights about 5 cm too low, so they wait for a source that pins down the whole chain. Standover is an estimate from stack and seat tube length. Saddle height from height and inseam is good to about ±15 mm; set it finally by knee angle or feel.

Angle bands, hand-load bands and body proportions live in `src/model/styles.ts`, `src/model/body.ts` and `src/model/pose.ts`.
