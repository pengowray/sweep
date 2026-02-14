// js/utils.js — Shared math utilities for signal generation
// Pure functions: fade windows, dBFS conversion, gain, silence padding, repetition

import { computeSteppedFrequencies } from './generators/stepped-sine.js';

/**
 * Convert dBFS to linear amplitude.
 * @param {number} dBFS - e.g. -3
 * @returns {number} Linear amplitude, e.g. 0.7079
 */
export function dBFSToLinear(dBFS) {
  return Math.pow(10, dBFS / 20);
}

/**
 * Half-Hanning fade-in: smooth S-curve from 0 to 1.
 * w(n) = 0.5 * (1 - cos(π * n / (L - 1)))
 * @param {number} length - Number of samples in the fade
 * @returns {Float64Array}
 */
export function halfHanningFadeIn(length) {
  const w = new Float64Array(length);
  if (length <= 1) {
    if (length === 1) w[0] = 1;
    return w;
  }
  const denom = length - 1;
  for (let n = 0; n < length; n++) {
    w[n] = 0.5 * (1 - Math.cos(Math.PI * n / denom));
  }
  return w;
}

/**
 * Half-Hanning fade-out: smooth S-curve from 1 to 0.
 * w(n) = 0.5 * (1 + cos(π * n / (L - 1)))
 * @param {number} length
 * @returns {Float64Array}
 */
export function halfHanningFadeOut(length) {
  const w = new Float64Array(length);
  if (length <= 1) {
    if (length === 1) w[0] = 1;
    return w;
  }
  const denom = length - 1;
  for (let n = 0; n < length; n++) {
    w[n] = 0.5 * (1 + Math.cos(Math.PI * n / denom));
  }
  return w;
}

/**
 * Linear fade-in: straight ramp from 0 to 1.
 * @param {number} length
 * @returns {Float64Array}
 */
export function linearFadeIn(length) {
  const w = new Float64Array(length);
  if (length <= 1) {
    if (length === 1) w[0] = 1;
    return w;
  }
  const denom = length - 1;
  for (let n = 0; n < length; n++) {
    w[n] = n / denom;
  }
  return w;
}

/**
 * Linear fade-out: straight ramp from 1 to 0.
 * @param {number} length
 * @returns {Float64Array}
 */
export function linearFadeOut(length) {
  const w = new Float64Array(length);
  if (length <= 1) {
    if (length === 1) w[0] = 1;
    return w;
  }
  const denom = length - 1;
  for (let n = 0; n < length; n++) {
    w[n] = 1 - n / denom;
  }
  return w;
}

/**
 * Apply fade-in and fade-out windows to a sample array in-place.
 * @param {Float64Array} samples
 * @param {string} fadeInType - "hanning" | "linear" | "none"
 * @param {number} fadeInSamples
 * @param {string} fadeOutType - "hanning" | "linear" | "none"
 * @param {number} fadeOutSamples
 */
export function applyFades(samples, fadeInType, fadeInSamples, fadeOutType, fadeOutSamples) {
  const N = samples.length;

  if (fadeInType !== 'none' && fadeInSamples > 0) {
    const len = Math.min(fadeInSamples, N);
    const win = fadeInType === 'hanning' ? halfHanningFadeIn(len) : linearFadeIn(len);
    for (let i = 0; i < len; i++) {
      samples[i] *= win[i];
    }
  }

  if (fadeOutType !== 'none' && fadeOutSamples > 0) {
    const len = Math.min(fadeOutSamples, N);
    const win = fadeOutType === 'hanning' ? halfHanningFadeOut(len) : linearFadeOut(len);
    const start = N - len;
    for (let i = 0; i < len; i++) {
      samples[start + i] *= win[i];
    }
  }
}

/**
 * Calculate the number of samples for a "1 octave" fade-in on an ESS.
 * This is the time it takes the sweep to traverse from f1 to 2*f1.
 *   t_fade = T * ln(2) / ln(f2/f1)
 * @param {number} startFreq
 * @param {number} endFreq
 * @param {number} duration - seconds
 * @param {number} sampleRate
 * @returns {number}
 */
export function essOneOctaveFadeSamples(startFreq, endFreq, duration, sampleRate) {
  const tFade = duration * Math.LN2 / Math.log(endFreq / startFreq);
  return Math.round(tFade * sampleRate);
}

/**
 * Scale an entire Float64Array by a linear amplitude factor, in-place.
 * @param {Float64Array} samples
 * @param {number} linearGain
 */
export function applyGain(samples, linearGain) {
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= linearGain;
  }
}

/**
 * Prepend leading silence and append trailing silence.
 * Returns a new array.
 * @param {Float64Array} samples
 * @param {number} leadSamples
 * @param {number} trailSamples
 * @returns {Float64Array}
 */
