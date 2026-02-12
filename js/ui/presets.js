// js/ui/presets.js — Preset definitions and application logic

/**
 * @typedef {object} Preset
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} signalType
 * @property {number} sampleRate
 * @property {number} [startFreq]
 * @property {number} [endFreq]
 * @property {number} [duration]
 * @property {number} [bitDepth]
 * @property {string} [bitFormat]
 * @property {number} leadSilence - ms
 * @property {number} trailSilence - ms
 * @property {number} [outputLevel] - dBFS
 * @property {string} [fadeInType]
 * @property {string} [fadeInDuration]
 * @property {string} [fadeOutType]
 * @property {number|string} [fadeOutDuration]
 * @property {string} [channelMode]
 * @property {number} [repetitions]
 * @property {number} [interSweepSilence] - ms
 * @property {boolean} [generateInverse]
 * @property {number} [mlsOrder]
 */

/** @type {Preset[]} */
export const PRESETS = [
  {
    id: 'quick-room',
    name: 'Quick Room Test',
    description: 'Fast ESS sweep for basic room measurement',
    signalType: 'ess',
    sampleRate: 44100,
    startFreq: 20,
    endFreq: 20000,
    duration: 3,
    bitDepth: 24,
    bitFormat: 'pcm',
    leadSilence: 500,
    trailSilence: 2000,
    outputLevel: -3,
    fadeInType: 'hanning',
    fadeInDuration: '1octave',
    fadeOutType: 'hanning',
    fadeOutDuration: '0.05',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    generateInverse: false,
  },
  {
    id: 'full-range',
    name: 'Full Range',
    description: 'Extended frequency range ESS at high sample rate',
    signalType: 'ess',
    sampleRate: 96000,
    startFreq: 5,
    endFreq: 48000,
    duration: 10,
    bitDepth: 24,
    bitFormat: 'pcm',
    leadSilence: 1000,
    trailSilence: 5000,
    outputLevel: -3,
    fadeInType: 'hanning',
    fadeInDuration: '1octave',
    fadeOutType: 'hanning',
    fadeOutDuration: '0.1',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    generateInverse: false,
  },
  {
    id: 'rew-style',
    name: 'REW-Style',
    description: 'Matches typical Room EQ Wizard sweep parameters (256k samples)',
    signalType: 'ess',
    sampleRate: 48000,
    startFreq: 20,
    endFreq: 20000,
    duration: 5.461,
    bitDepth: 24,
    bitFormat: 'pcm',
    leadSilence: 500,
    trailSilence: 3000,
    outputLevel: -3,
    fadeInType: 'hanning',
    fadeInDuration: '1octave',
    fadeOutType: 'hanning',
    fadeOutDuration: '0.05',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    generateInverse: false,
  },
  {
    id: 'smaart-short',
    name: 'SMAART Short',
    description: 'Matches SMAART 128k short impulse response sweep',
    signalType: 'ess',
    sampleRate: 48000,
    startFreq: 20,
    endFreq: 20000,
    duration: 2.667,
    bitDepth: 24,
    bitFormat: 'pcm',
    leadSilence: 500,
    trailSilence: 2000,
    outputLevel: -3,
    fadeInType: 'hanning',
    fadeInDuration: '1octave',
    fadeOutType: 'hanning',
    fadeOutDuration: '0.05',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    generateInverse: false,
  },
  {
    id: 'smaart-long',
    name: 'SMAART Long',
    description: 'Matches SMAART 240k long impulse response sweep',
    signalType: 'ess',
    sampleRate: 48000,
    startFreq: 20,
    endFreq: 20000,
    duration: 5,
    bitDepth: 24,
    bitFormat: 'pcm',
    leadSilence: 500,
    trailSilence: 4000,
    outputLevel: -3,
    fadeInType: 'hanning',
    fadeInDuration: '1octave',
    fadeOutType: 'hanning',
    fadeOutDuration: '0.05',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    generateInverse: false,
  },
  {
    id: 'subwoofer-focus',
    name: 'Subwoofer',
    description: 'Extended low-frequency sweep for subwoofer measurement',
    signalType: 'ess',
    sampleRate: 48000,
    startFreq: 5,
    endFreq: 500,
    duration: 10,
    bitDepth: 24,
    bitFormat: 'pcm',
    leadSilence: 1000,
    trailSilence: 3000,
    outputLevel: -3,
    fadeInType: 'hanning',
    fadeInDuration: '1octave',
    fadeOutType: 'hanning',
    fadeOutDuration: '0.2',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    generateInverse: false,
  },
  {
    id: 'speech-range',
    name: 'Speech Range',
    description: 'Sweep focused on speech intelligibility frequencies',
    signalType: 'ess',
    sampleRate: 48000,
    startFreq: 80,
    endFreq: 8000,
    duration: 5,
    bitDepth: 24,
    bitFormat: 'pcm',
    leadSilence: 500,
    trailSilence: 2000,
    outputLevel: -3,
    fadeInType: 'hanning',
    fadeInDuration: '1octave',
    fadeOutType: 'hanning',
    fadeOutDuration: '0.1',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    generateInverse: false,
  },
  {
    id: 'hires-archival',
    name: 'Hi-Res Archival',
    description: 'Maximum quality capture for archival measurement',
    signalType: 'ess',
    sampleRate: 192000,
    startFreq: 5,
    endFreq: 96000,
    duration: 15,
    bitDepth: 32,
    bitFormat: 'float',
    leadSilence: 1000,
    trailSilence: 10000,
    outputLevel: -3,
    fadeInType: 'hanning',
    fadeInDuration: '1octave',
    fadeOutType: 'hanning',
    fadeOutDuration: '0.2',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    generateInverse: true,
  },
  {
    id: 'white-noise',
    name: 'White Noise',
    description: 'Flat-spectrum white noise for system verification',
    signalType: 'white',
    sampleRate: 48000,
    duration: 5,
    bitDepth: 24,
    bitFormat: 'pcm',
    leadSilence: 100,
    trailSilence: 100,
    outputLevel: -6,
    fadeInType: 'linear',
    fadeInDuration: '0.01',
    fadeOutType: 'linear',
    fadeOutDuration: '0.01',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    generateInverse: false,
  },
  {
    id: 'pink-noise',
    name: 'Pink Noise',
    description: 'Equal energy per octave noise for speaker verification',
    signalType: 'pink',
    sampleRate: 48000,
    duration: 10,
    bitDepth: 24,
    bitFormat: 'pcm',
    leadSilence: 100,
    trailSilence: 100,
    outputLevel: -6,
    fadeInType: 'linear',
    fadeInDuration: '0.01',
    fadeOutType: 'linear',
    fadeOutDuration: '0.01',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    generateInverse: false,
  },
  {
    id: 'mls-measurement',
    name: 'MLS',
    description: 'Order-16 Maximum Length Sequence for impulse response',
    signalType: 'mls',
    sampleRate: 48000,
    mlsOrder: 16,
    bitDepth: 24,
    bitFormat: 'pcm',
    leadSilence: 100,
    trailSilence: 500,
    outputLevel: -3,
    fadeInType: 'none',
    fadeInDuration: '0',
    fadeOutType: 'none',
    fadeOutDuration: '0',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 100,
    generateInverse: false,
  },
];

