// js/ui/presets.js — Preset definitions and application logic

/**
 * Signal presets — define signal type, frequency range, duration, timing, fades.
 * Do NOT include sampleRate, bitDepth, or outputLevel (those belong to format presets).
 * endFreq: 'nyquist' means half the current sample rate.
 */
export const SIGNAL_PRESETS = [
  {
    id: 'quick-room',
    name: 'Quick Room Test',
    description: 'Fast ESS sweep for basic room measurement',
    signalType: 'ess',
    startFreq: 20,
    endFreq: 20000,
    duration: 3,
    eqCurve: 'none',
    leadSilence: 500,
    trailSilence: 2000,
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
    description: 'Extended frequency range ESS up to Nyquist',
    signalType: 'ess',
    startFreq: 5,
    endFreq: 'nyquist',
    duration: 10,
    eqCurve: 'none',
    leadSilence: 1000,
    trailSilence: 5000,
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
    startFreq: 20,
    endFreq: 20000,
    duration: 5.461,
    eqCurve: 'none',
    leadSilence: 500,
    trailSilence: 3000,
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
    startFreq: 20,
    endFreq: 20000,
    duration: 2.667,
    eqCurve: 'none',
    leadSilence: 500,
    trailSilence: 2000,
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
    startFreq: 20,
    endFreq: 20000,
    duration: 5,
    eqCurve: 'none',
    leadSilence: 500,
    trailSilence: 4000,
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
    startFreq: 5,
    endFreq: 500,
    duration: 10,
    eqCurve: 'none',
    leadSilence: 1000,
    trailSilence: 3000,
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
    startFreq: 80,
    endFreq: 8000,
    duration: 5,
    eqCurve: 'none',
    leadSilence: 500,
    trailSilence: 2000,
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
    name: 'Comprehensive',
    description: 'Long sweep with full bandwidth and inverse filter for comprehensive measurement',
    signalType: 'ess',
    startFreq: 5,
    endFreq: 'nyquist',
    duration: 15,
    eqCurve: 'none',
    leadSilence: 1000,
    trailSilence: 10000,
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
    id: 'a-weighted-sweep',
    name: 'A-Weighted Sweep',
    description: 'ESS sweep with inverse A-weighting for perceptually flat playback',
    signalType: 'ess',
    startFreq: 20,
    endFreq: 20000,
    duration: 5,
    eqCurve: 'a-weight',
    leadSilence: 500,
    trailSilence: 2000,
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
    id: 'phono-preamp-test',
    name: 'Phono Preamp',
    description: 'Inverse RIAA sweep — output through a phono preamp (RIAA playback) should measure flat',
    signalType: 'ess',
    startFreq: 20,
    endFreq: 20000,
    duration: 10,
    eqCurve: 'inverse-riaa',
    leadSilence: 1000,
    trailSilence: 5000,
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
    id: 'white-noise',
    name: 'White Noise',
    description: 'Flat-spectrum white noise for system verification',
    signalType: 'white',
    duration: 5,
    eqCurve: 'none',
    leadSilence: 100,
    trailSilence: 100,
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
    duration: 10,
    eqCurve: 'none',
    leadSilence: 100,
    trailSilence: 100,
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
    mlsOrder: 16,
    eqCurve: 'none',
    leadSilence: 100,
    trailSilence: 500,
    fadeInType: 'none',
    fadeInDuration: '0',
    fadeOutType: 'none',
    fadeOutDuration: '0',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 100,
    generateInverse: false,
  },
  {
    id: 'stepped-third-octave',
    name: '1/3 Octave Steps',
    description: 'Stepped sine at 1/3-octave intervals — standard acoustic measurement',
    signalType: 'stepped',
    startFreq: 20,
    endFreq: 20000,
    stepsPerOctave: 3,
    dwellTime: 0.5,
    gapTime: 0.05,
    steppedSpacing: 'logarithmic',
    eqCurve: 'none',
    leadSilence: 500,
    trailSilence: 1000,
    fadeInType: 'none',
    fadeInDuration: '0',
    fadeOutType: 'none',
    fadeOutDuration: '0',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    generateInverse: false,
  },
  {
    id: 'broadcast-test-tone',
    name: 'Broadcast Test',
    description: 'Stepped tones at standard broadcast frequencies (resembles EBU test signal)',
    signalType: 'stepped',
    startFreq: 100,
    endFreq: 15000,
    stepsPerOctave: 1,
    dwellTime: 1.0,
    gapTime: 0.1,
    steppedSpacing: 'logarithmic',
    eqCurve: 'none',
    leadSilence: 1000,
    trailSilence: 1000,
    fadeInType: 'none',
    fadeInDuration: '0',
    fadeOutType: 'none',
    fadeOutDuration: '0',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    generateInverse: false,
  },

  // ── Pattern presets ────────────────────────────────────────────────────────
  {
    id: 'xdr-burst',
    name: 'XDR Burst',
    description: 'EMI/PolyGram Binary Octave — 11-tone alignment burst at -40 dBFS',
    signalType: 'pattern',
    patternSequenceId: 'xdr-burst',
    leadSilence: 0,
    trailSilence: 500,
    fadeInType: 'none',
    fadeInDuration: '0',
    fadeOutType: 'none',
    fadeOutDuration: '0',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    eqCurve: 'none',
  },
  {
    id: 'bbc-pips',
    name: 'BBC Pips',
    description: 'Greenwich Time Signal — 5×100 ms + 1×500 ms sine at 1 kHz',
    signalType: 'pattern',
    patternSequenceId: 'bbc-pips',
    leadSilence: 0,
    trailSilence: 0,
    fadeInType: 'none',
    fadeInDuration: '0',
    fadeOutType: 'none',
    fadeOutDuration: '0',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    eqCurve: 'none',
  },
  {
    id: 'hearing-test',
    name: 'Hearing Test',
    description: 'ISO 8253-1 Modified Hughson-Westlake PTA protocol (non-interactive)',
    signalType: 'pattern',
    patternSequenceId: 'hearing-test',
    outputLevel: 0,
    leadSilence: 500,
    trailSilence: 1000,
    fadeInType: 'none',
    fadeInDuration: '0',
    fadeOutType: 'none',
    fadeOutDuration: '0',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    eqCurve: 'none',
  },
  {
    id: 'level-staircase',
    name: 'Level Staircase',
    description: '1 kHz stepped 0 to −42 dBFS in 6 dB steps — for meter calibration',
    signalType: 'pattern',
    patternSequenceId: 'level-staircase',
    outputLevel: 0,
    leadSilence: 500,
    trailSilence: 500,
    fadeInType: 'none',
    fadeInDuration: '0',
    fadeOutType: 'none',
    fadeOutDuration: '0',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    eqCurve: 'none',
  },
  {
    id: 'octave-tones',
    name: 'Octave Tones',
    description: 'ISO 266 octave band centres 31.5 Hz–16 kHz at 0 dBFS',
    signalType: 'pattern',
    patternSequenceId: 'octave-tones',
    leadSilence: 500,
    trailSilence: 500,
    fadeInType: 'none',
    fadeInDuration: '0',
    fadeOutType: 'none',
    fadeOutDuration: '0',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    eqCurve: 'none',
  },
  {
    id: 'iso226-equal-loudness',
    name: 'ISO 226 Equal Loudness',
    description: 'Octave tones levelled to ISO 226:2003 70-phon contour — all should sound equally loud',
    signalType: 'pattern',
    patternSequenceId: 'iso226-equal-loudness',
    outputLevel: 0,
    leadSilence: 500,
    trailSilence: 1000,
    fadeInType: 'none',
    fadeInDuration: '0',
    fadeOutType: 'none',
    fadeOutDuration: '0',
    channelMode: 'mono',
    repetitions: 1,
    interSweepSilence: 0,
    eqCurve: 'none',
  },
];

