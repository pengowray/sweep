// js/generators/stepped-sine.js — Discrete frequency-stepped tone generation

/**
 * Generate a stepped sine signal: discrete frequency tones held for a
 * configurable duration, with optional silence gaps between steps.
 *
 * @param {object} params
 * @param {number} params.startFreq
 * @param {number} params.endFreq
 * @param {number} params.sampleRate
 * @param {number} params.stepsPerOctave - e.g. 3, 6, 12, 24
 * @param {number} params.dwellTime - seconds per step
 * @param {number} params.gapTime - silence between steps (seconds)
 * @param {string} params.spacing - "logarithmic" or "linear"
 * @param {function} [params.onProgress]
 * @returns {Float64Array}
 */
export function generateSteppedSine({
  startFreq, endFreq, sampleRate, stepsPerOctave, dwellTime, gapTime, spacing, onProgress
}) {
  // Clamp startFreq to avoid log(0) issues
  startFreq = Math.max(1, startFreq);

  // Calculate frequency steps
  const frequencies = [];

  if (spacing === 'logarithmic') {
    const numOctaves = Math.log2(endFreq / startFreq);
    const totalSteps = Math.round(numOctaves * stepsPerOctave);
    for (let i = 0; i <= totalSteps; i++) {
      const freq = startFreq * Math.pow(2, i / stepsPerOctave);
      if (freq <= endFreq * 1.001) frequencies.push(freq); // small tolerance
    }
  } else {
    // Linear spacing
    const numOctaves = Math.log2(endFreq / startFreq);
    const totalSteps = Math.max(1, Math.round(numOctaves * stepsPerOctave));
    const stepSize = (endFreq - startFreq) / totalSteps;
    for (let i = 0; i <= totalSteps; i++) {
      frequencies.push(startFreq + i * stepSize);
    }
  }

  const dwellSamples = Math.round(dwellTime * sampleRate);
  const gapSamples = Math.round(gapTime * sampleRate);
  // Short cosine taper to avoid clicks: 1ms or 48 samples at 48kHz
  const taperSamples = Math.min(Math.round(0.001 * sampleRate), Math.floor(dwellSamples / 4));

  const totalSamples = frequencies.length * (dwellSamples + gapSamples);
  const samples = new Float64Array(totalSamples);
  let writeIndex = 0;

  for (let step = 0; step < frequencies.length; step++) {
    const freq = frequencies[step];
    const phaseInc = 2 * Math.PI * freq / sampleRate;

    // Dwell period: sine tone with short cosine taper at edges
    for (let i = 0; i < dwellSamples; i++) {
      let envelope = 1.0;

      // Fade-in taper
      if (i < taperSamples) {
        envelope = 0.5 * (1 - Math.cos(Math.PI * i / taperSamples));
      }
      // Fade-out taper
      if (i >= dwellSamples - taperSamples) {
        const j = dwellSamples - 1 - i;
        envelope = 0.5 * (1 - Math.cos(Math.PI * j / taperSamples));
      }

      samples[writeIndex] = envelope * Math.sin(phaseInc * i);
      writeIndex++;
    }

    // Gap period: silence (already zero from Float64Array init)
    writeIndex += gapSamples;

    if (onProgress) {
      onProgress(step / frequencies.length);
    }
  }

  if (onProgress) onProgress(1.0);
  return samples.subarray(0, writeIndex);
}

/**
 * Calculate the total duration of a stepped sine signal.
 * @param {object} params - Same as generateSteppedSine
 * @returns {number} Duration in seconds
 */
export function steppedSineDuration({ startFreq, endFreq, stepsPerOctave, dwellTime, gapTime, spacing }) {
  startFreq = Math.max(1, startFreq);
  let numSteps;
  const numOctaves = Math.log2(endFreq / startFreq);

  if (spacing === 'logarithmic') {
    numSteps = Math.round(numOctaves * stepsPerOctave) + 1;
  } else {
    numSteps = Math.max(1, Math.round(numOctaves * stepsPerOctave)) + 1;
  }

  return numSteps * (dwellTime + gapTime);
}
