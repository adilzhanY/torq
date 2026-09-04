/**
 * StreakCreature: the still version of the streak character.
 *
 * The animation Adilzhan installed (`assets/Streak.json`) is a designed
 * Lottie and it belongs in the celebration modal, where a five second loop
 * is the point. Next to the day count on Home it would be noise, so the same
 * character appears there as a STILL, lifted out of the Lottie as real
 * vector by `scripts/lottie-to-svg.py` rather than screenshotted.
 *
 * Re-run that script if the animation is ever replaced:
 *   ./scripts/lottie-to-svg.py assets/Streak.json --flat --out assets/streak-creature.svg
 *
 * TIGHT VIEWBOX, measured by rasterising at 2048 px and trimming, not
 * eyeballed: the character occupies x 107.25, y 65.0, 330.25 x 380.0 of the
 * 512 box. Drawing it in the full square would leave dead air on every side
 * and make padding around it lie, which is the same trap the old streak mark
 * fell into. `size` is therefore the character's real height.
 */
import Svg, { Path } from "react-native-svg";
import { C } from "../theme";

const INK = { x: 107.25, y: 65.0, w: 330.25, h: 380.0 };
/** Width / height of the ink, for anyone laying out around it. */
export const CREATURE_ASPECT = INK.w / INK.h;

export function StreakCreature({
  size = 20,
  color = C.accent,
  /** The eyes stay dark by default: they are what make it a face. */
  eye = "#000000",
}: {
  size?: number;
  color?: string;
  eye?: string;
}) {
  return (
    <Svg
      width={size * CREATURE_ASPECT}
      height={size}
      viewBox={`${INK.x} ${INK.y} ${INK.w} ${INK.h}`}
    >
      <Path fill={color} d="M437.308,289.681C437.308,375.337 367.852,444.792 282.197,444.792C196.541,444.792 127.085,375.337 127.085,289.681C127.085,204.025 196.541,134.570 282.197,134.570C367.852,134.570 437.308,204.025 437.308,289.681C437.308,289.681 437.308,289.681 437.308,289.681Z" />
      <Path fill={color} d="M311.742,117.335C334.393,106.502 387.648,172.732 411.456,207.202C411.456,207.202 340.056,268.754 340.056,268.754C321.171,222.786 289.090,128.169 311.742,117.335C311.742,117.335 311.742,117.335 311.742,117.335Z" />
      <Path fill={color} d="M122.013,161.850C146.314,155.572 188.613,208.433 202.548,269.221C202.548,269.221 219.413,398.013 219.413,398.013C219.413,398.013 153.750,375.411 153.750,375.411C100.815,315.090 97.713,168.128 122.013,161.850C122.013,161.850 122.013,161.850 122.013,161.850Z" />
      <Path fill={color} d="M149.244,73.018C191.838,40.543 314.204,112.411 383.142,224.805C383.142,224.805 224.510,329.075 224.510,329.075C182.581,251.224 123.392,92.715 149.244,73.018C149.244,73.018 149.244,73.018 149.244,73.018Z" />
      <Path fill={eye} d="M239.923,219.069C239.923,219.069 239.923,219.069 239.923,219.069C250.805,219.069 259.619,227.883 259.619,238.765C259.619,238.765 259.619,273.235 259.619,273.235C259.619,284.117 250.805,292.931 239.923,292.931C239.923,292.931 239.923,292.931 239.923,292.931C229.040,292.931 220.226,284.117 220.226,273.235C220.226,273.235 220.226,238.765 220.226,238.765C220.226,227.883 229.040,219.069 239.923,219.069C239.923,219.069 239.923,219.069 239.923,219.069Z" />
      <Path fill={eye} d="M338.406,219.069C338.406,219.069 338.406,219.069 338.406,219.069C349.288,219.069 358.103,227.883 358.103,238.765C358.103,238.765 358.103,273.235 358.103,273.235C358.103,284.117 349.288,292.931 338.406,292.931C338.406,292.931 338.406,292.931 338.406,292.931C327.524,292.931 318.709,284.117 318.709,273.235C318.709,273.235 318.709,238.765 318.709,238.765C318.709,227.883 327.524,219.069 338.406,219.069C338.406,219.069 338.406,219.069 338.406,219.069Z" />
    </Svg>
  );
}
