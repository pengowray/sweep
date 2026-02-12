// js/audio/wav-encoder.js — Manual binary WAV file construction
// Supports 16-bit PCM, 24-bit PCM, 32-bit IEEE Float
// Uses WAVE_FORMAT_EXTENSIBLE for 24-bit and 32-bit
// Includes optional BWF bext metadata chunk

/**
 * Write an ASCII string into a DataView at a given offset.
 */
function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Write a fixed-length null-padded ASCII string into a Uint8Array.
 */
function writeFixedString(bytes, offset, str, maxLen) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str.substring(0, maxLen));
  bytes.set(encoded.subarray(0, maxLen), offset);
  // Remaining bytes are already zero (ArrayBuffer is zero-initialized)
}

/**
 * Encode the BWF bext metadata chunk payload.
 * @param {object} meta
 * @param {string} meta.description
 * @param {string} [meta.originator]
 * @param {string} [meta.originatorReference]
 * @param {string} [meta.codingHistory]
 * @returns {ArrayBuffer}
 */
function encodeBextPayload(meta) {
  const codingHistoryBytes = new TextEncoder().encode(meta.codingHistory || '');
  const fixedSize = 602;
  const totalSize = fixedSize + codingHistoryBytes.length;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let offset = 0;

  // Description: 256 bytes
  writeFixedString(bytes, offset, meta.description || '', 256);
  offset += 256;

  // Originator: 32 bytes
  writeFixedString(bytes, offset, meta.originator || 'SineSweepGenerator', 32);
  offset += 32;

  // OriginatorReference: 32 bytes
  writeFixedString(bytes, offset, meta.originatorReference || '', 32);
  offset += 32;

  // OriginationDate: 10 bytes (yyyy-mm-dd)
  const now = new Date();
  const dateStr = now.toISOString().substring(0, 10);
  writeFixedString(bytes, offset, dateStr, 10);
  offset += 10;

  // OriginationTime: 8 bytes (hh:mm:ss)
  const timeStr = now.toTimeString().substring(0, 8);
  writeFixedString(bytes, offset, timeStr, 8);
  offset += 8;

  // TimeReference: 8 bytes (uint64, set to 0)
  offset += 8;

  // Version: 2 bytes
  view.setUint16(offset, 1, true);
  offset += 2;

  // UMID: 64 bytes (zeros)
  offset += 64;

  // Reserved: 190 bytes (zeros)
  offset += 190;

  // CodingHistory: variable length
  bytes.set(codingHistoryBytes, offset);

  return buffer;
}

/**
 * Write interleaved sample data into the WAV buffer.
 * @param {DataView} view
 * @param {number} offset - Starting byte offset in the buffer
 * @param {Float64Array[]} channelData - Array of per-channel sample arrays
 * @param {number} totalFrames - Number of sample frames
 * @param {number} numChannels
 * @param {number} bitDepth - 16, 24, or 32
 * @param {boolean} isFloat - true for 32-bit float
 * @param {function} [onProgress]
 * @returns {number} Final offset after writing
 */
function writeSampleData(view, offset, channelData, totalFrames, numChannels, bitDepth, isFloat, onProgress) {
  const buf = view.buffer;
  const bytes = new Uint8Array(buf);

  for (let frame = 0; frame < totalFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = channelData[ch][frame];

      if (bitDepth === 16) {
        // 16-bit signed PCM: scale to [-32768, 32767]
        const clamped = Math.max(-1, Math.min(1, sample));
        const intVal = Math.round(clamped * 32767);
        view.setInt16(offset, intVal, true);
        offset += 2;

      } else if (bitDepth === 24) {
        // 24-bit signed PCM: scale to [-8388608, 8388607], write 3 bytes LE
        const clamped = Math.max(-1, Math.min(1, sample));
        let intVal = Math.round(clamped * 8388607);
        // Handle sign for negative values (two's complement)
        if (intVal < 0) intVal += 16777216; // 2^24
        bytes[offset] = intVal & 0xFF;
        bytes[offset + 1] = (intVal >> 8) & 0xFF;
        bytes[offset + 2] = (intVal >> 16) & 0xFF;
        offset += 3;

      } else if (bitDepth === 32 && isFloat) {
        // 32-bit IEEE float: direct write
        view.setFloat32(offset, sample, true);
        offset += 4;
      }
    }

    if (onProgress && (frame & 0xFFFF) === 0) {
      onProgress(frame / totalFrames);
    }
  }

  if (onProgress) onProgress(1.0);
  return offset;
}

