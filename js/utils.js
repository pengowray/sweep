// js/utils.js — Shared math utilities for signal generation
// Pure functions: fade windows, dBFS conversion, gain, silence padding, repetition

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
