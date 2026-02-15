// js/app.js — Main controller: UI bindings, state, orchestration

import { SIGNAL_PRESETS, FORMAT_PRESETS, applySignalPreset, applyFormatPreset } from './ui/presets.js';
import { Visualizer } from './ui/visualizer.js';
import { PreviewPlayer } from './audio/preview.js';
import { estimateFileSize, formatFileSize, dBFSToLinear, essOneOctaveFadeSamples } from './utils.js';
import { generateExponentialSweep, generateLinearSweep } from './generators/sweep.js';
import { generateWhiteNoise, generatePinkNoise } from './generators/noise.js';
import { generateMLS, mlsDuration } from './generators/mls.js';
import { generateSteppedSine, steppedSineDuration, computeSteppedFrequencies } from './generators/stepped-sine.js';
import { generatePattern, patternDuration } from './generators/pattern.js';
import { applyFades, applyGain, addSilence, repeatWithSilence, applyEQ } from './utils.js';

// ─── DOM References ───────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  signalType: $('signalType'),
  sampleRate: $('sampleRate'),
  startFreq: $('startFreq'),
  endFreq: $('endFreq'),
  fullBandwidth: $('fullBandwidth'),
  duration: $('duration'),
  channelMode: $('channelMode'),
  outputLevel: $('outputLevel'),
  outputLevelDisplay: $('outputLevelDisplay'),
  outputLevelInput: $('outputLevelInput'),
  leadSilence: $('leadSilence'),
  trailSilence: $('trailSilence'),
  fadeInType: $('fadeInType'),
  fadeInDuration: $('fadeInDuration'),
  fadeOutType: $('fadeOutType'),
  fadeOutDuration: $('fadeOutDuration'),
  repetitions: $('repetitions'),
  interSweepSilence: $('interSweepSilence'),
  generateInverse: $('generateInverse'),
  eqCurve: $('eqCurve'),
  eqCurveHint: $('eqCurveHint'),
  dither: $('dither'),
  ditherGroup: $('ditherGroup'),
  mlsOrder: $('mlsOrder'),
  stepsPerOctave: $('stepsPerOctave'),
  dwellTime: $('dwellTime'),
  gapTime: $('gapTime'),
  steppedSpacing: $('steppedSpacing'),
  noiseSeed: $('noiseSeed'),
  randomizeSeedBtn: $('randomizeSeedBtn'),

  // UI groups
  startFreqGroup: $('startFreqGroup'),
  endFreqGroup: $('endFreqGroup'),
  durationGroup: $('durationGroup'),
  seedGroup: $('seedGroup'),
  mlsControls: $('mlsControls'),
  steppedControls: $('steppedControls'),
  patternControls: $('patternControls'),
  patternData: $('patternData'),
  patternInfo: $('patternInfo'),
  inverseFilterGroup: $('inverseFilterGroup'),
  eqCurveGroup: $('eqCurveGroup'),
  fadeInDurationGroup: $('fadeInDurationGroup'),
  fadeInTypeGroup: $('fadeInTypeGroup'),
  fadeOutTypeGroup: $('fadeOutTypeGroup'),
  fadeOutDurationGroup: $('fadeOutDurationGroup'),
  repetitionsGroup: $('repetitionsGroup'),
  interSweepSilenceGroup: $('interSweepSilenceGroup'),
  freqPlotWrapper: $('freqPlotWrapper'),
  freqPreset0: $('freqPreset0'),
  mlsDuration: $('mlsDuration'),

  // Actions
  previewBtn: $('previewBtn'),
  stopBtn: $('stopBtn'),
  generateBtn: $('generateBtn'),
  previewIcon: $('previewIcon'),
  previewNote: $('previewNote'),

  // Progress
  progressSection: $('progressSection'),
  progressBar: $('progressBar'),
  progressText: $('progressText'),

  // Info
  fileInfo: $('fileInfo'),
  fileInfoGrid: $('fileInfoGrid'),
  estimatedSize: $('estimatedSize'),
  sizeWarning: $('sizeWarning'),

  // Canvases & overlays
  waveformCanvas: $('waveformCanvas'),
  frequencyCanvas: $('frequencyCanvas'),
  waveformWrapper: $('waveformWrapper'),
  staleOverlay: $('staleOverlay'),
  signalPresetsBar: $('signal-presets-bar'),
  formatPresetsBar: $('format-presets-bar'),
};

// ─── Modules ──────────────────────────────────────────────────────
const visualizer = new Visualizer(els.waveformCanvas, els.frequencyCanvas);
const previewPlayer = new PreviewPlayer();

let generationWorker = null;
let activeSignalPresetBtn = null;
let activeFormatPresetBtn = null;

// Track auto-set repetitions so we can revert when switching channel modes
let autoRepsSet = false;
let prevRepsBeforeAuto = 1;

// Debounce timer for visualization updates
let vizDebounceTimer = null;
const VIZ_DEBOUNCE_MS = 300;

// Track whether visualization is stale (parameters changed during playback)
let vizStale = false;

