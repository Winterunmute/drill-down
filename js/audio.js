// Tiny synthesized SFX — no audio files, all via Web Audio API.
DrillDown.Audio = (() => {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('drill_down_muted') === '1'; } catch (e) {}

  // Lazily create / resume the context (must follow a user gesture).
  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, type = 'sine', dur = 0.12, gain = 0.15, slideTo = null, delay = 0 }) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  function noise({ dur = 0.2, gain = 0.2, cutoff = 800 }) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const t0 = c.currentTime;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(c.destination);
    src.start(t0); src.stop(t0 + dur);
  }

  // Continuous descent drone while drilling.
  let humOsc = null, humGain = null;
  function humStart() {
    if (muted) return;
    const c = ac(); if (!c || humOsc) return;
    humOsc = c.createOscillator();
    humGain = c.createGain();
    const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 180;
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = 54;
    humGain.gain.setValueAtTime(0.0001, c.currentTime);
    humGain.gain.exponentialRampToValueAtTime(0.035, c.currentTime + 0.4);
    humOsc.connect(filt); filt.connect(humGain); humGain.connect(c.destination);
    humOsc.start();
  }
  function humStop() {
    if (!humOsc || !ctx) return;
    try {
      humGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      humOsc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
    humOsc = null; humGain = null;
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('drill_down_muted', m ? '1' : '0'); } catch (e) {}
    if (m) humStop();
  }

  return {
    resume: () => ac(),
    isMuted: () => muted,
    setMuted,
    toggle: () => { setMuted(!muted); return muted; },
    humStart, humStop,
    tick:      () => tone({ freq: 130 + Math.random() * 50, type: 'square', dur: 0.04, gain: 0.035 }),
    loot:      () => { tone({ freq: 660, type: 'triangle', dur: 0.1, gain: 0.11 }); tone({ freq: 990, type: 'triangle', dur: 0.12, gain: 0.09, delay: 0.06 }); },
    overheat:  () => { noise({ dur: 0.22, gain: 0.16, cutoff: 700 }); tone({ freq: 210, type: 'sawtooth', dur: 0.24, gain: 0.12, slideTo: 80 }); },
    destroyed: () => { tone({ freq: 300, type: 'sawtooth', dur: 0.7, gain: 0.2, slideTo: 40 }); noise({ dur: 0.5, gain: 0.14, cutoff: 500 }); },
    milestone: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.18, gain: 0.12, delay: i * 0.09 })); },
    launch:    () => tone({ freq: 120, type: 'sawtooth', dur: 0.5, gain: 0.14, slideTo: 520 }),
    surface:   () => { [392, 523, 659].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.12, delay: i * 0.08 })); }
  };
})();
