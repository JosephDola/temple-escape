// Rules for the monster's echolocation. No three.js in here, so `npm test` can check them.
export const PING_SLOTS = 8;      // sounds the monster can "see" at the same time
export const PING_LIFETIME = 5;   // seconds before a sound stops lighting the world
export const WAVE_SPEED = 14;     // metres per second the echo wave spreads

// 0 = silent, 1 = a full sprint. Crouching and crawling are quiet, sprinting is very loud.
export function footstepLoudness({ crouched = false, running = false, inVent = false } = {}) {
  if (crouched || inVent) return 0.12;
  return running ? 1 : 0.45;
}

// How far (metres) a sound of this loudness lights up the world.
export function pingRadius(loudness) {
  return 4 + Math.max(0, Math.min(1, loudness)) * 16;
}

// ages: one number per slot, -1 means free. Use a free slot, otherwise replace the oldest.
export function nextPingSlot(ages) {
  let oldest = 0;
  for (let i = 0; i < ages.length; i++) {
    if (ages[i] < 0) return i;
    if (ages[i] > ages[oldest]) oldest = i;
  }
  return oldest;
}