// ─── Gather Parameters ───────────────────────────────────────────
function getParams() {
  const bitDepthRadio = document.querySelector('input[name="bitDepth"]:checked');
  const bitDepth = bitDepthRadio ? parseInt(bitDepthRadio.value) : 24;

  return {
    signalType: els.signalType.value,
    sampleRate: parseInt(els.sampleRate.value),
    startFreq: parseFloat(els.startFreq.value),
    endFreq: parseFloat(els.endFreq.value),
    duration: parseFloat(els.duration.value),
    bitDepth,
    format: bitDepth === 32 ? 'float' : 'pcm',
    channelMode: els.channelMode.value,
    outputLevel: parseFloat(els.outputLevel.value),
    leadSilence: parseFloat(els.leadSilence.value) || 0,
    trailSilence: parseFloat(els.trailSilence.value) || 0,
    fadeInType: els.fadeInType.value,
    fadeInDuration: els.fadeInDuration.value,
    fadeOutType: els.fadeOutType.value,
    fadeOutDuration: els.fadeOutDuration.value,
    repetitions: parseInt(els.repetitions.value) || 1,
    interSweepSilence: parseFloat(els.interSweepSilence.value) || 0,
    generateInverse: els.generateInverse.checked,
    eqCurve: els.eqCurve.value,
    dither: els.dither.value,
    mlsOrder: parseInt(els.mlsOrder.value),
    stepsPerOctave: parseInt(els.stepsPerOctave.value),
    dwellTime: parseFloat(els.dwellTime.value),
    gapTime: parseFloat(els.gapTime.value),
    steppedSpacing: els.steppedSpacing.value,
    seed: parseInt(els.noiseSeed.value) || 0,
    ...(() => {
      const pd = JSON.parse(els.patternData?.value || '{"fadeMs":5,"sequence":[]}');
      return { patternSequence: pd.sequence || [], patternFadeMs: pd.fadeMs ?? 5 };
    })(),
  };
}

// ─── UI Visibility Based on Signal Type ──────────────────────────
function updateVisibility() {
  const type = els.signalType.value;

  const hasFreq = ['ess', 'linear', 'stepped'].includes(type);
  const isMLS = type === 'mls';
  const isStepped = type === 'stepped';
  const isPattern = type === 'pattern';
  const isESS = type === 'ess';
  const isSweep = ['ess', 'linear'].includes(type);
  const isNoise = ['white', 'pink'].includes(type);
  const hasFreqPlot = hasFreq || isPattern;

  els.startFreqGroup.hidden = !hasFreq;
  els.endFreqGroup.hidden = !hasFreq;
  els.durationGroup.hidden = isMLS;
  els.mlsControls.hidden = !isMLS;
  els.steppedControls.hidden = !isStepped;
  els.patternControls.hidden = !isPattern;
  els.inverseFilterGroup.hidden = !isESS;
  els.freqPlotWrapper.hidden = !hasFreqPlot;

  // Show seed input only for noise types
  els.seedGroup.hidden = !isNoise;

  // 0 Hz preset only enabled for linear sweep
  els.freqPreset0.disabled = type !== 'linear';

  // Show "1 octave" option only for ESS
  const oneOctOpt = els.fadeInDuration.querySelector('option[value="1octave"]');
  if (oneOctOpt) {
    oneOctOpt.hidden = !isESS;
    if (!isESS && els.fadeInDuration.value === '1octave') {
      els.fadeInDuration.value = '0.05';
    }
  }

  // Grey out channel options that don't apply to the current signal type
  updateChannelOptions(type, isNoise, isSweep, isMLS);

  // Grey out advanced settings that don't apply
  updateAdvancedVisibility(type, isESS, isSweep, isNoise, isMLS, isStepped, isPattern);

  // Update MLS duration display
  if (isMLS) {
    const dur = mlsDuration(parseInt(els.mlsOrder.value), parseInt(els.sampleRate.value));
    els.mlsDuration.textContent = dur.toFixed(3) + 's';
  }

  // Disable duration field for stepped sine and show computed time
  if (isStepped) {
    const dur = steppedSineDuration({
      startFreq: parseFloat(els.startFreq.value),
      endFreq: parseFloat(els.endFreq.value),
      stepsPerOctave: parseInt(els.stepsPerOctave.value),
      dwellTime: parseFloat(els.dwellTime.value),
      gapTime: parseFloat(els.gapTime.value),
      spacing: els.steppedSpacing.value,
    });
    els.duration.value = dur.toFixed(2);
    els.duration.disabled = true;
  } else if (isPattern) {
    const pd = JSON.parse(els.patternData?.value || '{"sequence":[]}');
    const dur = patternDuration(pd.sequence || []);
    els.duration.value = dur.toFixed(3);
    els.duration.disabled = true;
    if (els.patternInfo) {
      els.patternInfo.textContent = `${(pd.sequence || []).length} steps · ${dur.toFixed(3)}s`;
    }
  } else if (!isMLS) {
    els.duration.disabled = false;
  }

  // Update preview note
  updatePreviewNote();

  updateEstimatedSize();
  updateFrequencyPlot();
}

// ─── Full Bandwidth ─────────────────────────────────────────────
function applyFullBandwidth() {
  if (els.fullBandwidth.checked) {
    const sr = parseInt(els.sampleRate.value);
    els.endFreq.value = Math.floor(sr / 2);
    els.endFreq.disabled = true;
    els.endFreq.dispatchEvent(new Event('input', { bubbles: true }));
    els.endFreq.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    els.endFreq.disabled = false;
  }
}

