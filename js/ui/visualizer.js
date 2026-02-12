// js/ui/visualizer.js — Canvas-based waveform and frequency-vs-time plots

/**
 * Visualizer for audio signal waveform and frequency trajectory.
 */
export class Visualizer {
  /**
   * @param {HTMLCanvasElement} waveformCanvas
   * @param {HTMLCanvasElement} frequencyCanvas
   */
  constructor(waveformCanvas, frequencyCanvas) {
    this._waveCanvas = waveformCanvas;
    this._freqCanvas = frequencyCanvas;

    // Colors (Dracula theme)
    this._bgColor = '#1e1f2b';
    this._gridColor = '#333545';
    this._waveColor = '#50fa7b';
    this._freqColor = '#8be9fd';
    this._cursorColor = '#ff79c6';
    this._textColor = '#a0a4b8';

    this._lastWaveData = null;
    this._lastFreqParams = null;
    this._lastSampleRate = null;

    // Set up ResizeObserver for responsive canvases
    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(waveformCanvas.parentElement);
    if (frequencyCanvas.parentElement !== waveformCanvas.parentElement) {
      this._resizeObserver.observe(frequencyCanvas.parentElement);
    }

    this._handleResize();
  }

  /**
   * Sync canvas pixel buffer to its CSS display size, accounting for devicePixelRatio.
   */
  _syncCanvasSize(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  _handleResize() {
    this._syncCanvasSize(this._waveCanvas);
    this._syncCanvasSize(this._freqCanvas);

    // Re-draw if we have data
    if (this._lastWaveData) {
      this._drawWaveformInternal(this._lastWaveData, this._lastSampleRate);
    }
    if (this._lastFreqParams) {
      this._drawFrequencyPlotInternal(this._lastFreqParams);
    }
  }

  /**
   * Get the CSS pixel dimensions of a canvas.
   */
  _dims(canvas) {
    const rect = canvas.getBoundingClientRect();
    return { w: Math.round(rect.width), h: Math.round(rect.height) };
  }

  /**
   * Draw the time-domain waveform.
   * @param {Float64Array} samples - Raw or decimated (min/max pairs) data
   * @param {number} sampleRate
   */
  drawWaveform(samples, sampleRate) {
    this._lastWaveData = samples;
    this._lastSampleRate = sampleRate;
    this._syncCanvasSize(this._waveCanvas);
    this._drawWaveformInternal(samples, sampleRate);
  }

  _drawWaveformInternal(samples, sampleRate) {
    const ctx = this._waveCanvas.getContext('2d');
    const { w, h } = this._dims(this._waveCanvas);

    // Background
    ctx.fillStyle = this._bgColor;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = this._gridColor;
    ctx.lineWidth = 0.5;

    // Horizontal center line (zero crossing)
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Quarter lines
    for (const frac of [0.25, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(0, h * frac);
      ctx.lineTo(w, h * frac);
      ctx.stroke();
    }

    if (!samples || samples.length === 0) return;

    ctx.strokeStyle = this._waveColor;
    ctx.lineWidth = 1;

    if (samples.length > w * 2) {
      // Draw as min/max envelope for large data sets
      const step = samples.length / w;
      const maxVals = new Float64Array(w);
      const minVals = new Float64Array(w);

      for (let x = 0; x < w; x++) {
        const start = Math.floor(x * step);
        const end = Math.min(Math.floor((x + 1) * step), samples.length);
        let lo = Infinity, hi = -Infinity;
        for (let j = start; j < end; j++) {
          if (samples[j] < lo) lo = samples[j];
          if (samples[j] > hi) hi = samples[j];
        }
        minVals[x] = lo;
        maxVals[x] = hi;
      }

      // Filled envelope
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = h / 2 - maxVals[x] * h / 2;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let x = w - 1; x >= 0; x--) {
        const y = h / 2 - minVals[x] * h / 2;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = this._waveColor;
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.stroke();

    } else {
      // Few enough samples to draw as a line
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (let i = 0; i < samples.length; i++) {
        const x = (i / samples.length) * w;
        const y = h / 2 - samples[i] * h / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Time axis labels
    const totalTime = samples.length / sampleRate;
    ctx.fillStyle = this._textColor;
    ctx.font = '10px sans-serif';
    ctx.fillText('0s', 4, h - 4);
    const endLabel = totalTime.toFixed(2) + 's';
    ctx.fillText(endLabel, w - ctx.measureText(endLabel).width - 4, h - 4);
  }

  /**
   * Draw a frequency-vs-time plot for sweeps.
   * @param {object} params
   * @param {number} params.startFreq
   * @param {number} params.endFreq
   * @param {number} params.duration - seconds
   * @param {string} params.type - "exponential" | "linear" | "stepped"
   * @param {number} [params.leadSilence] - ms
   * @param {number} [params.trailSilence] - ms
   */
  drawFrequencyPlot(params) {
    this._lastFreqParams = params;
    this._syncCanvasSize(this._freqCanvas);
    this._drawFrequencyPlotInternal(params);
  }

  _drawFrequencyPlotInternal(params) {
    const ctx = this._freqCanvas.getContext('2d');
    const { w, h } = this._dims(this._freqCanvas);

    ctx.fillStyle = this._bgColor;
    ctx.fillRect(0, 0, w, h);

    const { startFreq, endFreq, type } = params;
    if (!startFreq || !endFreq || startFreq >= endFreq) return;

    const reps = params.repetitions || 1;
    const singleDuration = params.singleSweepDuration || params.duration;
    const interSilenceMs = params.interSweepSilence || 0;
    const sweepDuration = params.duration; // total sweep region duration (already includes reps)
    const leadMs = params.leadSilence || 0;
    const trailMs = params.trailSilence || 0;

    const totalDuration = sweepDuration + leadMs / 1000 + trailMs / 1000;

    // Log scale for frequency axis
    const logMin = Math.log10(startFreq);
    const logMax = Math.log10(endFreq);
    const margin = 4;

    // Frequency grid lines
    ctx.strokeStyle = this._gridColor;
    ctx.lineWidth = 0.5;
    ctx.fillStyle = this._textColor;
    ctx.font = '9px sans-serif';

    const gridFreqs = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 96000];
    for (const freq of gridFreqs) {
      if (freq < startFreq * 0.9 || freq > endFreq * 1.1) continue;
      const logF = Math.log10(freq);
      const y = h - margin - (logF - logMin) / (logMax - logMin) * (h - margin * 2);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      const label = freq >= 1000 ? (freq / 1000) + 'k' : freq + '';
      ctx.fillText(label, 2, y - 2);
    }

    // Draw frequency trajectory for each repetition
    ctx.strokeStyle = this._freqColor;
    ctx.lineWidth = 2;

    const leadSec = leadMs / 1000;
    const interSilenceSec = interSilenceMs / 1000;

    for (let r = 0; r < reps; r++) {
      const repStartSec = leadSec + r * (singleDuration + interSilenceSec);
      const repEndSec = repStartSec + singleDuration;

      const repStartX = (repStartSec / totalDuration) * w;
      const repEndX = (repEndSec / totalDuration) * w;

      ctx.beginPath();
      const steps = Math.min(Math.round(repEndX - repStartX), 500);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let freq;

        if (type === 'exponential') {
          freq = startFreq * Math.pow(endFreq / startFreq, t);
        } else if (type === 'linear') {
          freq = startFreq + (endFreq - startFreq) * t;
        } else {
          freq = startFreq * Math.pow(endFreq / startFreq, t);
        }

        const logF = Math.log10(freq);
        const x = repStartX + t * (repEndX - repStartX);
        const y = h - margin - (logF - logMin) / (logMax - logMin) * (h - margin * 2);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Time labels
    ctx.fillStyle = this._textColor;
    ctx.font = '10px sans-serif';
    ctx.fillText('0s', 4, h - 2);
    const endLabel = totalDuration.toFixed(2) + 's';
    ctx.fillText(endLabel, w - ctx.measureText(endLabel).width - 4, h - 2);
  }

  /**
   * Draw a vertical playback cursor at the given time.
   * @param {number} timeSeconds
   * @param {number} totalDuration
   */
  drawCursor(timeSeconds, totalDuration) {
    if (!totalDuration || totalDuration <= 0) return;

    // Redraw waveform first (to clear old cursor)
    if (this._lastWaveData) {
      this._drawWaveformInternal(this._lastWaveData, this._lastSampleRate);
    }

    const ctx = this._waveCanvas.getContext('2d');
    const { w, h } = this._dims(this._waveCanvas);
    const x = (timeSeconds / totalDuration) * w;

    ctx.strokeStyle = this._cursorColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  /**
   * Clear both canvases.
   */
  clear() {
    this._lastWaveData = null;
    this._lastFreqParams = null;

    for (const canvas of [this._waveCanvas, this._freqCanvas]) {
      this._syncCanvasSize(canvas);
      const ctx = canvas.getContext('2d');
      const { w, h } = this._dims(canvas);
      ctx.fillStyle = this._bgColor;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
