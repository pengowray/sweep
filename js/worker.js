// js/worker.js — Web Worker for off-thread signal generation and WAV encoding

import { generateExponentialSweep, generateLinearSweep, generateInverseFilter } from './generators/sweep.js';
import { generateWhiteNoise, generatePinkNoise } from './generators/noise.js';
import { generateMLS } from './generators/mls.js';
import { generateSteppedSine } from './generators/stepped-sine.js';
import { encodeWAV, generateFilename, buildBwfDescription } from './audio/wav-encoder.js';
import {
  applyFades, applyGain, addSilence, repeatWithSilence,
  dBFSToLinear, essOneOctaveFadeSamples, decimateForVisualization
} from './utils.js';

self.onmessage = function (event) {
  const { type, params } = event.data;
  if (type !== 'generate') return;

  try {
    const postProgress = (fraction) => {
      self.postMessage({ type: 'progress', fraction });
    };

    // Phase 1: Generate raw samples (0% - 40%)
    const genProgress = (f) => postProgress(f * 0.4);
    let samples;
    let computedDuration = params.duration;

    switch (params.signalType) {
      case 'ess':
        samples = generateExponentialSweep({
          startFreq: params.startFreq,
          endFreq: params.endFreq,
          sampleRate: params.sampleRate,
          duration: params.duration,
          onProgress: genProgress,
        });
        break;

      case 'linear':
        samples = generateLinearSweep({
          startFreq: params.startFreq,
          endFreq: params.endFreq,
          sampleRate: params.sampleRate,
          duration: params.duration,
          onProgress: genProgress,
        });
        break;

      case 'white':
        samples = generateWhiteNoise({
          sampleRate: params.sampleRate,
          duration: params.duration,
          onProgress: genProgress,
        });
        break;

      case 'pink':
        samples = generatePinkNoise({
          sampleRate: params.sampleRate,
          duration: params.duration,
          onProgress: genProgress,
        });
        break;

      case 'mls':
        samples = generateMLS({
          order: params.mlsOrder || 16,
          sampleRate: params.sampleRate,
          repetitions: 1,
          onProgress: genProgress,
        });
        computedDuration = samples.length / params.sampleRate;
        break;

      case 'stepped':
        samples = generateSteppedSine({
          startFreq: params.startFreq,
          endFreq: params.endFreq,
          sampleRate: params.sampleRate,
          stepsPerOctave: params.stepsPerOctave || 3,
          dwellTime: params.dwellTime || 0.5,
          gapTime: params.gapTime || 0.05,
          spacing: params.steppedSpacing || 'logarithmic',
          onProgress: genProgress,
        });
        computedDuration = samples.length / params.sampleRate;
        break;

      default:
        throw new Error('Unknown signal type: ' + params.signalType);
    }

    postProgress(0.4);

    // Phase 2: Apply fades (40% - 45%)
    let fadeInSamples;
    if (params.fadeInDuration === '1octave' && params.signalType === 'ess') {
      fadeInSamples = essOneOctaveFadeSamples(
        params.startFreq, params.endFreq, params.duration, params.sampleRate
      );
    } else {
      fadeInSamples = Math.round(parseFloat(params.fadeInDuration || 0) * params.sampleRate);
    }
    const fadeOutSamples = Math.round(parseFloat(params.fadeOutDuration || 0) * params.sampleRate);

    applyFades(
      samples,
      params.fadeInType || 'none', fadeInSamples,
      params.fadeOutType || 'none', fadeOutSamples
    );

    postProgress(0.45);

    // Phase 3: Apply output level gain
    const linearGain = dBFSToLinear(params.outputLevel != null ? params.outputLevel : -3);
    applyGain(samples, linearGain);

    // Phase 4: Repetitions (45% - 50%)
    const reps = params.repetitions || 1;
    if (reps > 1) {
      const interSilenceSamples = Math.round((params.interSweepSilence || 0) / 1000 * params.sampleRate);
      samples = repeatWithSilence(samples, reps, interSilenceSamples);
    }

    postProgress(0.50);

    // Phase 5: Add silence padding
    const leadSamples = Math.round((params.leadSilence || 0) / 1000 * params.sampleRate);
    const trailSamples = Math.round((params.trailSilence || 0) / 1000 * params.sampleRate);
    samples = addSilence(samples, leadSamples, trailSamples);

    postProgress(0.55);

    // Phase 6: Send decimated waveform for visualization
    const vizData = decimateForVisualization(samples, 4000);
    const vizBuffer = vizData.buffer.slice(0);
    self.postMessage({
      type: 'visualization',
      samples: vizBuffer,
      sampleRate: params.sampleRate,
      totalSamples: samples.length,
    }, [vizBuffer]);

    postProgress(0.60);

    // Phase 7: Build channel data and encode WAV (60% - 90%)
    const channelMode = params.channelMode || 'mono';
    const numChannels = channelMode === 'mono' ? 1 : 2;
    let channels = null; // pre-built channel arrays for new modes

    if (channelMode === 'stereo-sync') {
      // L = signal, R = sync impulse at sweep start
      const syncChannel = new Float64Array(samples.length);
      syncChannel[leadSamples] = linearGain;
      channels = [samples, syncChannel];

    } else if (channelMode === 'stereo-alternate') {
      // Alternate L/R per repetition: rep0→L, rep1→R, rep2→L, ...
      channels = buildAlternateChannels(samples, reps, leadSamples, trailSamples, params);

    } else if (channelMode === 'stereo-lrb') {
      // L, R, Both cycle per repetition: rep0→L, rep1→R, rep2→Both, rep3→L, ...
      channels = buildLRBChannels(samples, reps, leadSamples, trailSamples, params);
    }

    const bwfDescription = buildBwfDescription(params);
    const channelLabel = numChannels === 1 ? 'mono' : 'stereo';

    const bwfMetadata = {
      description: bwfDescription,
      originator: 'SineSweepGenerator v1.0',
      originatorReference: Date.now().toString(36),
      codingHistory: `A=${params.format === 'float' ? 'FLOAT' : 'PCM'},` +
        `F=${params.sampleRate},W=${params.bitDepth},M=${channelLabel},` +
        `T=SineSweepGenerator\r\n`,
    };

    const encodeProgress = (f) => postProgress(0.60 + f * 0.30);
    const wavBuffer = encodeWAV(samples, {
      sampleRate: params.sampleRate,
      bitDepth: params.bitDepth,
      format: params.format || (params.bitDepth === 32 ? 'float' : 'pcm'),
      numChannels,
      channelMode,
      channels,
      bwfMetadata,
      onProgress: encodeProgress,
    });

    postProgress(0.90);

    const filename = generateFilename({
      ...params,
      duration: computedDuration,
    });

    // Phase 8: Optional inverse filter (90% - 98%)
    let inverseBuffer = null;
    let inverseFilename = null;

    if (params.generateInverse && params.signalType === 'ess') {
      const sweepOnly = generateExponentialSweep({
        startFreq: params.startFreq,
        endFreq: params.endFreq,
        sampleRate: params.sampleRate,
        duration: params.duration,
      });
      const inverseSamples = generateInverseFilter(sweepOnly, {
        startFreq: params.startFreq,
        endFreq: params.endFreq,
        sampleRate: params.sampleRate,
        duration: params.duration,
      });

      inverseBuffer = encodeWAV(inverseSamples, {
        sampleRate: params.sampleRate,
        bitDepth: params.bitDepth,
        format: params.format || (params.bitDepth === 32 ? 'float' : 'pcm'),
        numChannels: 1,
        channelMode: 'mono',
        bwfMetadata: {
          ...bwfMetadata,
          description: 'Inverse filter for ' + bwfDescription,
        },
      });

      inverseFilename = filename.replace(/\.wav$/, '_InverseFilter.wav');
    }

    postProgress(1.0);

    // Transfer buffers (zero-copy)
    const transfer = [wavBuffer];
    if (inverseBuffer) transfer.push(inverseBuffer);

    self.postMessage({
      type: 'complete',
      buffer: wavBuffer,
      filename,
      inverseBuffer,
      inverseFilename,
      totalSamples: samples.length,
      fileSizeBytes: wavBuffer.byteLength,
    }, transfer);

  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};

/**
 * Build stereo channels for alternate L/R mode.
 * Each repetition alternates between L and R channels.
 * Silence regions (lead/trail/inter-sweep) are zero on both channels.
 * @returns {Float64Array[]} [leftChannel, rightChannel]
 */
function buildAlternateChannels(samples, reps, leadSamples, trailSamples, params) {
  const totalLen = samples.length;
  const left = new Float64Array(totalLen);
  const right = new Float64Array(totalLen);

  if (reps <= 1) {
    // Single rep: put on L only
    left.set(samples);
    return [left, right];
  }

  // Compute the single-sweep length (before repetition and silence)
  const sampleRate = params.sampleRate;
  const interSilenceSamples = Math.round((params.interSweepSilence || 0) / 1000 * sampleRate);

  // Find the per-repetition sweep length from the total
  // total = lead + (sweepLen * reps + interSilence * (reps-1)) + trail
  const sweepRegion = totalLen - leadSamples - trailSamples;
  const sweepLen = reps > 1
    ? Math.round((sweepRegion - interSilenceSamples * (reps - 1)) / reps)
    : sweepRegion;

  for (let r = 0; r < reps; r++) {
    const start = leadSamples + r * (sweepLen + interSilenceSamples);
    const end = Math.min(start + sweepLen, totalLen);
    const target = (r % 2 === 0) ? left : right;
    for (let i = start; i < end; i++) {
      target[i] = samples[i];
    }
  }

  return [left, right];
}

/**
 * Build stereo channels for L, R, Both mode.
 * rep0→L only, rep1→R only, rep2→Both, rep3→L, ...
 * @returns {Float64Array[]} [leftChannel, rightChannel]
 */
function buildLRBChannels(samples, reps, leadSamples, trailSamples, params) {
  const totalLen = samples.length;
  const left = new Float64Array(totalLen);
  const right = new Float64Array(totalLen);

  if (reps <= 1) {
    left.set(samples);
    right.set(samples);
    return [left, right];
  }

  const sampleRate = params.sampleRate;
  const interSilenceSamples = Math.round((params.interSweepSilence || 0) / 1000 * sampleRate);

  const sweepRegion = totalLen - leadSamples - trailSamples;
  const sweepLen = reps > 1
    ? Math.round((sweepRegion - interSilenceSamples * (reps - 1)) / reps)
    : sweepRegion;

  for (let r = 0; r < reps; r++) {
    const start = leadSamples + r * (sweepLen + interSilenceSamples);
    const end = Math.min(start + sweepLen, totalLen);
    const phase = r % 3; // 0=L, 1=R, 2=Both

    for (let i = start; i < end; i++) {
      if (phase === 0 || phase === 2) left[i] = samples[i];
      if (phase === 1 || phase === 2) right[i] = samples[i];
    }
  }

  return [left, right];
}