// ─── Channel Options Filtering ──────────────────────────────────
function updateChannelOptions(type, isNoise, isSweep, isMLS) {
  const options = els.channelMode.querySelectorAll('option');
  const currentValue = els.channelMode.value;
  let needsReset = false;

  for (const opt of options) {
    const dataFor = opt.getAttribute('data-for');
    let enabled = true;

    if (dataFor === 'noise' && !isNoise) enabled = false;
    if (dataFor === 'sweep' && !isSweep) enabled = false;

    opt.disabled = !enabled;
    if (!enabled && opt.value === currentValue) {
      needsReset = true;
    }
  }

  if (needsReset) {
    els.channelMode.value = 'mono';
    els.channelMode.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// ─── Advanced Settings Visibility ───────────────────────────────
function updateAdvancedVisibility(type, isESS, isSweep, isNoise, isMLS, isStepped, isPattern) {
  // Fades: relevant for sweeps and noise; Pattern handles fades internally, MLS has none
  const hasFades = !isMLS && !isPattern;
  els.fadeInTypeGroup.style.opacity = hasFades ? '1' : '0.4';
  els.fadeInTypeGroup.style.pointerEvents = hasFades ? '' : 'none';
  els.fadeOutTypeGroup.style.opacity = hasFades ? '1' : '0.4';
  els.fadeOutTypeGroup.style.pointerEvents = hasFades ? '' : 'none';
  els.fadeInDurationGroup.style.opacity = hasFades ? '1' : '0.4';
  els.fadeInDurationGroup.style.pointerEvents = hasFades ? '' : 'none';
  els.fadeOutDurationGroup.style.opacity = hasFades ? '1' : '0.4';
  els.fadeOutDurationGroup.style.pointerEvents = hasFades ? '' : 'none';

  // Repetitions & inter-sweep silence: relevant for sweeps and MLS
  const hasReps = isSweep || isMLS || isStepped;
  els.repetitionsGroup.style.opacity = hasReps ? '1' : '0.4';
  els.repetitionsGroup.style.pointerEvents = hasReps ? '' : 'none';
  els.interSweepSilenceGroup.style.opacity = hasReps ? '1' : '0.4';
  els.interSweepSilenceGroup.style.pointerEvents = hasReps ? '' : 'none';
  if (!hasReps) {
    els.repetitions.value = 1;
  }

  // Inverse filter: ESS only (already hidden, but also grey)
  els.inverseFilterGroup.style.opacity = isESS ? '1' : '0.4';
  els.inverseFilterGroup.style.pointerEvents = isESS ? '' : 'none';

  // EQ: sweep types only (ESS, linear, stepped)
  const hasEQ = isSweep || isStepped;
  els.eqCurveGroup.style.opacity = hasEQ ? '1' : '0.4';
  els.eqCurveGroup.style.pointerEvents = hasEQ ? '' : 'none';
  if (!hasEQ) els.eqCurve.value = 'none';
}

// ─── Dither Default by Bit Depth ────────────────────────────────
function updateDitherDefault() {
  const bitDepth = parseInt(document.querySelector('input[name="bitDepth"]:checked')?.value) || 24;
  if (bitDepth === 16 && els.dither.value === 'off') {
    els.dither.value = 'all';
  } else if (bitDepth === 32 && els.dither.value !== 'off' && els.dither.value !== 'silence') {
    // For float, "all" and "audio" dithering on signal content is meaningless — reset to silence-only
    els.dither.value = 'silence';
  }
}

// ─── Preview Quality Note ───────────────────────────────────────
function updatePreviewNote() {
  const params = getParams();
  const previewRate = Math.min(params.sampleRate, 48000);
  if (previewRate < params.sampleRate) {
    els.previewNote.textContent =
      `Preview plays at ${previewRate / 1000} kHz (download will be ${params.sampleRate / 1000} kHz)`;
  } else {
    els.previewNote.textContent = '';
  }
}

// ─── Estimated File Size ─────────────────────────────────────────
function updateEstimatedSize() {
  const params = getParams();

  // For MLS, duration is computed
  if (params.signalType === 'mls') {
    params.duration = mlsDuration(params.mlsOrder, params.sampleRate);
  }
  // For stepped sine, compute duration
  if (params.signalType === 'stepped') {
    params.duration = steppedSineDuration({
      startFreq: params.startFreq,
      endFreq: params.endFreq,
      stepsPerOctave: params.stepsPerOctave,
      dwellTime: params.dwellTime,
      gapTime: params.gapTime,
      spacing: params.steppedSpacing,
    });
  }

  const bytes = estimateFileSize(params);

  if (!isFinite(bytes) || bytes < 0) {
    els.estimatedSize.textContent = '—';
    els.sizeWarning.hidden = true;
  } else if (bytes > 200 * 1024 * 1024) {
    els.estimatedSize.textContent = formatFileSize(bytes);
    els.sizeWarning.textContent = 'Very large file — generation may be slow or fail on some devices';
    els.sizeWarning.hidden = false;
  } else if (bytes > 50 * 1024 * 1024) {
    els.estimatedSize.textContent = formatFileSize(bytes);
    els.sizeWarning.textContent = 'Large file — generation may take a moment';
    els.sizeWarning.hidden = false;
  } else {
    els.estimatedSize.textContent = formatFileSize(bytes);
    els.sizeWarning.hidden = true;
  }
}

// ─── Frequency Plot Update ───────────────────────────────────────
function updateFrequencyPlot() {
  const type = els.signalType.value;
  if (!['ess', 'linear', 'stepped', 'pattern'].includes(type)) return;

  const reps = parseInt(els.repetitions.value) || 1;
  let duration = parseFloat(els.duration.value) || 5;
  const interSilence = parseFloat(els.interSweepSilence.value) || 0;

  const plotParams = {
    startFreq: parseFloat(els.startFreq.value),
    endFreq: parseFloat(els.endFreq.value),
    type: type === 'ess' ? 'exponential' : type,
    leadSilence: parseFloat(els.leadSilence.value) || 0,
    trailSilence: parseFloat(els.trailSilence.value) || 0,
    repetitions: reps,
    interSweepSilence: interSilence,
  };

  if (type === 'stepped') {
    plotParams.dwellTime = parseFloat(els.dwellTime.value);
    plotParams.gapTime = parseFloat(els.gapTime.value);
    plotParams.steppedFrequencies = computeSteppedFrequencies(
      plotParams.startFreq, plotParams.endFreq,
      parseInt(els.stepsPerOctave.value),
      els.steppedSpacing.value
    );
    // Use computed duration (determined by step params, not UI duration field)
    duration = plotParams.steppedFrequencies.length * (plotParams.dwellTime + plotParams.gapTime);
  } else if (type === 'pattern') {
    const pd = JSON.parse(els.patternData?.value || '{"sequence":[]}');
    plotParams.patternSequence = pd.sequence || [];
    duration = patternDuration(plotParams.patternSequence);
  }

  // Total sweep duration accounting for repetitions
  const totalSweepDuration = reps > 1
    ? duration * reps + (interSilence / 1000) * (reps - 1)
    : duration;

  plotParams.duration = totalSweepDuration;
  plotParams.singleSweepDuration = duration;

  visualizer.drawFrequencyPlot(plotParams);
}

// ─── Debounced Visualization Update ──────────────────────────────
function scheduleVizUpdate() {
  if (vizDebounceTimer) clearTimeout(vizDebounceTimer);
  vizDebounceTimer = setTimeout(() => {
    vizDebounceTimer = null;
    regenerateVisualization();
  }, VIZ_DEBOUNCE_MS);
}

function regenerateVisualization() {
  // If playing, mark as stale instead of regenerating
  if (previewPlayer.isPlaying) {
    vizStale = true;
    els.staleOverlay.hidden = false;
    return;
  }

  vizStale = false;
  els.staleOverlay.hidden = true;

  const params = getParams();
  const previewRate = Math.min(params.sampleRate, 48000);

  try {
    const { left, right, isStereo } = buildPreviewChannels(params, previewRate);
    if (!left) return;

    if (isStereo) {
      visualizer.drawStereoWaveform(left, right, previewRate);
    } else {
      visualizer.drawWaveform(left, previewRate);
    }
  } catch (e) {
    // Silently fail — user is probably mid-edit
  }
}

// ─── Progress UI ─────────────────────────────────────────────────
function showProgress(show) {
  els.progressSection.hidden = !show;
}

function updateProgress(fraction, text) {
  els.progressBar.style.width = Math.round(fraction * 100) + '%';
  if (text) els.progressText.textContent = text;
}

// ─── File Info Display ───────────────────────────────────────────
function showFileInfo(params, totalSamples, fileSizeBytes) {
  els.fileInfo.hidden = false;

  const items = [];
  const signalNames = {
    ess: 'ESS', linear: 'Linear Sweep', white: 'White Noise',
    pink: 'Pink Noise', mls: 'MLS', stepped: 'Stepped Sine'
  };

  items.push(['Signal', signalNames[params.signalType] || params.signalType]);
  items.push(['Rate', (params.sampleRate / 1000) + ' kHz']);

  if (params.startFreq != null && params.endFreq != null &&
    ['ess', 'linear', 'stepped'].includes(params.signalType)) {
    items.push(['Range', params.startFreq + '–' + params.endFreq + ' Hz']);
  }

  items.push(['Samples', totalSamples.toLocaleString()]);
  items.push(['Depth', params.bitDepth + '-bit ' + (params.format === 'float' ? 'float' : 'PCM')]);
  items.push(['Size', formatFileSize(fileSizeBytes)]);

  els.fileInfoGrid.innerHTML = items.map(([label, value]) =>
    `<div class="info-item"><span class="info-label">${label}:</span><span class="info-value">${value}</span></div>`
  ).join('');
}

// ─── Download Trigger ────────────────────────────────────────────
function triggerDownload(buffer, filename) {
  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── Generate & Download (Worker) ────────────────────────────────
function startGeneration() {
  const params = getParams();

  // For MLS, set duration from order
  if (params.signalType === 'mls') {
    params.duration = mlsDuration(params.mlsOrder, params.sampleRate);
  }

  // For stepped sine, compute duration
  if (params.signalType === 'stepped') {
    params.duration = steppedSineDuration({
      startFreq: params.startFreq,
      endFreq: params.endFreq,
      stepsPerOctave: params.stepsPerOctave,
      dwellTime: params.dwellTime,
      gapTime: params.gapTime,
      spacing: params.steppedSpacing,
    });
  }

  // Guard against invalid/infinite estimated size
  const estimatedBytes = estimateFileSize(params);
  if (!isFinite(estimatedBytes) || estimatedBytes <= 0) {
    alert('Cannot generate: the current settings produce an invalid file size. Check your parameters.');
    return;
  }

  // Validate
  if (['ess', 'linear', 'stepped'].includes(params.signalType)) {
    if (params.startFreq >= params.endFreq) {
      alert('Start frequency must be less than end frequency.');
      return;
    }
    if (params.endFreq > params.sampleRate / 2) {
      const proceed = confirm(
        `End frequency (${params.endFreq} Hz) exceeds Nyquist frequency ` +
        `(${params.sampleRate / 2} Hz). This will cause aliasing. Continue anyway?`
      );
      if (!proceed) return;
    }
  }

  els.generateBtn.disabled = true;
  els.previewBtn.disabled = true;
  showProgress(true);
  updateProgress(0, 'Starting generation...');

  if (generationWorker) {
    generationWorker.terminate();
  }

  try {
    generationWorker = new Worker('js/worker.js', { type: 'module' });
  } catch (e) {
    generateOnMainThread(params);
    return;
  }

  generationWorker.onmessage = (event) => {
    const data = event.data;

    switch (data.type) {
      case 'progress':
        updateProgress(data.fraction, getProgressLabel(data.fraction));
        break;

      case 'visualization': {
        const vizSamples = new Float64Array(data.samples);
        visualizer.drawWaveform(vizSamples, data.sampleRate);
        break;
      }

      case 'complete':
        updateProgress(1.0, 'Complete!');
        triggerDownload(data.buffer, data.filename);

        if (data.inverseBuffer && data.inverseFilename) {
          setTimeout(() => {
            triggerDownload(data.inverseBuffer, data.inverseFilename);
          }, 500);
        }

        showFileInfo(params, data.totalSamples, data.fileSizeBytes);

        setTimeout(() => {
          showProgress(false);
          els.generateBtn.disabled = false;
          els.previewBtn.disabled = false;
        }, 1500);
        break;

      case 'error':
        updateProgress(0, 'Error: ' + data.message);
        els.generateBtn.disabled = false;
        els.previewBtn.disabled = false;
        break;
    }
  };

  generationWorker.onerror = (err) => {
    console.error('Worker error:', err);
    updateProgress(0, 'Worker error — falling back to main thread');
    generationWorker.terminate();
    generationWorker = null;
    generateOnMainThread(params);
  };

  generationWorker.postMessage({ type: 'generate', params });
}

function getProgressLabel(fraction) {
  if (fraction < 0.4) return 'Generating signal...';
  if (fraction < 0.55) return 'Applying processing...';
  if (fraction < 0.60) return 'Preparing visualization...';
  if (fraction < 0.90) return 'Encoding WAV file...';
  if (fraction < 1.0) return 'Finalizing...';
  return 'Complete!';
}

// ─── Main-Thread Fallback ────────────────────────────────────────
function generateOnMainThread(params) {
  updateProgress(0.05, 'Generating on main thread...');

  setTimeout(() => {
    try {
      let samples;

      switch (params.signalType) {
        case 'ess':
          samples = generateExponentialSweep(params);
          break;
        case 'linear':
          samples = generateLinearSweep(params);
          break;
        case 'white':
          samples = generateWhiteNoise(params);
          break;
        case 'pink':
          samples = generatePinkNoise(params);
          break;
        case 'mls':
          samples = generateMLS({ order: params.mlsOrder, sampleRate: params.sampleRate });
          break;
        case 'stepped':
          samples = generateSteppedSine(params);
          break;
        case 'pattern':
          samples = generatePattern(params);
          break;
      }

      updateProgress(0.4, 'Applying processing...');

      // Fades
      let fadeInSamples;
      if (params.fadeInDuration === '1octave' && params.signalType === 'ess') {
        fadeInSamples = essOneOctaveFadeSamples(
          params.startFreq, params.endFreq, params.duration, params.sampleRate
        );
      } else {
        fadeInSamples = Math.round(parseFloat(params.fadeInDuration || 0) * params.sampleRate);
      }
      const fadeOutSamples = Math.round(parseFloat(params.fadeOutDuration || 0) * params.sampleRate);
      applyFades(samples, params.fadeInType, fadeInSamples, params.fadeOutType, fadeOutSamples);

      // Gain
      applyGain(samples, dBFSToLinear(params.outputLevel));

      // Repetitions
      const reps = params.repetitions || 1;
      if (reps > 1) {
        const interSilenceSamples = Math.round((params.interSweepSilence || 0) / 1000 * params.sampleRate);
        samples = repeatWithSilence(samples, reps, interSilenceSamples);
      }

      // Silence
      const leadSamples = Math.round(params.leadSilence / 1000 * params.sampleRate);
      const trailSamples = Math.round(params.trailSilence / 1000 * params.sampleRate);
      samples = addSilence(samples, leadSamples, trailSamples);

      updateProgress(0.6, 'Encoding WAV...');

      import('./audio/wav-encoder.js').then(({ encodeWAV, generateFilename, buildBwfDescription }) => {
        const numChannels = params.channelMode === 'mono' ? 1 : 2;
        const bwfDescription = buildBwfDescription(params);

        const wavBuffer = encodeWAV(samples, {
          sampleRate: params.sampleRate,
          bitDepth: params.bitDepth,
          format: params.format,
          numChannels,
          channelMode: params.channelMode,
          bwfMetadata: {
            description: bwfDescription,
            originator: 'SineSweepGenerator v1.0',
            originatorReference: Date.now().toString(36),
            codingHistory: `A=${params.format === 'float' ? 'FLOAT' : 'PCM'},F=${params.sampleRate},W=${params.bitDepth},T=SineSweepGenerator\r\n`,
          },
        });

        const filename = generateFilename(params);
        updateProgress(1.0, 'Complete!');
        triggerDownload(wavBuffer, filename);
        showFileInfo(params, samples.length, wavBuffer.byteLength);

        visualizer.drawWaveform(samples, params.sampleRate);

        setTimeout(() => {
          showProgress(false);
          els.generateBtn.disabled = false;
          els.previewBtn.disabled = false;
        }, 1500);
      });

    } catch (err) {
      updateProgress(0, 'Error: ' + err.message);
      els.generateBtn.disabled = false;
      els.previewBtn.disabled = false;
    }
  }, 50);
}

// ─── Preview ─────────────────────────────────────────────────────
function generatePreviewSamples(params, previewRate) {
  const previewParams = { ...params, sampleRate: previewRate };

  if (params.signalType === 'mls') {
    previewParams.duration = mlsDuration(params.mlsOrder, previewRate);
  }

  let samples;
  switch (params.signalType) {
    case 'ess':
      samples = generateExponentialSweep(previewParams);
      break;
    case 'linear':
      samples = generateLinearSweep(previewParams);
      break;
    case 'white':
      samples = generateWhiteNoise({ ...previewParams, seed: params.seed });
      break;
    case 'pink':
      samples = generatePinkNoise({ ...previewParams, seed: params.seed });
      break;
    case 'mls':
      samples = generateMLS({ order: params.mlsOrder, sampleRate: previewRate });
      break;
    case 'stepped':
      samples = generateSteppedSine({ ...previewParams });
      break;
  }

  // Apply fades
  let fadeInSamples;
  if (params.fadeInDuration === '1octave' && params.signalType === 'ess') {
    fadeInSamples = essOneOctaveFadeSamples(
      params.startFreq, params.endFreq,
      params.signalType === 'mls' ? previewParams.duration : params.duration,
      previewRate
    );
  } else {
    fadeInSamples = Math.round(parseFloat(params.fadeInDuration || 0) * previewRate);
  }
  const fadeOutSamples = Math.round(parseFloat(params.fadeOutDuration || 0) * previewRate);
  applyFades(samples, params.fadeInType, fadeInSamples, params.fadeOutType, fadeOutSamples);

  // EQ compensation
  if (params.eqCurve && params.eqCurve !== 'none') {
    applyEQ(samples, { ...params, sampleRate: previewRate });
  }

  // Gain
  applyGain(samples, dBFSToLinear(params.outputLevel));

  // Repetitions
  const reps = params.repetitions || 1;
  if (reps > 1) {
    const interSilenceSamples = Math.round((params.interSweepSilence || 0) / 1000 * previewRate);
    samples = repeatWithSilence(samples, reps, interSilenceSamples);
  }

  // Silence
  const leadSamples = Math.round(params.leadSilence / 1000 * previewRate);
  const trailSamples = Math.round(params.trailSilence / 1000 * previewRate);
  samples = addSilence(samples, leadSamples, trailSamples);

  return samples;
}

// ─── Build Stereo Preview Channels ──────────────────────────────
function buildPreviewChannels(params, previewRate) {
  const channelMode = params.channelMode;
  const isNoise = ['white', 'pink'].includes(params.signalType);
  const isStereo = channelMode !== 'mono';

  if (channelMode === 'stereo-independent' && isNoise) {
    const left = generatePreviewSamples(params, previewRate);
    const right = generatePreviewSamples({ ...params, seed: params.seed + 1 }, previewRate);
    return { left, right, isStereo: true };
  }

  const mono = generatePreviewSamples(params, previewRate);

  if (!isStereo || channelMode === 'stereo-identical') {
    return { left: mono, right: mono, isStereo: false };
  }

  if (channelMode === 'stereo-left') {
    return { left: mono, right: new Float64Array(mono.length), isStereo: true };
  }

  if (channelMode === 'stereo-right') {
    return { left: new Float64Array(mono.length), right: mono, isStereo: true };
  }

  if (channelMode === 'stereo-sync') {
    const right = new Float64Array(mono.length);
    const leadSamp = Math.round(params.leadSilence / 1000 * previewRate);
    right[leadSamp] = dBFSToLinear(params.outputLevel);
    return { left: mono, right, isStereo: true };
  }

  // stereo-alternate or stereo-lrb
  const reps = params.repetitions || 1;
  const leadSamp = Math.round(params.leadSilence / 1000 * previewRate);
  const trailSamp = Math.round(params.trailSilence / 1000 * previewRate);
  const interSilenceSamples = Math.round((params.interSweepSilence || 0) / 1000 * previewRate);
  const totalLen = mono.length;
  const left = new Float64Array(totalLen);
  const right = new Float64Array(totalLen);

  if (reps <= 1) {
    left.set(mono);
    if (channelMode === 'stereo-lrb') right.set(mono);
    return { left, right, isStereo: true };
  }

  const sweepRegion = totalLen - leadSamp - trailSamp;
  const sweepLen = Math.round((sweepRegion - interSilenceSamples * (reps - 1)) / reps);

  for (let r = 0; r < reps; r++) {
    const start = leadSamp + r * (sweepLen + interSilenceSamples);
    const end = Math.min(start + sweepLen, totalLen);

    if (channelMode === 'stereo-alternate') {
      const target = (r % 2 === 0) ? left : right;
      for (let i = start; i < end; i++) target[i] = mono[i];
    } else {
      // stereo-lrb: 0=L, 1=R, 2=Both
      const phase = r % 3;
      for (let i = start; i < end; i++) {
        if (phase === 0 || phase === 2) left[i] = mono[i];
        if (phase === 1 || phase === 2) right[i] = mono[i];
      }
    }
  }

  return { left, right, isStereo: true };
}

function startPreview() {
  const params = getParams();

  // For stepped sine, compute duration
  if (params.signalType === 'stepped') {
    params.duration = steppedSineDuration({
      startFreq: params.startFreq,
      endFreq: params.endFreq,
      stepsPerOctave: params.stepsPerOctave,
      dwellTime: params.dwellTime,
      gapTime: params.gapTime,
      spacing: params.steppedSpacing,
    });
  }

  // Guard against invalid/infinite estimated size
  const estimatedBytes = estimateFileSize(params);
  if (!isFinite(estimatedBytes) || estimatedBytes <= 0) {
    alert('Cannot preview: the current settings produce an invalid signal. Check your parameters.');
    return;
  }

  const previewRate = Math.min(params.sampleRate, previewPlayer.nativeSampleRate || 48000);
  const channelMode = params.channelMode;
  const isStereo = channelMode !== 'mono';

  const { left: leftSamples, right: rightSamples, isStereo: hasStereoChannels } =
    buildPreviewChannels(params, previewRate);

  // Draw waveform (stereo dual-color if applicable)
  if (hasStereoChannels) {
    visualizer.drawStereoWaveform(leftSamples, rightSamples, previewRate);
  } else {
    visualizer.drawWaveform(leftSamples, previewRate);
  }

  // Load and play
  if (hasStereoChannels) {
    previewPlayer.loadStereo(leftSamples, rightSamples, previewRate);
  } else if (isStereo) {
    previewPlayer.load(leftSamples, previewRate, 2);
  } else {
    previewPlayer.load(leftSamples, previewRate);
  }
  previewPlayer.play();

  els.previewBtn.hidden = true;
  els.stopBtn.hidden = false;

  // Update cursor during playback
  const totalDuration = leftSamples.length / previewRate;
  previewPlayer.onTimeUpdate((time) => {
    visualizer.drawCursor(time, totalDuration);
    visualizer.drawFrequencyCursor(time, totalDuration);
  });

  previewPlayer.onEnded(() => {
    els.previewBtn.hidden = false;
    els.stopBtn.hidden = true;
    visualizer.fadeOutCursors();
    // If params changed during playback, regenerate visualization now
    if (vizStale) {
      regenerateVisualization();
    }
  });
}

function stopPreview() {
  previewPlayer.stop();
  els.previewBtn.hidden = false;
  els.stopBtn.hidden = true;
  visualizer.fadeOutCursors();
  // If params changed during playback, regenerate visualization now
  if (vizStale) {
    regenerateVisualization();
  }
}

// ─── Channel Mode Auto-Repetitions ──────────────────────────────
function handleChannelModeChange() {
  const mode = els.channelMode.value;
  const currentReps = parseInt(els.repetitions.value) || 1;

  if (mode === 'stereo-alternate') {
    if (currentReps < 2) {
      prevRepsBeforeAuto = currentReps;
      els.repetitions.value = 2;
      autoRepsSet = true;
      els.repetitions.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else if (mode === 'stereo-lrb') {
    if (currentReps < 3) {
      prevRepsBeforeAuto = currentReps;
      els.repetitions.value = 3;
      autoRepsSet = true;
      els.repetitions.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else {
    // Switching away from auto-rep modes
    if (autoRepsSet) {
      els.repetitions.value = prevRepsBeforeAuto;
      autoRepsSet = false;
      els.repetitions.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

// ─── Signal Presets ──────────────────────────────────────────────
function renderSignalPresets() {
  SIGNAL_PRESETS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.textContent = preset.name;
    btn.title = preset.description;
    btn.addEventListener('click', () => {
      const currentSampleRate = parseInt(els.sampleRate.value);
      applySignalPreset(preset, els, currentSampleRate);
      if (activeSignalPresetBtn) activeSignalPresetBtn.classList.remove('active');
      btn.classList.add('active');
      activeSignalPresetBtn = btn;
    });
    els.signalPresetsBar.appendChild(btn);
  });
}

// ─── Format Presets ──────────────────────────────────────────────
function renderFormatPresets() {
  FORMAT_PRESETS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.textContent = preset.name;
    btn.title = preset.description;
    btn.dataset.name = preset.name;
    btn.addEventListener('click', () => {
      applyFormatPreset(preset, els);
      if (activeFormatPresetBtn) {
        activeFormatPresetBtn.classList.remove('active');
        activeFormatPresetBtn.textContent = activeFormatPresetBtn.dataset.name;
      }
      btn.classList.add('active');
      if (preset.emoji) btn.textContent = preset.name + ' ' + preset.emoji;
      activeFormatPresetBtn = btn;

      // Re-resolve any active signal preset that uses 'nyquist'
      if (activeSignalPresetBtn) {
        const activeSignalPreset = SIGNAL_PRESETS.find(p =>
          p.name === activeSignalPresetBtn.textContent
        );
        if (activeSignalPreset && activeSignalPreset.endFreq === 'nyquist') {
          const newRate = parseInt(els.sampleRate.value);
          els.endFreq.value = Math.floor(newRate / 2);
          els.endFreq.dispatchEvent(new Event('input', { bubbles: true }));
          els.endFreq.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    els.formatPresetsBar.appendChild(btn);
  });
}

// ─── Event Listeners ─────────────────────────────────────────────
function bindEvents() {
  // Signal type change
  els.signalType.addEventListener('change', () => {
    updateVisibility();
    if (activeSignalPresetBtn) {
      activeSignalPresetBtn.classList.remove('active');
      activeSignalPresetBtn = null;
    }
    scheduleVizUpdate();
  });

  // Channel mode change — auto-reps
  els.channelMode.addEventListener('change', () => {
    handleChannelModeChange();
    scheduleVizUpdate();
  });

  // Track manual repetition changes to disable auto-revert
  els.repetitions.addEventListener('change', () => {
    const mode = els.channelMode.value;
    if (mode === 'stereo-alternate' || mode === 'stereo-lrb') {
      // If user manually changes reps, don't auto-revert
      autoRepsSet = false;
    }
  });

  // Output level slider <-> number input sync
  els.outputLevel.addEventListener('input', () => {
    const val = parseFloat(els.outputLevel.value).toFixed(1);
    els.outputLevelDisplay.textContent = val;
    els.outputLevelInput.value = parseFloat(els.outputLevel.value);
  });

  els.outputLevelInput.addEventListener('input', () => {
    let val = parseFloat(els.outputLevelInput.value);
    if (isNaN(val)) return;
    val = Math.max(-60, Math.min(0, val));
    els.outputLevel.value = val;
    els.outputLevelDisplay.textContent = val.toFixed(1);
  });

  els.outputLevelInput.addEventListener('change', () => {
    let val = parseFloat(els.outputLevelInput.value);
    if (isNaN(val)) val = -3;
    val = Math.max(-60, Math.min(0, val));
    els.outputLevelInput.value = val;
    els.outputLevel.value = val;
    els.outputLevelDisplay.textContent = val.toFixed(1);
    els.outputLevel.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Double-click output level slider to reset to -3 dBFS
  els.outputLevel.addEventListener('dblclick', () => {
    els.outputLevel.value = -3;
    els.outputLevelInput.value = -3;
    els.outputLevelDisplay.textContent = '-3.0';
    els.outputLevel.dispatchEvent(new Event('input', { bubbles: true }));
    els.outputLevel.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Output level quick presets
  document.querySelectorAll('.level-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = parseFloat(btn.dataset.level);
      els.outputLevel.value = val;
      els.outputLevelInput.value = val;
      els.outputLevelDisplay.textContent = val.toFixed(1);
      els.outputLevel.dispatchEvent(new Event('input', { bubbles: true }));
      els.outputLevel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  // Start frequency quick presets
  document.querySelectorAll('.freq-preset-btn[data-freq]').forEach((btn) => {
    btn.addEventListener('click', () => {
      els.startFreq.value = btn.dataset.freq;
      els.startFreq.dispatchEvent(new Event('input', { bubbles: true }));
      els.startFreq.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  // Full bandwidth checkbox
  els.fullBandwidth.addEventListener('change', () => {
    applyFullBandwidth();
  });

  // Randomize seed button
  els.randomizeSeedBtn.addEventListener('click', () => {
    els.noiseSeed.value = Math.floor(Math.random() * 4294967296);
    els.noiseSeed.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // MLS order or sample rate change → update MLS duration
  els.mlsOrder.addEventListener('change', updateVisibility);
  els.sampleRate.addEventListener('change', () => {
    updateVisibility();
    // Recalculate full bandwidth if checked
    if (els.fullBandwidth.checked) {
      applyFullBandwidth();
    }
    // Clear format preset highlight when manually changing sample rate
    if (activeFormatPresetBtn) {
      activeFormatPresetBtn.classList.remove('active');
      activeFormatPresetBtn.textContent = activeFormatPresetBtn.dataset.name;
      activeFormatPresetBtn = null;
    }
  });

  // Bit depth change → clear format preset highlight, update dither default
  document.querySelectorAll('input[name="bitDepth"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (activeFormatPresetBtn) {
        activeFormatPresetBtn.classList.remove('active');
        activeFormatPresetBtn.textContent = activeFormatPresetBtn.dataset.name;
        activeFormatPresetBtn = null;
      }
      updateDitherDefault();
    });
  });

  // Any control change → update estimate, freq plot, and debounced viz
  const allInputs = document.querySelectorAll('select, input');
  allInputs.forEach((input) => {
    input.addEventListener('change', () => {
      updateEstimatedSize();
      updateFrequencyPlot();
      scheduleVizUpdate();
    });
    input.addEventListener('input', () => {
      updateEstimatedSize();
    });
  });

  // EQ hint text
  const EQ_HINTS = {
    'a-weight': 'Shapes the sweep so perceived loudness is theoretically even (110 Hz–20 kHz)',
    'inverse-riaa': 'For example, for testing phono preamps. Output through RIAA playback should measure flat (20 Hz–20 kHz)',
  };
  function updateEQHint() {
    const hint = EQ_HINTS[els.eqCurve.value] || '';
    els.eqCurveHint.textContent = hint;
    els.eqCurveHint.style.display = hint ? '' : 'none';
  }
  els.eqCurve.addEventListener('change', updateEQHint);
  updateEQHint();

  // Action buttons
  els.previewBtn.addEventListener('click', startPreview);
  els.stopBtn.addEventListener('click', stopPreview);
  els.generateBtn.addEventListener('click', startGeneration);
}

// ─── Initialize ──────────────────────────────────────────────────
function init() {
  renderSignalPresets();
  renderFormatPresets();
  bindEvents();

  // Auto-select "Quick Room Test" preset on fresh start
  const firstPresetBtn = els.signalPresetsBar.querySelector('.preset-btn');
  if (firstPresetBtn) firstPresetBtn.click();

  updateVisibility();
  updateDitherDefault();
  updateEstimatedSize();
  updateFrequencyPlot();
  regenerateVisualization();
}

init();