/**
 * Encode sample data into a complete WAV file ArrayBuffer.
 *
 * @param {Float64Array} samples - Mono samples, normalized [-1, 1]
 * @param {object} params
 * @param {number} params.sampleRate
 * @param {number} params.bitDepth - 16, 24, or 32
 * @param {string} params.format - "pcm" or "float"
 * @param {number} params.numChannels - 1 or 2
 * @param {string} [params.channelMode] - "mono", "stereo-identical", "stereo-sync", "stereo-alternate", "stereo-lrb"
 * @param {Float64Array[]} [params.channels] - Pre-built per-channel arrays (overrides channelMode logic)
 * @param {Float64Array} [params.syncChannel] - For stereo-sync mode (legacy)
 * @param {object} [params.bwfMetadata] - BWF bext metadata
 * @param {function} [params.onProgress]
 * @returns {ArrayBuffer}
 */
export function encodeWAV(samples, params) {
  const {
    sampleRate, bitDepth, format, numChannels,
    channelMode, channels, syncChannel, bwfMetadata, onProgress
  } = params;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = bytesPerSample * numChannels;
  const avgBytesPerSec = sampleRate * blockAlign;
  const isFloat = (bitDepth === 32 && format === 'float');
  const isExtensible = (bitDepth === 24 || bitDepth === 32);

  // Prepare channel data arrays
  let channelData;
  if (channels) {
    // Pre-built channel arrays (from stereo-alternate, stereo-lrb, stereo-sync)
    channelData = channels;
  } else if (numChannels === 1) {
    channelData = [samples];
  } else if (channelMode === 'stereo-sync' && syncChannel) {
    channelData = [samples, syncChannel];
  } else {
    // stereo-identical: both channels reference the same data
    channelData = [samples, samples];
  }

  const totalFrames = samples.length;
  const dataSize = totalFrames * blockAlign;

  // fmt chunk payload size
  const fmtPayloadSize = isExtensible ? 40 : 16;
  const fmtChunkSize = 8 + fmtPayloadSize;

  // fact chunk (required for extensible and float)
  const needsFact = isExtensible || isFloat;
  const factChunkSize = needsFact ? 12 : 0;

  // bext chunk
  let bextPayload = null;
  let bextChunkSize = 0;
  if (bwfMetadata) {
    bextPayload = encodeBextPayload(bwfMetadata);
    bextChunkSize = 8 + bextPayload.byteLength;
    if (bextPayload.byteLength % 2 !== 0) bextChunkSize += 1; // pad to even
  }

  const dataChunkSize = 8 + dataSize;
  const riffPayloadSize = 4 + bextChunkSize + fmtChunkSize + factChunkSize + dataChunkSize;
  const fileSize = 8 + riffPayloadSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  let offset = 0;

  // ---- RIFF header ----
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, riffPayloadSize, true); offset += 4;
  writeString(view, offset, 'WAVE'); offset += 4;

  // ---- bext chunk (optional BWF metadata) ----
  if (bextPayload) {
    writeString(view, offset, 'bext'); offset += 4;
    view.setUint32(offset, bextPayload.byteLength, true); offset += 4;
    new Uint8Array(buffer, offset, bextPayload.byteLength).set(new Uint8Array(bextPayload));
    offset += bextPayload.byteLength;
    if (bextPayload.byteLength % 2 !== 0) offset += 1; // pad byte
  }

  // ---- fmt chunk ----
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, fmtPayloadSize, true); offset += 4;

  const wFormatTag = isExtensible ? 0xFFFE : (isFloat ? 0x0003 : 0x0001);
  view.setUint16(offset, wFormatTag, true); offset += 2;
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, avgBytesPerSec, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitDepth, true); offset += 2;

  if (isExtensible) {
    // cbSize: 22 bytes of extension data
    view.setUint16(offset, 22, true); offset += 2;
    // wValidBitsPerSample
    view.setUint16(offset, bitDepth, true); offset += 2;
    // dwChannelMask
    const channelMask = numChannels === 1 ? 0x4 : 0x3; // FC or FL|FR
    view.setUint32(offset, channelMask, true); offset += 4;

    // SubFormat GUID (16 bytes)
    // PCM:   {00000001-0000-0010-8000-00AA00389B71}
    // FLOAT: {00000003-0000-0010-8000-00AA00389B71}
    const subFormatCode = isFloat ? 0x0003 : 0x0001;
    view.setUint32(offset, subFormatCode, true); offset += 4;
    view.setUint16(offset, 0x0000, true); offset += 2;
    view.setUint16(offset, 0x0010, true); offset += 2;
    const guidTail = [0x80, 0x00, 0x00, 0xAA, 0x00, 0x38, 0x9B, 0x71];
    for (const b of guidTail) {
      view.setUint8(offset, b); offset += 1;
    }
  }

  // ---- fact chunk ----
  if (needsFact) {
    writeString(view, offset, 'fact'); offset += 4;
    view.setUint32(offset, 4, true); offset += 4;
    view.setUint32(offset, totalFrames, true); offset += 4;
  }

  // ---- data chunk ----
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;

  // Write sample data
  writeSampleData(view, offset, channelData, totalFrames, numChannels, bitDepth, isFloat, onProgress);

  return buffer;
}

