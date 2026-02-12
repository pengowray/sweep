// js/audio/preview.js — Web Audio API preview playback

/**
 * Audio preview controller.
 * Handles playback of generated signals using the Web Audio API.
 * Automatically adapts to the AudioContext's native sample rate.
 */
export class PreviewPlayer {
  constructor() {
    this._audioContext = null;
    this._sourceNode = null;
    this._audioBuffer = null;
    this._isPlaying = false;
    this._startTime = 0;
    this._pauseOffset = 0;
    this._onTimeUpdate = null;
    this._rafId = null;
    this._onEnded = null;
  }

  /**
   * Get or create the AudioContext (lazily, to satisfy autoplay policies).
   * @returns {AudioContext}
   */
  _getContext() {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._audioContext;
  }

  /**
   * @returns {number} The AudioContext's native sample rate
   */
  get nativeSampleRate() {
    return this._getContext().sampleRate;
  }

  /**
   * Load samples for preview.
   * Converts Float64Array to Float32Array and creates an AudioBuffer.
   * @param {Float64Array} samples - Source samples
   * @param {number} sourceSampleRate - The rate the samples were generated at
   * @param {number} [numChannels=1]
   */
  load(samples, sourceSampleRate, numChannels = 1) {
    const ctx = this._getContext();
    this.stop();

    // Convert Float64 to Float32
    const float32 = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      float32[i] = samples[i];
    }

    // Use the context's native sample rate if the source rate isn't supported.
    // Web Audio createBuffer may throw for very high rates on some browsers.
    let bufferRate = sourceSampleRate;
    try {
      this._audioBuffer = ctx.createBuffer(numChannels, float32.length, bufferRate);
    } catch (e) {
      // Fall back to the context's native rate
      bufferRate = ctx.sampleRate;
      const resampledLength = Math.round(float32.length * bufferRate / sourceSampleRate);
      this._audioBuffer = ctx.createBuffer(numChannels, resampledLength, bufferRate);
      // Simple linear resampling
      const resampled = new Float32Array(resampledLength);
      const ratio = sourceSampleRate / bufferRate;
      for (let i = 0; i < resampledLength; i++) {
        const srcIdx = i * ratio;
        const lo = Math.floor(srcIdx);
        const hi = Math.min(lo + 1, float32.length - 1);
        const frac = srcIdx - lo;
        resampled[i] = float32[lo] * (1 - frac) + float32[hi] * frac;
      }
      for (let ch = 0; ch < numChannels; ch++) {
        this._audioBuffer.copyToChannel(resampled, ch);
      }
      this._pauseOffset = 0;
      return;
    }

    // Copy to all channels
    for (let ch = 0; ch < numChannels; ch++) {
      this._audioBuffer.copyToChannel(float32, ch);
    }

    this._pauseOffset = 0;
  }

  /**
   * Start or resume playback.
   */
  play() {
    if (!this._audioBuffer) return;
    if (this._isPlaying) return;

    const ctx = this._getContext();

    // Resume context if suspended (autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    this._sourceNode = ctx.createBufferSource();
    this._sourceNode.buffer = this._audioBuffer;
    this._sourceNode.connect(ctx.destination);

    this._sourceNode.onended = () => {
      this._isPlaying = false;
      this._pauseOffset = 0;
      this._cancelTimeUpdate();
      if (this._onEnded) this._onEnded();
    };

    this._sourceNode.start(0, this._pauseOffset);
    this._startTime = ctx.currentTime - this._pauseOffset;
    this._isPlaying = true;

    this._startTimeUpdate();
  }

  /**
   * Pause playback, remembering position.
   */
  pause() {
    if (!this._isPlaying || !this._sourceNode) return;

    const ctx = this._getContext();
    this._pauseOffset = ctx.currentTime - this._startTime;
    this._sourceNode.onended = null;
    this._sourceNode.stop();
    this._sourceNode.disconnect();
    this._sourceNode = null;
    this._isPlaying = false;
    this._cancelTimeUpdate();
  }

  /**
   * Stop and reset to beginning.
   */
  stop() {
    if (this._sourceNode) {
      this._sourceNode.onended = null;
      try { this._sourceNode.stop(); } catch (e) { /* already stopped */ }
      try { this._sourceNode.disconnect(); } catch (e) { /* ok */ }
      this._sourceNode = null;
    }
    this._isPlaying = false;
    this._pauseOffset = 0;
    this._cancelTimeUpdate();
  }

  get isPlaying() {
    return this._isPlaying;
  }

  /**
   * @returns {number} Current playback time in seconds
   */
  get currentTime() {
    if (!this._isPlaying) return this._pauseOffset;
    const ctx = this._getContext();
    return ctx.currentTime - this._startTime;
  }

  /**
   * @returns {number} Total duration in seconds, or 0 if nothing loaded
   */
  get duration() {
    return this._audioBuffer ? this._audioBuffer.duration : 0;
  }

  /**
   * Register a callback for playback position updates (~60fps).
   * @param {function(number)} callback - receives currentTime
   */
  onTimeUpdate(callback) {
    this._onTimeUpdate = callback;
  }

  /**
   * Register a callback for when playback ends.
   * @param {function} callback
   */
  onEnded(callback) {
    this._onEnded = callback;
  }

  _startTimeUpdate() {
    const tick = () => {
      if (!this._isPlaying) return;
      if (this._onTimeUpdate) {
        this._onTimeUpdate(this.currentTime);
      }
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _cancelTimeUpdate() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Clean up resources.
   */
  dispose() {
    this.stop();
    if (this._audioContext) {
      this._audioContext.close().catch(() => {});
      this._audioContext = null;
    }
  }
}