/**
 * Apply a preset's values to the UI form elements.
 * @param {Preset} preset
 * @param {object} elements - Map of DOM input elements by name/id
 */
export function applyPreset(preset, elements) {
  const fieldMap = {
    signalType: preset.signalType,
    sampleRate: preset.sampleRate,
    startFreq: preset.startFreq,
    endFreq: preset.endFreq,
    duration: preset.duration,
    channelMode: preset.channelMode,
    outputLevel: preset.outputLevel,
    leadSilence: preset.leadSilence,
    trailSilence: preset.trailSilence,
    fadeInType: preset.fadeInType,
    fadeInDuration: preset.fadeInDuration,
    fadeOutType: preset.fadeOutType,
    fadeOutDuration: preset.fadeOutDuration,
    repetitions: preset.repetitions,
    interSweepSilence: preset.interSweepSilence,
    generateInverse: preset.generateInverse,
    mlsOrder: preset.mlsOrder,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value === undefined || !elements[key]) continue;
    const el = elements[key];

    if (el.type === 'checkbox') {
      el.checked = !!value;
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Handle bit depth radio buttons
  if (preset.bitDepth) {
    const radios = document.querySelectorAll('input[name="bitDepth"]');
    for (const radio of radios) {
      radio.checked = (parseInt(radio.value) === preset.bitDepth);
    }
  }
}
