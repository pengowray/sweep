// js/app.js — Main controller: UI bindings, state, orchestration

import { PRESETS, applyPreset } from './ui/presets.js';
import { Visualizer } from './ui/visualizer.js';
import { PreviewPlayer } from './audio/preview.js';
import { estimateFileSize, formatFileSize, dBFSToLinear, essOneOctaveFadeSamples } from './utils.js';
import { generateExponentialSweep, generateLinearSweep } from './generators/sweep.js';
import { generateWhiteNoise, generatePinkNoise } from './generators/noise.js';
import { generateMLS, mlsDuration } from './generators/mls.js';
import { generateSteppedSine, steppedSineDuration } from './generators/stepped-sine.js';
import { applyFades, applyGain, addSilence } from './utils.js';

// ─── DOM References ───────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  signalType: $('signalType'),
  sampleRate: $('sampleRate'),
  startFreq: $('startFreq'),
  endFreq: $('endFreq'),
  duration: $('duration'),
  channelMode: $('channelMode'),
  outputLevel: $('outputLevel'),
  outputLevelDisplay: $('outputLevelDisplay'),
  leadSilence: $('leadSilence'),
  trailSilence: $('trailSilence'),
  fadeInType: $('fadeInType'),
  fadeInDuration: $('fadeInDuration'),
  fadeOutType: $('fadeOutType'),
  fadeOutDuration: $('fadeOutDuration'),
  repetitions: $('repetitions'),
  interSweepSilence: $('interSweepSilence'),
  generateInverse: $('generateInverse'),
  mlsOrder: $('mlsOrder'),
  stepsPerOctave: $('stepsPerOctave'),
  dwellTime: $('dwellTime'),
  gapTime: $('gapTime'),
  steppedSpacing: $('steppedSpacing'),

  // UI groups
  startFreqGroup: $('startFreqGroup'),
  endFreqGroup: $('endFreqGroup'),
  durationGroup: $('durationGroup'),
  mlsControls: $('mlsControls'),
  steppedControls: $('steppedControls'),
  inverseFilterGroup: $('inverseFilterGroup'),
  fadeInDurationGroup: $('fadeInDurationGroup'),
  freqPlotWrapper: $('freqPlotWrapper'),
  mlsDuration: $('mlsDuration'),

  // Actions
  previewBtn: $('previewBtn'),
  stopBtn: $('stopBtn'),
  generateBtn: $('generateBtn'),
  previewIcon: $('previewIcon'),

  // Progress
  progressSection: $('progressSection'),
  progressBar: $('progressBar'),
  progressText: $('progressText'),

  // Info
  fileInfo: $('fileInfo'),
  fileInfoGrid: $('fileInfoGrid'),
  estimatedSize: $('estimatedSize'),
  sizeWarning: $('sizeWarning'),

  // Canvases
  waveformCanvas: $('waveformCanvas'),
  frequencyCanvas: $('frequencyCanvas'),
  presetsBar: $('presets-bar'),
};

// ─── Modules ──────────────────────────────────────────────────────
const visualizer = new Visualizer(els.waveformCanvas, els.frequencyCanvas);
const previewPlayer = new PreviewPlayer();

let generationWorker = null;
let activePresetBtn = null;

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
    mlsOrder: parseInt(els.mlsOrder.value),
    stepsPerOctave: parseInt(els.stepsPerOctave.value),
    dwellTime: parseFloat(els.dwellTime.value),
    gapTime: parseFloat(els.gapTime.value),
    steppedSpacing: els.steppedSpacing.value,
  };
}

// ─── UI Visibility Based on Signal Type ──────────────────────────
function updateVisibility() {
  const type = els.signalType.value;

  const hasFreq = ['ess', 'linear', 'stepped'].includes(type);
  const isMLS = type === 'mls';
  const isStepped = type === 'stepped';
  const isESS = type === 'ess';
  const hasFreqPlot = hasFreq;

  els.startFreqGroup.hidden = !hasFreq;
  els.endFreqGroup.hidden = !hasFreq;
  els.durationGroup.hidden = isMLS;
  els.mlsControls.hidden = !isMLS;
  els.steppedControls.hidden = !isStepped;
  els.inverseFilterGroup.hidden = !isESS;
  els.freqPlotWrapper.hidden = !hasFreqPlot;

  // Show "1 octave" option only for ESS
  const oneOctOpt = els.fadeInDuration.querySelector('option[value="1octave"]');
  if (oneOctOpt) {
    oneOctOpt.hidden = !isESS;
    if (!isESS && els.fadeInDuration.value === '1octave') {
      els.fadeInDuration.value = '0.05';
    }
  }

  // Update MLS duration display
  if (isMLS) {
    const dur = mlsDuration(parseInt(els.mlsOrder.value), parseInt(els.sampleRate.value));
    els.mlsDuration.textContent = dur.toFixed(3) + 's';
  }

  updateEstimatedSize();
  updateFrequencyPlot();
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
  els.estimatedSize.textContent = formatFileSize(bytes);

  if (bytes > 200 * 1024 * 1024) {
    els.sizeWarning.textContent = 'Very large file — generation may be slow or fail on some devices';
    els.sizeWarning.hidden = false;
  } else if (bytes > 50 * 1024 * 1024) {
    els.sizeWarning.textContent = 'Large file — generation may take a moment';
    els.sizeWarning.hidden = false;
  } else {
    els.sizeWarning.hidden = true;
  }
}

