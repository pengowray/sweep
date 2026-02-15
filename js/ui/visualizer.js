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
    this._lastWaveDataR = null;
    this._lastFreqParams = null;
    this._lastSampleRate = null;

    // Cursor state for fade-out
    this._lastCursorTime = 0;
    this._lastCursorDuration = 0;
    this._fadeRafId = null;

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
    if (this._lastWaveData && this._lastWaveDataR) {
      this._drawStereoWaveformInternal(this._lastWaveData, this._lastWaveDataR, this._lastSampleRate);
    } else if (this._lastWaveData) {
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
    this._lastWaveDataR = null;
    this._lastSampleRate = sampleRate;
    this._syncCanvasSize(this._waveCanvas);
    this._drawWaveformInternal(samples, sampleRate);
  }

  drawStereoWaveform(leftSamples, rightSamples, sampleRate) {
    this._lastWaveData = leftSamples;
    this._lastWaveDataR = rightSamples;
    this._lastSampleRate = sampleRate;
    this._syncCanvasSize(this._waveCanvas);
    this._drawStereoWaveformInternal(leftSamples, rightSamples, sampleRate);
  }

  _drawStereoWaveformInternal(leftSamples, rightSamples, sampleRate) {
    const ctx = this._waveCanvas.getContext('2d');
    const { w, h } = this._dims(this._waveCanvas);

    // Background
    ctx.fillStyle = this._bgColor;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = this._gridColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    for (const frac of [0.25, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(0, h * frac);
      ctx.lineTo(w, h * frac);
      ctx.stroke();
    }

    // Draw each channel as overlaid transparent envelopes
    const channels = [
      { samples: leftSamples, color: this._waveColor, label: 'L' },    // green
      { samples: rightSamples, color: this._cursorColor, label: 'R' }, // pink
    ];

    for (const ch of channels) {
      if (!ch.samples || ch.samples.length === 0) continue;
      this._drawChannelEnvelope(ctx, ch.samples, w, h, ch.color);
    }

    ctx.globalAlpha = 1;

    // Time axis labels
    const totalTime = leftSamples.length / sampleRate;
    ctx.fillStyle = this._textColor;
    ctx.font = '10px sans-serif';
    ctx.fillText('0s', 4, h - 4);
    const endLabel = totalTime.toFixed(2) + 's';
    ctx.fillText(endLabel, w - ctx.measureText(endLabel).width - 4, h - 4);

    // Channel legend
    ctx.font = '9px sans-serif';
    ctx.fillStyle = this._waveColor;
    ctx.fillText('L', w - 30, 12);
    ctx.fillStyle = this._cursorColor;
    ctx.fillText('R', w - 18, 12);
  }

  _drawChannelEnvelope(ctx, samples, w, h, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    if (samples.length > w * 2) {
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
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.2;
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.stroke();
    } else {
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      for (let i = 0; i < samples.length; i++) {
        const x = (i / samples.length) * w;
        const y = h / 2 - samples[i] * h / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
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
   * Draw a frequency-vs-time plot for sweeps and patterns.
   * @param {object} params
   * @param {number} params.startFreq
   * @param {number} params.endFreq
   * @param {number} params.duration - seconds
   * @param {string} params.type - "exponential" | "linear" | "stepped" | "pattern"
   * @param {number} [params.leadSilence] - ms
   * @param {number} [params.trailSilence] - ms
   * @param {Array} [params.patternSequence] - required when type === "pattern"
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

    let { startFreq, endFreq, type } = params;

    // For pattern sequences, derive freq axis bounds from the step data
    if (type === 'pattern' && params.patternSequence && params.patternSequence.length) {
      const freqs = params.patternSequence.map(s => s.hz).filter(Boolean);
      startFreq = Math.min(...freqs);
      endFreq = Math.max(...freqs);
      // Give a little headroom when all steps are the same frequency
      if (startFreq === endFreq) {
        startFreq = startFreq / 2;
        endFreq = endFreq * 2;
      }
    }

    if (startFreq == null || !endFreq || startFreq >= endFreq || startFreq < 0) return;

    const reps = params.repetitions || 1;
    const singleDuration = params.singleSweepDuration || params.duration;
    const interSilenceMs = params.interSweepSilence || 0;
    const sweepDuration = params.duration; // total sweep region duration (already includes reps)
    const leadMs = params.leadSilence || 0;
    const trailMs = params.trailSilence || 0;

    const totalDuration = sweepDuration + leadMs / 1000 + trailMs / 1000;

    // Log scale for frequency axis (clamp to 1 Hz minimum for log display)
    const displayMinFreq = Math.max(1, startFreq);
    const logMin = Math.log10(displayMinFreq);
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

      if (type === 'stepped' && params.steppedFrequencies && params.steppedFrequencies.length) {
        // Draw discrete horizontal steps (frequency array precomputed by caller)
        const frequencies = params.steppedFrequencies;
        const dwellTime = params.dwellTime || 0.5;
        const gapTime = params.gapTime || 0;
        const stepDuration = dwellTime + gapTime;
        const totalSteppedDuration = frequencies.length * stepDuration;

        for (let i = 0; i < frequencies.length; i++) {
          const freq = frequencies[i];
          const logF = Math.log10(Math.max(1, freq));
          const y = h - margin - (logF - logMin) / (logMax - logMin) * (h - margin * 2);

          const stepStartSec = i * stepDuration;
          const stepEndSec = stepStartSec + dwellTime;
          const x1 = repStartX + (stepStartSec / totalSteppedDuration) * (repEndX - repStartX);
          const x2 = repStartX + (stepEndSec / totalSteppedDuration) * (repEndX - repStartX);

          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.stroke();
        }
      } else if (type === 'pattern' && params.patternSequence && params.patternSequence.length) {
        // Draw each tone burst as a horizontal segment at its frequency
        const sequence = params.patternSequence;
        const totalPatternSec = sequence.reduce((s, st) => s + (st.on_ms + st.off_ms) / 1000, 0);
        let tSec = 0;

        for (const step of sequence) {
          const onSec = step.on_ms / 1000;
          const freq = Math.max(1, step.hz);
          const logF = Math.log10(freq);
          const y = h - margin - (logF - logMin) / (logMax - logMin) * (h - margin * 2);
          const x1 = repStartX + (tSec / totalPatternSec) * (repEndX - repStartX);
          const x2 = repStartX + ((tSec + onSec) / totalPatternSec) * (repEndX - repStartX);

          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(Math.max(x1 + 1, x2), y); // ensure at least 1px visible
          ctx.stroke();

          tSec += onSec + step.off_ms / 1000;
        }
      } else {
        // Continuous sweep trajectory
        ctx.beginPath();
        const steps = Math.min(Math.round(repEndX - repStartX), 500);
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          let freq;

          if (type === 'exponential') {
            freq = startFreq * Math.pow(endFreq / startFreq, t);
          } else {
            freq = startFreq + (endFreq - startFreq) * t;
          }

          const logF = Math.log10(Math.max(1, freq));
          const x = repStartX + t * (repEndX - repStartX);
          const y = h - margin - (logF - logMin) / (logMax - logMin) * (h - margin * 2);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
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
    if (this._lastWaveData && this._lastWaveDataR) {
      this._drawStereoWaveformInternal(this._lastWaveData, this._lastWaveDataR, this._lastSampleRate);
    } else if (this._lastWaveData) {
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
   * Draw a vertical playback cursor on the frequency plot, with a frequency label.
   * @param {number} timeSeconds
   * @param {number} totalDuration
   */
  drawFrequencyCursor(timeSeconds, totalDuration) {
    if (!totalDuration || totalDuration <= 0 || !this._lastFreqParams) return;

    // Redraw frequency plot to clear old cursor
    this._drawFrequencyPlotInternal(this._lastFreqParams);

    const params = this._lastFreqParams;
    const ctx = this._freqCanvas.getContext('2d');
    const { w, h } = this._dims(this._freqCanvas);
    const x = (timeSeconds / totalDuration) * w;

    // Store for fade-out
    this._lastCursorTime = timeSeconds;
    this._lastCursorDuration = totalDuration;

    // Draw cursor line
    ctx.strokeStyle = this._cursorColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();

    // Compute current frequency
    const freq = this._getFrequencyAtTime(timeSeconds, params);
    if (freq != null) {
      const label = freq >= 1000 ? (freq / 1000).toFixed(1) + ' kHz' : Math.round(freq) + ' Hz';
      ctx.font = '10px sans-serif';
      const textW = ctx.measureText(label).width;
      // Position label to the right of the cursor, flip to left if near edge
      const labelX = (x + textW + 8 > w) ? x - textW - 6 : x + 4;
      // Draw background pill
      ctx.fillStyle = this._bgColor;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(labelX - 2, 2, textW + 4, 14);
      ctx.globalAlpha = 1;
      ctx.fillStyle = this._cursorColor;
      ctx.fillText(label, labelX, 13);
    }
  }

  /**
   * Compute the instantaneous frequency at a given time from freq plot params.
   * @returns {number|null}
   */
  _getFrequencyAtTime(timeSeconds, params) {
    const { startFreq, endFreq, type } = params;
    const reps = params.repetitions || 1;
    const singleDuration = params.singleSweepDuration || params.duration;
    const interSilenceMs = params.interSweepSilence || 0;
    const leadMs = params.leadSilence || 0;
    const leadSec = leadMs / 1000;
    const interSilenceSec = interSilenceMs / 1000;

    // Check if we're in the lead silence
    if (timeSeconds < leadSec) return null;

    // Find which repetition we're in
    for (let r = 0; r < reps; r++) {
      const repStartSec = leadSec + r * (singleDuration + interSilenceSec);
      const repEndSec = repStartSec + singleDuration;

      if (timeSeconds < repStartSec) return null; // in inter-sweep gap
      if (timeSeconds > repEndSec) continue; // past this rep

      const t = (timeSeconds - repStartSec) / singleDuration; // 0..1 within this rep

      if (type === 'stepped' && params.steppedFrequencies && params.steppedFrequencies.length) {
        const frequencies = params.steppedFrequencies;
        const dwellTime = params.dwellTime || 0.5;
        const gapTime = params.gapTime || 0;
        const stepDuration = dwellTime + gapTime;
        const timeInSweep = t * singleDuration;
        const stepIndex = Math.floor(timeInSweep / stepDuration);
        const timeInStep = timeInSweep - stepIndex * stepDuration;
        if (stepIndex >= frequencies.length) return null;
        if (timeInStep > dwellTime) return null; // in gap between steps
        return frequencies[stepIndex];
      } else if (type === 'pattern' && params.patternSequence && params.patternSequence.length) {
        const timeInSweep = t * singleDuration;
        let cursor = 0;
        for (const step of params.patternSequence) {
          const onSec = step.on_ms / 1000;
          const offSec = step.off_ms / 1000;
          if (timeInSweep < cursor + onSec) return step.hz;
          if (timeInSweep < cursor + onSec + offSec) return null; // in gap
          cursor += onSec + offSec;
        }
        return null;
      } else if (type === 'exponential') {
        return startFreq * Math.pow(endFreq / startFreq, t);
      } else {
        return startFreq + (endFreq - startFreq) * t;
      }
    }

    return null; // in trailing silence
  }

  /**
   * Fade out cursors on both canvases over ~500ms.
   */
  fadeOutCursors() {
    // Cancel any existing fade
    if (this._fadeRafId) {
      cancelAnimationFrame(this._fadeRafId);
      this._fadeRafId = null;
    }

    const time = this._lastCursorTime;
    const duration = this._lastCursorDuration;
    if (!duration || duration <= 0) return;

    const fadeMs = 500;
    const startMs = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startMs;
      const alpha = Math.max(0, 1 - elapsed / fadeMs);

      // Redraw waveform clean
      if (this._lastWaveData && this._lastWaveDataR) {
        this._drawStereoWaveformInternal(this._lastWaveData, this._lastWaveDataR, this._lastSampleRate);
      } else if (this._lastWaveData) {
        this._drawWaveformInternal(this._lastWaveData, this._lastSampleRate);
      }

      // Redraw frequency plot clean
      if (this._lastFreqParams) {
        this._drawFrequencyPlotInternal(this._lastFreqParams);
      }

      if (alpha > 0) {
        // Draw waveform cursor with fading alpha
        const wCtx = this._waveCanvas.getContext('2d');
        const wDims = this._dims(this._waveCanvas);
        const wx = (time / duration) * wDims.w;
        wCtx.globalAlpha = alpha;
        wCtx.strokeStyle = this._cursorColor;
        wCtx.lineWidth = 1.5;
        wCtx.beginPath();
        wCtx.moveTo(wx, 0);
        wCtx.lineTo(wx, wDims.h);
        wCtx.stroke();
        wCtx.globalAlpha = 1;

        // Draw frequency cursor + label with fading alpha
        if (this._lastFreqParams) {
          const fCtx = this._freqCanvas.getContext('2d');
          const fDims = this._dims(this._freqCanvas);
          const fx = (time / duration) * fDims.w;
          fCtx.globalAlpha = alpha;
          fCtx.strokeStyle = this._cursorColor;
          fCtx.lineWidth = 1.5;
          fCtx.beginPath();
          fCtx.moveTo(fx, 0);
          fCtx.lineTo(fx, fDims.h);
          fCtx.stroke();

          // Fade the frequency label too
          const freq = this._getFrequencyAtTime(time, this._lastFreqParams);
          if (freq != null) {
            const label = freq >= 1000 ? (freq / 1000).toFixed(1) + ' kHz' : Math.round(freq) + ' Hz';
            fCtx.font = '10px sans-serif';
            const textW = fCtx.measureText(label).width;
            const labelX = (fx + textW + 8 > fDims.w) ? fx - textW - 6 : fx + 4;
            fCtx.fillStyle = this._bgColor;
            fCtx.globalAlpha = alpha * 0.8;
            fCtx.fillRect(labelX - 2, 2, textW + 4, 14);
            fCtx.globalAlpha = alpha;
            fCtx.fillStyle = this._cursorColor;
            fCtx.fillText(label, labelX, 13);
          }

          fCtx.globalAlpha = 1;
        }

        this._fadeRafId = requestAnimationFrame(tick);
      } else {
        this._fadeRafId = null;
      }
    };

    this._fadeRafId = requestAnimationFrame(tick);
  }

  /**
   * Clear both canvases.
   */
  clear() {
    this._lastWaveData = null;
    this._lastWaveDataR = null;
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