export function addSilence(samples, leadSamples, trailSamples) {
  const total = leadSamples + samples.length + trailSamples;
  const out = new Float64Array(total);
  out.set(samples, leadSamples);
  return out;
}

/**
 * Concatenate multiple repetitions of a signal with silence gaps between them.
 * @param {Float64Array} samples - Single signal
 * @param {number} repetitions
 * @param {number} silenceSamples - Silence between repetitions
 * @returns {Float64Array}
 */
export function repeatWithSilence(samples, repetitions, silenceSamples) {
  if (repetitions <= 1) return samples;
  const segLen = samples.length + silenceSamples;
  const total = samples.length * repetitions + silenceSamples * (repetitions - 1);
  const out = new Float64Array(total);
  for (let r = 0; r < repetitions; r++) {
    out.set(samples, r * segLen);
  }
  return out;
}

/**
 * Decimate a sample array for visualization (min/max pairs per segment).
 * @param {Float64Array} samples
 * @param {number} maxPoints - Maximum number of display points
 * @returns {Float64Array} Interleaved [min0, max0, min1, max1, ...]
 */
export function decimateForVisualization(samples, maxPoints) {
  if (samples.length <= maxPoints * 2) return new Float64Array(samples);
  const step = samples.length / maxPoints;
  const result = new Float64Array(maxPoints * 2);
  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(Math.floor((i + 1) * step), samples.length);
    let min = Infinity, max = -Infinity;
    for (let j = start; j < end; j++) {
      if (samples[j] < min) min = samples[j];
      if (samples[j] > max) max = samples[j];
    }
    result[i * 2] = min;
    result[i * 2 + 1] = max;
  }
  return result;
}

/**
 * A-weighting in dB for a given frequency (IEC 61672:2003).
 * Returns ~0 dB at 1 kHz, large negative values at low frequencies.
 * @param {number} f - Frequency in Hz (must be > 0)
 * @returns {number} A-weighting in dB
 */
export function aWeightDB(f) {
  const f2 = f * f;
  const f4 = f2 * f2;
  const num = 12194 * 12194 * f4;
  const denom = (f2 + 20.6 * 20.6) * (f2 + 12194 * 12194) *
    Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9));
  const rA = num / denom;
  return 20 * Math.log10(rA) + 2.0;
}

/**
 * Apply inverse A-weighting amplitude envelope to sweep samples in-place.
 * Shapes the sweep so it sounds perceptually even across frequencies.
 * The envelope is normalized so the maximum amplitude remains 1.0.
 *
 * @param {Float64Array} samples
 * @param {object} params
 * @param {number} params.startFreq
 * @param {number} params.endFreq
 * @param {number} params.duration
 * @param {number} params.sampleRate
 * @param {string} params.signalType - 'ess', 'linear', or 'stepped'
 * @param {number} [params.stepsPerOctave]
 * @param {number} [params.dwellTime]
 * @param {number} [params.gapTime]
 * @param {string} [params.steppedSpacing]
 */
export function applyAWeighting(samples, params) {
  const { startFreq, endFreq, duration, sampleRate, signalType } = params;
  const N = samples.length;

  if (signalType === 'stepped') {
    applyAWeightStepped(samples, params);
    return;
  }

  // For ESS and linear sweeps, compute instantaneous frequency per sample.
  // Two-pass approach: first apply the raw inverse A-weight envelope,
  // then normalize so the peak amplitude equals the original peak.
  // This correctly accounts for fades that have already been applied.
  //
  // Frequency is clamped to [110, 20000] Hz for the A-weight calculation.
  // Floor at 110 Hz avoids extreme sub-bass boost; ceiling at 20 kHz prevents
  // ultrasonic runaway. This gives ~12 dB of dynamic range — a moderate,
  // practical compensation across the core audible band.
  const lnRatio = signalType === 'ess' ? Math.log(endFreq / startFreq) : 0;
  const chirpRate = signalType === 'linear' ? (endFreq - startFreq) / duration : 0;
  const A_WEIGHT_FLOOR_HZ = 110 ; // or 200?
  const A_WEIGHT_CEIL_HZ = 20000;

  // Use 1 kHz (A-weight ≈ 0 dB) as reference so inverse gain ≈ 1.0 at 1 kHz.
  const refGain = Math.pow(10, -aWeightDB(1000) / 20); // ≈ 1.0

  // Pass 1: apply inverse A-weight envelope (relative to 1 kHz reference)
  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    let freq;
    if (signalType === 'ess') {
      freq = startFreq * Math.exp(t / duration * lnRatio);
    } else {
      freq = startFreq + chirpRate * t;
    }

    const clampedFreq = Math.min(Math.max(freq, A_WEIGHT_FLOOR_HZ), A_WEIGHT_CEIL_HZ);
    const inverseGain = Math.pow(10, -aWeightDB(clampedFreq) / 20) / refGain;
    samples[i] *= inverseGain;
  }

  // Pass 2: find peak amplitude and normalize so it doesn't exceed 1.0
  let peak = 0;
  for (let i = 0; i < N; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  if (peak > 1.0) {
    const scale = 1.0 / peak;
    for (let i = 0; i < N; i++) {
      samples[i] *= scale;
    }
  }
}