// ─── Frequency Plot Update ───────────────────────────────────────
function updateFrequencyPlot() {
  const type = els.signalType.value;
  if (!['ess', 'linear', 'stepped'].includes(type)) return;

  visualizer.drawFrequencyPlot({
    startFreq: parseFloat(els.startFreq.value),
    endFreq: parseFloat(els.endFreq.value),
    duration: parseFloat(els.duration.value) || 5,
    type: type === 'ess' ? 'exponential' : type,
    leadSilence: parseFloat(els.leadSilence.value) || 0,
    trailSilence: parseFloat(els.trailSilence.value) || 0,
  });
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
  // Revoke after a short delay to ensure download starts
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── Generate & Download (Worker) ────────────────────────────────
function startGeneration() {
  const params = getParams();

  // For MLS, set duration from order
  if (params.signalType === 'mls') {
    params.duration = mlsDuration(params.mlsOrder, params.sampleRate);
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

  // Terminate any existing worker
  if (generationWorker) {
    generationWorker.terminate();
  }

  // Try module worker, fall back to main thread
  try {
    generationWorker = new Worker('js/worker.js', { type: 'module' });
  } catch (e) {
    // Fall back to main-thread generation
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
          // Short delay so browser doesn't block the second download
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

  // Use setTimeout to allow UI to update
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

      // Silence
      const leadSamples = Math.round(params.leadSilence / 1000 * params.sampleRate);
      const trailSamples = Math.round(params.trailSilence / 1000 * params.sampleRate);
      samples = addSilence(samples, leadSamples, trailSamples);

      updateProgress(0.6, 'Encoding WAV...');

      // Import wav-encoder dynamically
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

        // Draw waveform
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
function startPreview() {
  const params = getParams();

  // For preview, generate at a manageable sample rate
  const previewRate = Math.min(params.sampleRate, previewPlayer.nativeSampleRate || 48000);

  let samples;
  const previewParams = { ...params, sampleRate: previewRate };

  // For MLS, set duration from order
  if (params.signalType === 'mls') {
    previewParams.duration = mlsDuration(params.mlsOrder, previewRate);
  }

  switch (params.signalType) {
    case 'ess':
      samples = generateExponentialSweep(previewParams);
      break;
    case 'linear':
      samples = generateLinearSweep(previewParams);
      break;
    case 'white':
      samples = generateWhiteNoise(previewParams);
      break;
    case 'pink':
      samples = generatePinkNoise(previewParams);
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

  // Gain
  applyGain(samples, dBFSToLinear(params.outputLevel));

  // Silence
  const leadSamples = Math.round(params.leadSilence / 1000 * previewRate);
  const trailSamples = Math.round(params.trailSilence / 1000 * previewRate);
  samples = addSilence(samples, leadSamples, trailSamples);

  // Draw waveform
  visualizer.drawWaveform(samples, previewRate);

  // Load and play
  previewPlayer.load(samples, previewRate);
  previewPlayer.play();

  els.previewBtn.hidden = true;
  els.stopBtn.hidden = false;

  // Update cursor during playback
  const totalDuration = samples.length / previewRate;
  previewPlayer.onTimeUpdate((time) => {
    visualizer.drawCursor(time, totalDuration);
  });

  previewPlayer.onEnded(() => {
    els.previewBtn.hidden = false;
    els.stopBtn.hidden = true;
  });
}

function stopPreview() {
  previewPlayer.stop();
  els.previewBtn.hidden = false;
  els.stopBtn.hidden = true;
}

// ─── Presets ─────────────────────────────────────────────────────
function renderPresets() {
  PRESETS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.textContent = preset.name;
    btn.title = preset.description;
    btn.addEventListener('click', () => {
      applyPreset(preset, els);
      if (activePresetBtn) activePresetBtn.classList.remove('active');
      btn.classList.add('active');
      activePresetBtn = btn;
    });
    els.presetsBar.appendChild(btn);
  });
}

// ─── Event Listeners ─────────────────────────────────────────────
function bindEvents() {
  // Signal type change
  els.signalType.addEventListener('change', () => {
    updateVisibility();
    if (activePresetBtn) {
      activePresetBtn.classList.remove('active');
      activePresetBtn = null;
    }
  });

  // Output level slider display
  els.outputLevel.addEventListener('input', () => {
    els.outputLevelDisplay.textContent = parseFloat(els.outputLevel.value).toFixed(1);
  });

  // MLS order or sample rate change → update MLS duration
  els.mlsOrder.addEventListener('change', updateVisibility);
  els.sampleRate.addEventListener('change', updateVisibility);

  // Any control change → update estimate and freq plot
  const allInputs = document.querySelectorAll('select, input');
  allInputs.forEach((input) => {
    input.addEventListener('change', () => {
      updateEstimatedSize();
      updateFrequencyPlot();
    });
    input.addEventListener('input', () => {
      updateEstimatedSize();
    });
  });

  // Action buttons
  els.previewBtn.addEventListener('click', startPreview);
  els.stopBtn.addEventListener('click', stopPreview);
  els.generateBtn.addEventListener('click', startGeneration);
}

// ─── Initialize ──────────────────────────────────────────────────
function init() {
  renderPresets();
  bindEvents();
  updateVisibility();
  updateEstimatedSize();
  updateFrequencyPlot();
  visualizer.clear();
}

init();
