// js/generators/sweep.js — Exponential (Farina) and Linear sine sweep generation

/**
 * Generate an exponential (logarithmic) sine sweep using the Farina method.
 * Constant energy per octave — the standard for IR measurement.
 *
 * Formula: x(t) = sin(2π · f1 · T / ln(f2/f1) · (e^(t/T · ln(f2/f1)) − 1))
 *
 * @param {object} params
 * @param {number} params.startFreq      - Start frequency in Hz
 * @param {number} params.endFreq        - End frequency in Hz
 * @param {number} params.sampleRate     - Sample rate in Hz
 * @param {number} params.duration       - Sweep duration in seconds
 * @param {function} [params.onProgress] - Progress callback(fraction 0..1)
 * @returns {Float64Array} Normalized samples [-1, 1]
 */
export function generateExponentialSweep({ startFreq, endFreq, sampleRate, duration, onProgress }) {
  const f1 = startFreq;
  const f2 = endFreq;
  const T = duration;
  const N = Math.round(sampleRate * T);
  const samples = new Float64Array(N);

  const lnRatio = Math.log(f2 / f1);
  const phaseCoeff = 2 * Math.PI * f1 * T / lnRatio;

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const exponent = t / T * lnRatio;
    const phase = phaseCoeff * (Math.exp(exponent) - 1);
    samples[i] = Math.sin(phase);

    if (onProgress && (i & 0xFFFF) === 0) { // every 65536 samples
      onProgress(i / N);
    }
  }

  if (onProgress) onProgress(1.0);
  return samples;
}

/**
 * Generate a linear sine sweep (constant Hz per second).
 *
 * Instantaneous frequency: f(t) = f1 + (f2 − f1) · t / T
 * Phase: φ(t) = 2π · (f1·t + (f2−f1)·t² / (2T))
 *
 * @param {object} params - Same as generateExponentialSweep
 * @returns {Float64Array}
 */
export function generateLinearSweep({ startFreq, endFreq, sampleRate, duration, onProgress }) {
  const f1 = startFreq;
  const f2 = endFreq;
  const T = duration;
  const N = Math.round(sampleRate * T);
  const samples = new Float64Array(N);

  const chirpRate = (f2 - f1) / T;

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const phase = 2 * Math.PI * (f1 * t + chirpRate * t * t / 2);
    samples[i] = Math.sin(phase);

    if (onProgress && (i & 0xFFFF) === 0) {
      onProgress(i / N);
    }
  }

  if (onProgress) onProgress(1.0);
  return samples;
}

/**
 * Generate the inverse filter for an exponential sweep (Farina deconvolution).
 * Time-reversal of the sweep with an amplitude envelope that provides
 * +6 dB/octave boost, compensating for the log frequency distribution.
 *
 * @param {Float64Array} sweepSamples - The original ESS samples
 * @param {object} params
 * @param {number} params.startFreq
 * @param {number} params.endFreq
 * @param {number} params.sampleRate
 * @param {number} params.duration
 * @returns {Float64Array}
 */
export function generateInverseFilter(sweepSamples, { startFreq, endFreq, sampleRate, duration }) {
  const N = sweepSamples.length;
  const inverse = new Float64Array(N);
  const lnRatio = Math.log(endFreq / startFreq);
  const T = duration;

  for (let i = 0; i < N; i++) {
    // Time-reverse: sample at position i corresponds to original time (N-1-i)/sr
    const reversedSample = sweepSamples[N - 1 - i];

    // Amplitude envelope: exponential decay providing +6 dB/octave
    // k(t) = e^(-t_original/T * ln(f2/f1))
    const tOriginal = (N - 1 - i) / sampleRate;
    const envelope = Math.exp(-tOriginal / T * lnRatio);

    inverse[i] = reversedSample * envelope;
  }

  // Normalization factor so that sweep * inverse ≈ unit impulse
  const normFactor = lnRatio / (2 * Math.PI * startFreq * T);
  for (let i = 0; i < N; i++) {
    inverse[i] *= normFactor;
  }

  return inverse;
}
