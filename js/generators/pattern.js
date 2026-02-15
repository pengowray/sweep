// js/generators/pattern.js — Fixed-sequence tone burst generation
//
// A Pattern is a flat array of { hz, db, on_ms, off_ms } steps, each with
// its own frequency, amplitude, and timing. Unlike Stepped Sine (which
// derives uniform dwell/gap from a frequency range), every step here is
// fully explicit — making it suitable for alignment bursts, hearing tests,
// time signals, etc.

/**
 * Calculate the total duration of a pattern sequence.
 * @param {Array<{on_ms: number, off_ms: number}>} sequence
 * @returns {number} Duration in seconds
 */
export function patternDuration(sequence) {
  if (!sequence || !sequence.length) return 0;
  return sequence.reduce((sum, step) => sum + (step.on_ms || 0) + (step.off_ms || 0), 0) / 1000;
}

/**
 * Generate a pattern signal: a sequence of individually timed and levelled
 * tone bursts with cosine tapers to prevent clicks.
 *
 * @param {object} params
 * @param {Array<{hz: number, db: number, on_ms: number, off_ms: number}>} params.patternSequence
 * @param {number} [params.patternFadeMs=5] - Cosine taper duration in ms (capped at onSamples/4)
 * @param {number} params.sampleRate
 * @param {function} [params.onProgress]
 * @returns {Float64Array}
 */
export function generatePattern({ patternSequence, patternFadeMs = 5, sampleRate, onProgress }) {
  if (!patternSequence || !patternSequence.length) return new Float64Array(0);

  const totalSamples = patternSequence.reduce((sum, step) => {
    return sum
      + Math.round((step.on_ms || 0) / 1000 * sampleRate)
      + Math.round((step.off_ms || 0) / 1000 * sampleRate);
  }, 0);

  const samples = new Float64Array(totalSamples);
  let writeIndex = 0;

  for (let s = 0; s < patternSequence.length; s++) {
    const { hz, db, on_ms, off_ms } = patternSequence[s];
    const amplitude = Math.pow(10, (db ?? 0) / 20);
    const onSamples = Math.round((on_ms || 0) / 1000 * sampleRate);
    const offSamples = Math.round((off_ms || 0) / 1000 * sampleRate);

    // Taper: shorter of patternFadeMs or one-quarter of the tone duration
    const taperSamples = Math.min(
      Math.round(patternFadeMs / 1000 * sampleRate),
      Math.floor(onSamples / 4)
    );

    const phaseInc = 2 * Math.PI * hz / sampleRate;

    for (let i = 0; i < onSamples; i++) {
      let envelope = 1.0;

      // Fade-in taper
      if (i < taperSamples) {
        envelope = 0.5 * (1 - Math.cos(Math.PI * i / taperSamples));
      }
      // Fade-out taper
      if (i >= onSamples - taperSamples) {
        const j = onSamples - 1 - i;
        envelope = 0.5 * (1 - Math.cos(Math.PI * j / taperSamples));
      }

      samples[writeIndex + i] = amplitude * envelope * Math.sin(phaseInc * i);
    }

    writeIndex += onSamples + offSamples; // off-time samples remain zero from Float64Array init

    if (onProgress) onProgress(s / patternSequence.length);
  }

  if (onProgress) onProgress(1.0);
  return samples.subarray(0, writeIndex);
}
