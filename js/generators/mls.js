// js/generators/mls.js — Maximum Length Sequence (LFSR-based)

/**
 * LFSR tap positions for primitive polynomials producing maximal-length sequences.
 * Sequence length = 2^order - 1.
 * Taps are 1-indexed bit positions (MSB-relative).
 */
const MLS_TAPS = {
  10: [10, 7],
  11: [11, 9],
  12: [12, 11, 10, 4],
  13: [13, 12, 11, 8],
  14: [14, 13, 12, 2],
  15: [15, 14],
  16: [16, 15, 13, 4],
  17: [17, 14],
  18: [18, 11],
};

/**
 * Generate a Maximum Length Sequence.
 * Uses a Galois LFSR with the given primitive polynomial taps.
 *
 * @param {object} params
 * @param {number} params.order - LFSR order (10-18)
 * @param {number} params.sampleRate - Sample rate (determines playback speed)
 * @param {number} [params.repetitions=1] - Number of times to repeat the full sequence
 * @param {function} [params.onProgress]
 * @returns {Float64Array} Bipolar values (+1 / -1)
 */
export function generateMLS({ order, sampleRate, repetitions = 1, onProgress }) {
  const taps = MLS_TAPS[order];
  if (!taps) {
    throw new Error(`Unsupported MLS order: ${order}. Supported: ${Object.keys(MLS_TAPS).join(', ')}`);
  }

  const seqLength = (1 << order) - 1;
  const totalLength = seqLength * repetitions;
  const samples = new Float64Array(totalLength);

  for (let rep = 0; rep < repetitions; rep++) {
    // Initialize LFSR with all-ones state (any non-zero state works)
    let register = (1 << order) - 1;
    const baseIdx = rep * seqLength;

    for (let i = 0; i < seqLength; i++) {
      // Output is the LSB
      const outputBit = register & 1;
      samples[baseIdx + i] = outputBit ? 1.0 : -1.0;

      // Calculate feedback: XOR of all tap bits
      let feedback = 0;
      for (let t = 0; t < taps.length; t++) {
        feedback ^= (register >> (taps[t] - 1)) & 1;
      }

      // Shift right and insert feedback at MSB
      register = (register >> 1) | (feedback << (order - 1));

      if (onProgress && (i & 0x3FFF) === 0) {
        onProgress((baseIdx + i) / totalLength);
      }
    }
  }

  if (onProgress) onProgress(1.0);
  return samples;
}

/**
 * Get the sequence length for a given MLS order.
 * @param {number} order
 * @returns {number}
 */
export function mlsSequenceLength(order) {
  return (1 << order) - 1;
}

/**
 * Get the duration in seconds for a given MLS order at a sample rate.
 * @param {number} order
 * @param {number} sampleRate
 * @returns {number}
 */
export function mlsDuration(order, sampleRate) {
  return ((1 << order) - 1) / sampleRate;
}