/**
 * Apply inverse A-weighting to stepped sine samples.
 * Each step has a constant frequency, so gain is constant per step.
 */
function applyAWeightStepped(samples, params) {
  const { startFreq, endFreq, sampleRate, stepsPerOctave, dwellTime, gapTime } = params;
  const spacing = params.steppedSpacing || 'logarithmic';

  const frequencies = computeSteppedFrequencies(startFreq, endFreq, stepsPerOctave, spacing);

  // Compute inverse A-weight gain per step (referenced to 1 kHz, clamped to [200, 20000] Hz)
  const A_WEIGHT_FLOOR_HZ = 200;
  const A_WEIGHT_CEIL_HZ = 20000;
  const refGain = Math.pow(10, -aWeightDB(1000) / 20);
  const stepGains = frequencies.map(freq =>
    Math.pow(10, -aWeightDB(Math.min(Math.max(freq, A_WEIGHT_FLOOR_HZ), A_WEIGHT_CEIL_HZ)) / 20) / refGain
  );

  const dwellSamples = Math.round(dwellTime * sampleRate);
  const gapSamples = Math.round(gapTime * sampleRate);
  const stepLen = dwellSamples + gapSamples;

  // Pass 1: apply per-step gains
  for (let step = 0; step < frequencies.length; step++) {
    const gain = stepGains[step];
    const offset = step * stepLen;
    const end = Math.min(offset + dwellSamples, samples.length);
    for (let i = offset; i < end; i++) {
      samples[i] *= gain;
    }
  }

  // Pass 2: normalize so peak doesn't exceed 1.0
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  if (peak > 1.0) {
    const scale = 1.0 / peak;
    for (let i = 0; i < samples.length; i++) {
      samples[i] *= scale;
    }
  }
}

/**
 * Apply TPDF dither in-place.
 * For PCM (16/24-bit): corrects quantization error at 1 LSB amplitude.
 * For float (32-bit): uses 24-bit-equivalent amplitude (~−138 dBFS) —
 *   useful for keeping audio chains/hardware alive during long digital silence.
 * @param {Float64Array} samples - Full buffer (including silence)
 * @param {number} bitDepth - 16, 24, or 32
 * @param {string} scope - 'all' | 'audio' | 'silence'
 * @param {number} leadSamples - Number of silent samples at start
 * @param {number} trailSamples - Number of silent samples at end
 */
export function applyDither(samples, bitDepth, scope, leadSamples, trailSamples) {
  // PCM uses bit-depth LSB; float uses 24-bit equivalent (~−138 dBFS)
  const lsb = bitDepth === 16 ? 1 / 32768 : 1 / 8388608;
  const N = samples.length;
  for (let i = 0; i < N; i++) {
    const inSilence = i < leadSamples || i >= N - trailSamples;
    if (scope === 'audio' && inSilence) continue;
    if (scope === 'silence' && !inSilence) continue;
    samples[i] += (Math.random() + Math.random() - 1) * lsb;
  }
}

/**
 * Estimate the WAV file size in bytes for given parameters.
 * @param {object} params
 * @returns {number}
 */
export function estimateFileSize(params) {
  const bytesPerSample = params.bitDepth / 8;
  const numChannels = params.channelMode === 'mono' ? 1 : 2;
  const sampleRate = params.sampleRate;

  let sweepSamples;
  if (params.signalType === 'mls') {
    sweepSamples = (1 << (params.mlsOrder || 16)) - 1;
  } else {
    sweepSamples = Math.round(sampleRate * (params.duration || 0));
  }

  const leadSamples = Math.round((params.leadSilence || 0) / 1000 * sampleRate);
  const trailSamples = Math.round((params.trailSilence || 0) / 1000 * sampleRate);
  const reps = params.repetitions || 1;
  const interSilence = Math.round((params.interSweepSilence || 0) / 1000 * sampleRate);

  const totalSamples = (sweepSamples * reps) +
    (interSilence * Math.max(0, reps - 1)) +
    leadSamples + trailSamples;

  const dataSize = totalSamples * numChannels * bytesPerSample;
  const headerSize = 700; // Approximate: RIFF + fmt(extensible) + fact + bext
  return dataSize + headerSize;
}

/**
 * Format a byte count as a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
