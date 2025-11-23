
// Fully code-generated audio using Web Audio API
// No external files or internet connection required for sound assets

let audioCtx: AudioContext | null = null;

export const startAudioEngine = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(e => console.warn("Audio resume failed", e));
  }
  return audioCtx;
};

// Helper to create a simple envelope tone
const playTone = (
  freq: number, 
  type: OscillatorType, 
  duration: number, 
  vol: number = 0.1, 
  delay: number = 0,
  rampType: 'exp' | 'linear' = 'exp'
) => {
  const ctx = startAudioEngine();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  
  // Envelope
  gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.02); // Attack
  
  if (rampType === 'exp') {
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration); // Decay
  } else {
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  }

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.1);
};

// Helper for noise (capture sound)
const playNoise = (duration: number, vol: number) => {
  const ctx = startAudioEngine();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  
  // Lowpass filter to make it a "thud" rather than "static"
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1000;

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  noise.start();
};

export const playSound = (type: 'move' | 'capture' | 'notify' | 'castle' | 'promote') => {
  try {
    switch (type) {
      case 'move':
        // Clean, short "wood block" type tap
        playTone(300, 'sine', 0.08, 0.15, 0, 'exp');
        break;
      
      case 'capture':
        // Thud noise + low tone
        playNoise(0.1, 0.2);
        playTone(150, 'triangle', 0.1, 0.15);
        break;
      
      case 'castle':
        // Sliding sound (two quick moves)
        playTone(350, 'sine', 0.1, 0.1);
        playTone(350, 'sine', 0.1, 0.1, 0.12);
        break;

      case 'promote':
        // Major chord fanfare
        playTone(523.25, 'sine', 0.3, 0.1, 0); // C5
        playTone(659.25, 'sine', 0.3, 0.1, 0.1); // E5
        playTone(783.99, 'sine', 0.5, 0.1, 0.2); // G5
        playTone(1046.50, 'sine', 0.6, 0.1, 0.3); // C6
        break;

      case 'notify':
        // Alert bell
        playTone(880, 'triangle', 0.4, 0.1);
        playTone(1760, 'sine', 0.4, 0.05);
        break;
    }
  } catch (e) {
    console.warn("Audio play failed", e);
  }
};
