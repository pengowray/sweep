// js/generators/noise.js — White noise and Pink noise generation

/**
 * Simple seeded PRNG (xorshift128+) for reproducible results.
 * Returns a function that produces values in [0, 1).
 */
function createPRNG(seed) {
  // Initialize state from seed
  let s0 = seed >>> 0 || 1;
  let s1 = (s0 * 1103515245 + 12345) >>> 0 || 2;

  return function next() {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= (x << 23) | 0;
    x ^= (x >>> 17) | 0;
    x ^= y | 0;
    x ^= (y >>> 26) | 0;
    s1 = x;
    // Use upper bits for better distribution
    return ((s0 + s1) >>> 0) / 4294967296;
  };
}

/**
 * Generate white noise with flat power spectral density.
 * @param {object} params
 * @param {number} params.sampleRate
 * @param {number} params.duration - seconds
 * @param {number} [params.seed] - optional PRNG seed for reproducibility
 * @param {function} [params.onProgress]
 * @returns {Float64Array} Normalized samples [-1, 1]
 */
export function generateWhiteNoise({ sampleRate, duration, seed, onProgress }) {
  const N = Math.round(sampleRate * duration);
  const samples = new Float64Array(N);

  const rand = seed != null
    ? createPRNG(seed)
    : () => Math.random();

  for (let i = 0; i < N; i++) {
    // Map [0, 1) to [-1, 1)
    samples[i] = rand() * 2 - 1;

    if (onProgress && (i & 0xFFFF) === 0) {
      onProgress(i / N);
    }
  }

  if (onProgress) onProgress(1.0);
  return samples;
}

/**
 * Generate pink noise (-3 dB/octave) using Paul Kellett's filter method.
 * Accurate to +/-0.05 dB above 9.2 Hz at 44.1 kHz.
 * At higher sample rates, accuracy is maintained for the audible range.
 *
 * @param {object} params
 * @param {number} params.sampleRate
 * @param {number} params.duration - seconds
 * @param {number} [params.seed]
 * @param {function} [params.onProgress]
 * @returns {Float64Array}
 */
export function generatePinkNoise({ sampleRate, duration, seed, onProgress }) {
  const N = Math.round(sampleRate * duration);
  const samples = new Float64Array(N);

  const rand = seed != null
    ? createPRNG(seed)
    : () => Math.random();

  // Kellett filter state
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < N; i++) {
    const white = rand() * 2 - 1;

    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;

    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;

    samples[i] = pink * 0.11; // Scale to roughly [-1, 1]

    if (onProgress && (i & 0xFFFF) === 0) {
      onProgress(i / N);
    }
  }

  // Peak-normalize to [-1, 1]
  let peak = 0;
  for (let i = 0; i < N; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  if (peak > 0) {
    const scale = 1.0 / peak;
    for (let i = 0; i < N; i++) {
      samples[i] *= scale;
    }
  }

  if (onProgress) onProgress(1.0);
  return samples;
}
