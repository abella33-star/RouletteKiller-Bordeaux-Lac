/** Distinct vibration patterns for each signal event */

const vibe = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern)
  }
}

export const haptics = {
  /** Short tap — number registered */
  tap:      () => vibe(40),

  /** Double pulse — PLAY signal detected */
  play:     () => vibe([100, 50, 100]),

  /** Triple heavy pulse — KILLER signal */
  killer:   () => vibe([200, 50, 200, 50, 300]),

  /** Warning buzz — NOISE / reset */
  noise:    () => vibe(500),

  /** Victory rumble — Take Profit reached */
  victory:  () => vibe([100, 50, 100, 50, 200, 100, 500]),

  /** Undo — light double */
  undo:     () => vibe([20, 20, 20]),

  /** Reset cycle */
  reset:    () => vibe([30, 20, 30]),
}
