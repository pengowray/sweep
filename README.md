# Sine Sweep Generator

A professional, browser-based audio test signal generator for Impulse Response (IR) capture.

Generate calibrated sweep, noise, and MLS signals and export them as WAV files — no installation or server required. Works entirely in the browser using plain ES6 modules.

## Features

### Signal Types
- **Exponential Sine Sweep (ESS)** — Farina method, constant energy per octave. Primary tool for IR measurement and deconvolution.
- **Linear Sine Sweep** — Constant Hz/sec. Useful for electronics and transducer testing.
- **White Noise** — Flat power spectral density, xorshift128+ PRNG.
- **Pink Noise** — −3 dB/octave (Paul Kellett IIR filter). Equal energy per octave for speaker/room verification.
- **MLS (Maximum Length Sequence)** — Galois LFSR, orders 10–18. Bipolar ±1 for cross-correlation IR extraction.
- **Stepped Sine** — Discrete frequency steps with configurable dwell, gap, and spacing.

### Output Formats
- **Bit depths:** 16-bit PCM, 24-bit PCM, 32-bit IEEE Float
- **Sample rates:** 44.1 kHz – 768 kHz
- **Channels:** Mono, Stereo (identical L+R), Stereo (L=signal, R=sync impulse), Stereo Alternate (L→R), Stereo L/R/Both
- **WAV format:** Broadcast Wave Format (BWF) with `bext` metadata chunk. Uses `WAVE_FORMAT_EXTENSIBLE` for 24-bit and 32-bit.

### Signal Processing
- Fade-in/out: Half-Hanning (smooth S-curve) or Linear
- ESS "1 octave" auto-fade: fade duration = time for sweep to traverse one octave
- Output level: −60 to 0 dBFS (default −3)
- Leading/trailing silence padding
- Repetitions with inter-sweep silence
- Optional inverse filter generation (ESS only) for deconvolution

### Presets
Signal presets for common measurement scenarios:
- Quick Room Test, Full Range, REW-Style, SMAART Short/Long
- Subwoofer Focus, Speech Range, Hi-Res Archival
- White Noise, Pink Noise, MLS

Format presets:
- CD Quality (44.1 kHz / 16-bit), Broadcast (48 kHz / 24-bit), Hi-Res (96 kHz / 24-bit), Studio Max (192 kHz / 32-bit float)

### Preview & Visualization
- In-browser audio preview via Web Audio API (adapts to native sample rate)
- Real-time waveform display with playback cursor
- Frequency-vs-time plot for sweep signals (supports repetitions)

## Usage

1. Open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge)
2. Choose a signal preset or configure manually
3. Select an output format preset or set sample rate / bit depth
4. Click **Preview** to listen, or **Generate & Download** to export a WAV file

No build step required — the app uses native ES6 modules directly.

## File Structure

```
sine-sweep-generator/
├── index.html
├── css/style.css
├── js/
│   ├── app.js                    — Main controller
│   ├── utils.js                  — Shared math utilities
│   ├── worker.js                 — Web Worker pipeline
│   ├── generators/
│   │   ├── sweep.js              — ESS + Linear sweep
│   │   ├── noise.js              — White + Pink noise
│   │   ├── mls.js                — Maximum Length Sequence
│   │   └── stepped-sine.js       — Stepped sine tones
│   ├── audio/
│   │   ├── wav-encoder.js        — Binary WAV construction
│   │   └── preview.js            — Web Audio API playback
│   └── ui/
│       ├── visualizer.js         — Canvas waveform + frequency plots
│       └── presets.js            — Signal + format presets
└── README.md
```

## Technical Details

### ESS Formula (Farina method)
```
x(t) = sin(2π · f₁ · T / ln(f₂/f₁) · (e^(t · ln(f₂/f₁) / T) − 1))
```

### WAV Encoding
- 16-bit: `wFormatTag = 0x0001` (PCM), standard 44-byte header
- 24-bit: `WAVE_FORMAT_EXTENSIBLE (0xFFFE)`, SubFormat GUID for PCM, 3 bytes/sample LE
- 32-bit float: `WAVE_FORMAT_EXTENSIBLE (0xFFFE)`, SubFormat GUID for IEEE_FLOAT

### Performance
- Heavy computation runs in a Web Worker (off main thread)
- Falls back to main-thread generation if module Workers aren't supported
- ArrayBuffer transfer (zero-copy) between worker and main thread
- Debounced waveform visualization updates on parameter changes

## Browser Compatibility

Requires a modern browser with ES6 module support:
- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 79+

## License

Open source. Free to use for any purpose.
