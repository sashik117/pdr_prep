const TONES = {
  correct: { frequency: 720, duration: 0.08, gain: 0.035 },
  wrong: { frequency: 240, duration: 0.1, gain: 0.03 },
  finish: { frequency: 520, duration: 0.12, gain: 0.035 },
};

export function soundEnabled() {
  try {
    return JSON.parse(localStorage.getItem('soundEnabled') || 'true') !== false;
  } catch {
    return true;
  }
}

export function playTone(type = 'correct') {
  if (!soundEnabled() || typeof window === 'undefined') return;
  const AudioContextCtor = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const audioContext = new AudioContextCtor();
    const tone = TONES[type] || TONES.correct;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = tone.frequency;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(tone.gain, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + tone.duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + tone.duration + 0.02);
    oscillator.onended = () => audioContext.close().catch(() => {});
  } catch {
    // Sound is a comfort feature, so blocked audio should never interrupt the test.
  }
}
