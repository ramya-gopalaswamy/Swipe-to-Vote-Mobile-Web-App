/** Shared thresholds: pull-down on swipe surface → Results tab. */
export const PULL_RESULTS_DY_MIN = 22
/** Net downward movement must exceed horizontal drift by this many px. */
export const PULL_RESULTS_DOWN_VS_HORIZONTAL = 8
/**
 * Downward flick (px/s) — helps Chrome / fast releases where final offset undershoots.
 */
export const PULL_RESULTS_VELOCITY_Y_MIN = 360

/**
 * @param {object} opts
 * @param {number} opts.dx — horizontal drag vs start (Framer offset.x)
 * @param {number} opts.dy — max of net / peak downward offset (screen +y)
 * @param {number} [opts.dyTravel] — sum of positive `delta.y` during drag (Chrome-friendly)
 * @param {number} [opts.velocityY] — PanInfo.velocity.y at drag end
 * @param {number} opts.commitThreshold — same as swipe yes/no commit
 */
export function shouldOpenResultsPull({
  dx,
  dy,
  dyTravel = 0,
  velocityY = 0,
  commitThreshold,
}) {
  if (Math.abs(dx) >= commitThreshold) {
    return false
  }

  const effectiveDy = Math.max(dy, dyTravel)

  const deliberateDown =
    effectiveDy >= PULL_RESULTS_DY_MIN &&
    effectiveDy + PULL_RESULTS_DOWN_VS_HORIZONTAL > Math.abs(dx)

  const flickDown =
    velocityY > PULL_RESULTS_VELOCITY_Y_MIN &&
    effectiveDy >= 16 &&
    effectiveDy + 4 > Math.abs(dx)

  return deliberateDown || flickDown
}
