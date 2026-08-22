// Live microphone audio-level visualizer (frequency bars) drawn on a <canvas>,
// built purely on the browser's native Web Audio API — no external library.

export function isVisualizerSupported() {
  return !!(navigator.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext));
}

// Starts capturing the mic and drawing bars onto `canvas`. Returns an async
// stop() function that releases the mic stream and audio context.
export async function startVisualizer(canvas) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.75;
  source.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const ctx = canvas.getContext('2d');
  let rafId;

  function draw() {
    rafId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const barCount = 48;
    const step = Math.floor(bufferLength / barCount) || 1;
    const barWidth = width / barCount;

    for (let i = 0; i < barCount; i++) {
      const v = dataArray[i * step] / 255;
      const barHeight = Math.max(2, v * height);
      const x = i * barWidth;
      const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
      gradient.addColorStop(0, `rgba(194, 58, 46, ${0.55 + v * 0.45})`);
      gradient.addColorStop(1, 'rgba(201, 154, 58, 0.55)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 1, height - barHeight, Math.max(1, barWidth - 2), barHeight);
    }
  }
  draw();

  return async function stop() {
    cancelAnimationFrame(rafId);
    try { source.disconnect(); } catch { /* already disconnected */ }
    try { analyser.disconnect(); } catch { /* already disconnected */ }
    stream.getTracks().forEach((t) => t.stop());
    await audioCtx.close().catch(() => {});
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