/**
 * Named pattern sequences — the actual tone-burst data for Pattern signal type.
 * Each entry maps to a Pattern preset via patternSequenceId.
 */
export const PATTERN_SEQUENCES = [
  {
    id: 'xdr-burst',
    name: 'XDR Burst',
    description: 'EMI/PolyGram Binary Octave',
    fadeMs: 2,
    sequence: [
      { hz: 31.25,   db: -40, on_ms: 166.67, off_ms: 0 }, // -40 dB marker tone
      { hz: 62.5,    db:   0, on_ms: 166.67, off_ms: 0 },
      { hz: 125.0,   db:   0, on_ms: 166.67, off_ms: 0 },
      { hz: 250.0,   db:   0, on_ms: 166.67, off_ms: 0 },
      { hz: 500.0,   db:   0, on_ms: 166.67, off_ms: 0 },
      { hz: 1000.0,  db:   0, on_ms: 166.67, off_ms: 0 },
      { hz: 2000.0,  db:   0, on_ms: 166.67, off_ms: 0 },
      { hz: 4000.0,  db:   0, on_ms: 166.67, off_ms: 0 },
      { hz: 8000.0,  db:   0, on_ms: 166.67, off_ms: 0 },
      { hz: 16000.0, db:   0, on_ms: 166.67, off_ms: 0 },
      { hz: 18000.0, db:   0, on_ms:  83.33, off_ms: 0 },
    ],
  },
  {
    id: 'bbc-pips',
    name: 'BBC Pips',
    description: 'Greenwich Time Signal',
    fadeMs: 5,
    sequence: [
      { hz: 1000, db: 0, on_ms: 100, off_ms: 900 },
      { hz: 1000, db: 0, on_ms: 100, off_ms: 900 },
      { hz: 1000, db: 0, on_ms: 100, off_ms: 900 },
      { hz: 1000, db: 0, on_ms: 100, off_ms: 900 },
      { hz: 1000, db: 0, on_ms: 100, off_ms: 900 },
      { hz: 1000, db: 0, on_ms: 500, off_ms:   0 },
    ],
  },
  {
    id: 'hearing-test',
    name: 'Hearing Test',
    description: 'ISO 8253-1 Modified Hughson-Westlake PTA. This is not a clinical diagnostic tool.',
    fadeMs: 40,
    sequence: [
      // 1 kHz Anchor (test start)
      { hz: 1000, db: -20.0, on_ms: 225, off_ms: 225 },
      { hz: 1000, db: -20.0, on_ms: 225, off_ms: 225 },
      { hz: 1000, db: -20.0, on_ms: 225, off_ms: 2000 },
      { hz: 1000, db: -30.0, on_ms: 225, off_ms: 225 },
      { hz: 1000, db: -30.0, on_ms: 225, off_ms: 225 },
      { hz: 1000, db: -30.0, on_ms: 225, off_ms: 2000 },
      { hz: 1000, db: -40.0, on_ms: 225, off_ms: 225 },
      { hz: 1000, db: -40.0, on_ms: 225, off_ms: 225 },
      { hz: 1000, db: -40.0, on_ms: 225, off_ms: 3000 },
      
      // 2 kHz
      { hz: 2000, db: -20.5, on_ms: 225, off_ms: 225 },
      { hz: 2000, db: -20.5, on_ms: 225, off_ms: 225 },
      { hz: 2000, db: -20.5, on_ms: 225, off_ms: 2000 },
      { hz: 2000, db: -30.5, on_ms: 225, off_ms: 225 },
      { hz: 2000, db: -30.5, on_ms: 225, off_ms: 225 },
      { hz: 2000, db: -30.5, on_ms: 225, off_ms: 2000 },
      { hz: 2000, db: -40.5, on_ms: 225, off_ms: 225 },
      { hz: 2000, db: -40.5, on_ms: 225, off_ms: 225 },
      { hz: 2000, db: -40.5, on_ms: 225, off_ms: 3000 },

      // 4 kHz
      { hz: 4000, db: -22.0, on_ms: 225, off_ms: 225 },
      { hz: 4000, db: -22.0, on_ms: 225, off_ms: 225 },
      { hz: 4000, db: -22.0, on_ms: 225, off_ms: 2000 },
      { hz: 4000, db: -32.0, on_ms: 225, off_ms: 225 },
      { hz: 4000, db: -32.0, on_ms: 225, off_ms: 225 },
      { hz: 4000, db: -32.0, on_ms: 225, off_ms: 2000 },
      { hz: 4000, db: -42.0, on_ms: 225, off_ms: 225 },
      { hz: 4000, db: -42.0, on_ms: 225, off_ms: 225 },
      { hz: 4000, db: -42.0, on_ms: 225, off_ms: 3000 },
      
      
      // 8 kHz
      { hz: 8000, db: -15.0, on_ms: 225, off_ms: 225 },
      { hz: 8000, db: -15.0, on_ms: 225, off_ms: 225 },
      { hz: 8000, db: -15.0, on_ms: 225, off_ms: 2000 },
      { hz: 8000, db: -25.0, on_ms: 225, off_ms: 225 },
      { hz: 8000, db: -25.0, on_ms: 225, off_ms: 225 },
      { hz: 8000, db: -25.0, on_ms: 225, off_ms: 2000 },
      { hz: 8000, db: -35.0, on_ms: 225, off_ms: 225 },
      { hz: 8000, db: -35.0, on_ms: 225, off_ms: 225 },
      { hz: 8000, db: -35.0, on_ms: 225, off_ms: 3000 },
      
      // 12 kHz (extended high)
      { hz: 12000, db: -12.0, on_ms: 225, off_ms: 225 },
      { hz: 12000, db: -12.0, on_ms: 225, off_ms: 225 },
      { hz: 12000, db: -12.0, on_ms: 225, off_ms: 2000 },
      { hz: 12000, db: -22.0, on_ms: 225, off_ms: 225 },
      { hz: 12000, db: -22.0, on_ms: 225, off_ms: 225 },
      { hz: 12000, db: -22.0, on_ms: 225, off_ms: 2000 },
      { hz: 12000, db: -32.0, on_ms: 225, off_ms: 225 },
      { hz: 12000, db: -32.0, on_ms: 225, off_ms: 225 },
      { hz: 12000, db: -32.0, on_ms: 225, off_ms: 3000 },
      
      // 1 kHz reliability retest
      { hz: 1000, db: -20.0, on_ms: 225, off_ms: 225 },
      { hz: 1000, db: -20.0, on_ms: 225, off_ms: 225 },
      { hz: 1000, db: -20.0, on_ms: 225, off_ms: 3000 },
      
      // 500 Hz
      { hz: 500, db: -12.0, on_ms: 225, off_ms: 225 },
      { hz: 500, db: -12.0, on_ms: 225, off_ms: 225 },
      { hz: 500, db: -12.0, on_ms: 225, off_ms: 2000 },
      { hz: 500, db: -22.0, on_ms: 225, off_ms: 225 },
      { hz: 500, db: -22.0, on_ms: 225, off_ms: 225 },
      { hz: 500, db: -22.0, on_ms: 225, off_ms: 2000 },
      { hz: 500, db: -32.0, on_ms: 225, off_ms: 225 },
      { hz: 500, db: -32.0, on_ms: 225, off_ms: 225 },
      { hz: 500, db: -32.0, on_ms: 225, off_ms: 3000 },

      // 250 Hz
      { hz: 250, db:  -8.0, on_ms: 225, off_ms: 225 },
      { hz: 250, db:  -8.0, on_ms: 225, off_ms: 225 },
      { hz: 250, db:  -8.0, on_ms: 225, off_ms: 2000 },
      { hz: 250, db: -18.0, on_ms: 225, off_ms: 225 },
      { hz: 250, db: -18.0, on_ms: 225, off_ms: 225 },
      { hz: 250, db: -18.0, on_ms: 225, off_ms: 2000 },
      { hz: 250, db: -28.0, on_ms: 225, off_ms: 225 },
      { hz: 250, db: -28.0, on_ms: 225, off_ms: 225 },
      { hz: 250, db: -28.0, on_ms: 225, off_ms: 3000 },

      // 125 Hz (deep bass)
      { hz: 125, db:  -4.0, on_ms: 225, off_ms: 225 },
      { hz: 125, db:  -4.0, on_ms: 225, off_ms: 225 },
      { hz: 125, db:  -4.0, on_ms: 225, off_ms: 2000 },
      { hz: 125, db: -14.0, on_ms: 225, off_ms: 225 },
      { hz: 125, db: -14.0, on_ms: 225, off_ms: 225 },
      { hz: 125, db: -14.0, on_ms: 225, off_ms: 2000 },
      { hz: 125, db: -24.0, on_ms: 225, off_ms: 225 },
      { hz: 125, db: -24.0, on_ms: 225, off_ms: 225 },
      { hz: 125, db: -24.0, on_ms: 225, off_ms: 1000 },
    ],
  },
  {
    id: 'level-staircase',
    name: 'Level Staircase',
    description: '1 kHz stepped from 0 to −42 dBFS in 6 dB steps — for meter calibration',
    fadeMs: 5,
    sequence: [
      { hz: 1000, db:   0, on_ms: 1000, off_ms: 500 },
      { hz: 1000, db:  -6, on_ms: 1000, off_ms: 500 },
      { hz: 1000, db: -12, on_ms: 1000, off_ms: 500 },
      { hz: 1000, db: -18, on_ms: 1000, off_ms: 500 },
      { hz: 1000, db: -24, on_ms: 1000, off_ms: 500 },
      { hz: 1000, db: -30, on_ms: 1000, off_ms: 500 },
      { hz: 1000, db: -36, on_ms: 1000, off_ms: 500 },
      { hz: 1000, db: -42, on_ms: 1000, off_ms: 500 },
    ],
  },
  {
    id: 'octave-tones',
    name: 'Octave Tones',
    description: 'ISO 266 octave band centres 31.5 Hz–16 kHz — for frequency response spot-checks',
    fadeMs: 10,
    sequence: [
      { hz: 31.5,  db: 0, on_ms: 1000, off_ms: 500 },
      { hz: 63,    db: 0, on_ms: 1000, off_ms: 500 },
      { hz: 125,   db: 0, on_ms: 1000, off_ms: 500 },
      { hz: 250,   db: 0, on_ms: 1000, off_ms: 500 },
      { hz: 500,   db: 0, on_ms: 1000, off_ms: 500 },
      { hz: 1000,  db: 0, on_ms: 1000, off_ms: 500 },
      { hz: 2000,  db: 0, on_ms: 1000, off_ms: 500 },
      { hz: 4000,  db: 0, on_ms: 1000, off_ms: 500 },
      { hz: 8000,  db: 0, on_ms: 1000, off_ms: 500 },
      { hz: 16000, db: 0, on_ms: 1000, off_ms: 500 },
    ],
  },
  {
    id: 'iso226-equal-loudness',
    name: 'ISO 226 Equal Loudness',
    // Levels computed from ISO 226:2003 Table 1 parameters using the standard formula,
    // normalised so the highest-level frequency (125 Hz) is at 0 dBFS.
    // At 70 phons: 125 Hz = 82.9 dB SPL, 4 kHz = 68.0 dB SPL (most sensitive), 8 kHz = 81.5 dB SPL.
    // The 500–2000 Hz region is nearly flat (±1.5 dB) at this loudness level.
    // Use outputLevel: 0 — the db values here are the actual dBFS amplitudes.
    description: 'ISO 226:2003 70-phon equal-loudness contour (125 Hz–8 kHz) — set outputLevel to 0',
    fadeMs: 10,
    sequence: [
      { hz: 125,  db:   0.0, on_ms: 1500, off_ms: 500 }, // 82.9 dB SPL at 70 phons
      { hz: 250,  db:  -7.0, on_ms: 1500, off_ms: 500 }, // 75.9 dB SPL
      { hz: 500,  db: -11.4, on_ms: 1500, off_ms: 500 }, // 71.5 dB SPL
      { hz: 1000, db: -12.9, on_ms: 1500, off_ms: 500 }, // 70.0 dB SPL (reference)
      { hz: 2000, db: -12.6, on_ms: 1500, off_ms: 500 }, // 70.3 dB SPL
      { hz: 4000, db: -14.9, on_ms: 1500, off_ms: 500 }, // 68.0 dB SPL (most sensitive)
      { hz: 8000, db:  -1.4, on_ms: 1500, off_ms: 500 }, // 81.5 dB SPL
    ],
  },
];

