// Tiny WebAudio synth: engine hum, wind rush, ring chime, stamp thud, UI clicks.
// No audio files; everything is oscillators and filtered noise, started only
// after a user gesture and silenced by the settings toggle.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let enabled = true;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 640;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter).connect(windGain).connect(ctx.destination);
      noise.start();
      return true;
    } catch (err) {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    setEnabled(on) {
      enabled = on;
      if (!on && engineGain) engineGain.gain.value = 0;
      if (!on && windGain) windGain.gain.value = 0;
    },
    /** Continuous flight sound: throttle drives engine pitch, speed drives wind. */
    flight(throttle, speedRatio, flying) {
      if (!enabled || !ctx || !flying) {
        if (engineGain) engineGain.gain.value = 0;
        if (windGain) windGain.gain.value = 0;
        return;
      }
      engineOsc.frequency.value = 48 + throttle * 68;
      engineGain.gain.value = 0.015 + throttle * 0.035;
      windGain.gain.value = speedRatio * speedRatio * 0.05;
    },
    click() { blip(660, 0.07, 'triangle', 0.08); },
    ring(centre) { blip(centre ? 1180 : 880, 0.22, 'sine', 0.12, centre ? 1760 : 990); },
    nearMiss() { blip(520, 0.12, 'sine', 0.06, 700); },
    stamp() { blip(140, 0.16, 'sine', 0.22, 60); setTimeout(() => blip(920, 0.1, 'triangle', 0.05), 60); },
    splash() { blip(300, 0.4, 'sine', 0.1, 70); },
    alarm() { blip(220, 0.14, 'square', 0.05, 180); },
  };
}