/**
 * Signal type display names for filenames.
 */
const SIGNAL_NAMES = {
  ess: 'ESS',
  linear: 'LinearSweep',
  white: 'WhiteNoise',
  pink: 'PinkNoise',
  mls: 'MLS',
  stepped: 'SteppedSine',
};

/**
 * Bit depth display names for filenames.
 */
const DEPTH_NAMES = {
  16: '16bit',
  24: '24bit',
  32: '32float',
};

/**
 * Format a frequency for use in filenames: use kHz when divisible by 1000.
 * e.g. 48000 → "48k", 20000 → "20k", 500 → "500", 44100 → "44.1k"
 * @param {number} freq
 * @returns {string}
 */
function formatFreqForFilename(freq) {
  if (freq >= 1000 && freq % 1000 === 0) {
    return (freq / 1000) + 'k';
  }
  if (freq >= 1000) {
    const kVal = freq / 1000;
    if (Number.isFinite(kVal) && kVal === Math.round(kVal * 10) / 10) {
      return kVal + 'k';
    }
  }
  return String(freq);
}

/**
 * Generate a descriptive filename for the WAV file.
 * Format: {Signal}_{SampleRate}_{FreqRange}_{Duration}_{BitDepth}_{Date}.wav
 * @param {object} params
 * @returns {string}
 */
export function generateFilename(params) {
  const parts = [];
  parts.push(SIGNAL_NAMES[params.signalType] || params.signalType);
  parts.push(formatFreqForFilename(params.sampleRate) + 'Hz');

  if (params.startFreq != null && params.endFreq != null) {
    parts.push(formatFreqForFilename(params.startFreq) + '-' + formatFreqForFilename(params.endFreq) + 'Hz');
  }

  if (params.signalType === 'mls') {
    parts.push('ord' + (params.mlsOrder || 16));
  }

  if (params.duration != null) {
    parts.push(params.duration + 's');
  }

  parts.push(DEPTH_NAMES[params.bitDepth] || params.bitDepth + 'bit');

  const now = new Date();
  const date = now.toISOString().substring(0, 10);
  parts.push(date);

  return parts.join('_') + '.wav';
}

/**
 * Build a BWF description string from generation parameters.
 * @param {object} params
 * @returns {string}
 */
export function buildBwfDescription(params) {
  const parts = [];
  parts.push(SIGNAL_NAMES[params.signalType] || params.signalType);

  if (params.startFreq != null && params.endFreq != null) {
    parts.push(`${params.startFreq}-${params.endFreq} Hz`);
  }

  if (params.duration != null) {
    parts.push(`${params.duration}s`);
  }

  parts.push(`${params.sampleRate} Hz`);
  parts.push(`${params.bitDepth}-bit ${params.format === 'float' ? 'float' : 'PCM'}`);

  if (params.outputLevel != null) {
    parts.push(`${params.outputLevel} dBFS`);
  }

  if (params.fadeInType && params.fadeInType !== 'none') {
    const dur = params.fadeInDuration === '1octave' ? '1oct' : params.fadeInDuration + 's';
    parts.push(`fade-in:${params.fadeInType}/${dur}`);
  }

  if (params.repetitions > 1) {
    parts.push(`${params.repetitions}x reps`);
  }

  const numCh = params.channelMode === 'mono' ? 1 : 2;
  parts.push(numCh === 1 ? 'mono' : 'stereo');

  parts.push('Generated by SineSweepGenerator');
  return parts.join(', ');
}