/**
 * Format presets — define sample rate, bit depth, and output level.
 */
export const FORMAT_PRESETS = [
  {
    id: 'cd-quality',
    name: 'CD Quality',
    description: '44.1 kHz / 16-bit PCM',
    sampleRate: 44100,
    bitDepth: 16,
    bitFormat: 'pcm',
    outputLevel: -3,
  },
  {
    id: 'broadcast',
    name: 'Broadcast',
    description: '48 kHz / 24-bit PCM',
    sampleRate: 48000,
    bitDepth: 24,
    bitFormat: 'pcm',
    outputLevel: -3,
  },
  {
    id: 'hires',
    name: 'Hi-Res',
    description: '96 kHz / 24-bit PCM',
    sampleRate: 96000,
    bitDepth: 24,
    bitFormat: 'pcm',
    outputLevel: -3,
  },
  {
    id: 'studio-max',
    name: 'Studio Max',
    description: '192 kHz / 32-bit Float',
    sampleRate: 192000,
    bitDepth: 32,
    bitFormat: 'float',
    outputLevel: -3,
  },
  {
    id: 'chiropterologist',
    name: 'Chiropterologist',
    emoji: '\u{1F987}',
    description: '384 kHz / 24-bit — Bat detector and ultrasonic measurement',
    sampleRate: 384000,
    bitDepth: 24,
    bitFormat: 'pcm',
    outputLevel: -3,
  },
];

/**
 * Apply a signal preset's values to the UI form elements.
 * Skips format fields (sampleRate, bitDepth, outputLevel).
 * @param {object} preset
 * @param {object} elements - Map of DOM input elements by name/id
 * @param {number} currentSampleRate - Current sample rate for resolving 'nyquist'
 */
export function applySignalPreset(preset, elements, currentSampleRate) {
  const fieldMap = {
    signalType: preset.signalType,
    startFreq: preset.startFreq,
    duration: preset.duration,
    channelMode: preset.channelMode,
    leadSilence: preset.leadSilence,
    trailSilence: preset.trailSilence,
    fadeInType: preset.fadeInType,
    fadeInDuration: preset.fadeInDuration,
    fadeOutType: preset.fadeOutType,
    fadeOutDuration: preset.fadeOutDuration,
    repetitions: preset.repetitions,
    interSweepSilence: preset.interSweepSilence,
    generateInverse: preset.generateInverse,
    eqCurve: preset.eqCurve,
    mlsOrder: preset.mlsOrder,
    stepsPerOctave: preset.stepsPerOctave,
    dwellTime: preset.dwellTime,
    gapTime: preset.gapTime,
    steppedSpacing: preset.steppedSpacing,
  };

  // Resolve 'nyquist' endFreq and sync fullBandwidth checkbox
  let endFreq = preset.endFreq;
  const isNyquist = endFreq === 'nyquist';
  if (isNyquist) {
    endFreq = Math.floor(currentSampleRate / 2);
  }
  fieldMap.endFreq = endFreq;

  // Set fullBandwidth checkbox if present
  if (elements.fullBandwidth && preset.endFreq !== undefined) {
    elements.fullBandwidth.checked = isNyquist;
    elements.fullBandwidth.dispatchEvent(new Event('change', { bubbles: true }));
  }

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

  // For Pattern signal type: select the sequence by id, which triggers patternData to be set
  if (preset.patternSequenceId !== undefined && elements.patternSequenceSelect) {
    elements.patternSequenceSelect.value = preset.patternSequenceId;
    elements.patternSequenceSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Allow signal presets to optionally override outputLevel (e.g. calibrated hearing test)
  if (preset.outputLevel !== undefined && elements.outputLevel) {
    elements.outputLevel.value = preset.outputLevel;
    elements.outputLevel.dispatchEvent(new Event('input', { bubbles: true }));
    elements.outputLevel.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Apply a format preset's values to the UI form elements.
 * Only sets sampleRate, bitDepth, and outputLevel.
 * @param {object} preset
 * @param {object} elements - Map of DOM input elements by name/id
 */
export function applyFormatPreset(preset, elements) {
  if (preset.sampleRate != null && elements.sampleRate) {
    elements.sampleRate.value = preset.sampleRate;
    elements.sampleRate.dispatchEvent(new Event('input', { bubbles: true }));
    elements.sampleRate.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (preset.outputLevel != null && elements.outputLevel) {
    elements.outputLevel.value = preset.outputLevel;
    elements.outputLevel.dispatchEvent(new Event('input', { bubbles: true }));
    elements.outputLevel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Handle bit depth radio buttons
  if (preset.bitDepth) {
    const radios = document.querySelectorAll('input[name="bitDepth"]');
    for (const radio of radios) {
      radio.checked = (parseInt(radio.value) === preset.bitDepth);
    }
    // Dispatch change on the checked radio
    const checked = document.querySelector('input[name="bitDepth"]:checked');
    if (checked) {
      checked.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}
