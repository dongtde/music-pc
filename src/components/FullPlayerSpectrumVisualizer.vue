<template>
  <div
    class="full-player__visualizer full-player__visualizer--mirror-spectrum"
    :class="{ 'is-playing': active && playing, 'is-live': live }"
    aria-hidden="true"
  >
    <div class="full-player__mirror-spectrum-box">
      <canvas ref="canvasRef" class="full-player__mirror-spectrum-canvas" />
    </div>
  </div>
</template>

<script>
const analyserCache = new WeakMap();
</script>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { usePlayerStore } from '../stores/player';

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  playing: {
    type: Boolean,
    default: false,
  },
});

const player = usePlayerStore();
const canvasRef = ref(null);
const live = ref(false);
const barCount = 64;
const settledLevel = 0.006;
const smoothedLevels = new Float32Array(barCount);
const fallbackSpectrumColors = [
  { r: 139, g: 186, b: 213 },
  { r: 231, g: 169, b: 118 },
  { r: 246, g: 247, b: 251 },
];
let canvasContext = null;
let animationFrame = 0;
let resizeObserver = null;
let canvasWidth = 0;
let canvasHeight = 0;
let spectrumColors = fallbackSpectrumColors;
let lastPaletteRefresh = Number.NEGATIVE_INFINITY;

onMounted(() => {
  canvasContext = canvasRef.value?.getContext('2d') ?? null;
  resizeCanvas();

  if (typeof ResizeObserver !== 'undefined' && canvasRef.value?.parentElement) {
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvasRef.value.parentElement);
  }

  if (props.active) {
    startRenderer();
  }
});

onBeforeUnmount(() => {
  stopRenderer();
  resizeObserver?.disconnect();
  resizeObserver = null;
});

watch(
  () => [props.active, props.playing],
  () => {
    if (props.active) {
      startRenderer();
      return;
    }

    stopRenderer();
  },
);

function startRenderer() {
  if (animationFrame || typeof window === 'undefined') {
    return;
  }

  if (prefersReducedMotion()) {
    drawSpectrum(performance.now());
    return;
  }

  animationFrame = window.requestAnimationFrame(render);
}

function stopRenderer() {
  if (animationFrame && typeof window !== 'undefined') {
    window.cancelAnimationFrame(animationFrame);
  }

  animationFrame = 0;
  live.value = false;
  resetSpectrumLevels();
}

function resizeCanvas() {
  const canvas = canvasRef.value;

  if (!canvas) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const nextWidth = Math.max(1, Math.floor(rect.width));
  const nextHeight = Math.max(1, Math.floor(rect.height));

  if (nextWidth === canvasWidth && nextHeight === canvasHeight) {
    return;
  }

  canvasWidth = nextWidth;
  canvasHeight = nextHeight;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(canvasWidth * pixelRatio);
  canvas.height = Math.floor(canvasHeight * pixelRatio);

  canvasContext = canvas.getContext('2d');
  canvasContext?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawSpectrum(performance.now());
}

function render(timestamp) {
  animationFrame = 0;

  if (!props.active || prefersReducedMotion()) {
    return;
  }

  drawSpectrum(timestamp);

  if (props.playing || !isSpectrumSettled()) {
    animationFrame = window.requestAnimationFrame(render);
    return;
  }

  resetSpectrumLevels();
  clearSpectrumCanvas();
}

function drawSpectrum(timestamp) {
  if (!canvasContext || !canvasWidth || !canvasHeight) {
    return;
  }

  const ctx = canvasContext;
  const targetLevels = getTargetLevels(timestamp);

  if (timestamp - lastPaletteRefresh > 250) {
    refreshSpectrumColors();
    lastPaletteRefresh = timestamp;
  }

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const barWidth = canvasWidth / (barCount * 2);
  const midX = canvasWidth / 2;
  const baselineY = canvasHeight - 2;
  const maxHeight = canvasHeight * 0.92;

  ctx.save();

  for (let index = 0; index < barCount; index += 1) {
    const targetLevel = targetLevels[index] ?? 0;
    const speed = targetLevel > smoothedLevels[index]
      ? 0.42
      : props.playing ? 0.18 : 0.045;
    smoothedLevels[index] += (targetLevel - smoothedLevels[index]) * speed;

    const level = Math.max(0, smoothedLevels[index]);
    const barHeight = level * maxHeight;

    if (barHeight < 0.5) {
      continue;
    }

    const xOffset = index * barWidth;
    const drawWidth = Math.max(1, barWidth * 0.24);
    const insetX = (barWidth - drawWidth) / 2;
    const leftX = midX - xOffset - barWidth + insetX;
    const rightX = midX + xOffset + insetX;
    const y = baselineY - barHeight;
    const radius = Math.min(drawWidth / 2, 4);
    const fillColor = getSpectrumColor(index, 0.74 + level * 0.22);
    const glowColor = getSpectrumColor(index, 0.28 + level * 0.28);

    ctx.fillStyle = fillColor;
    ctx.shadowBlur = 8 + level * 9;
    ctx.shadowColor = glowColor;
    fillRoundedRect(ctx, leftX + 0.5, y, drawWidth, barHeight, radius);
    fillRoundedRect(ctx, rightX + 0.5, y, drawWidth, barHeight, radius);
  }

  ctx.restore();
}

function getTargetLevels(timestamp) {
  const liveLevels = props.playing ? readLiveLevels() : null;

  if (liveLevels) {
    live.value = true;
    return liveLevels;
  }

  live.value = false;
  return props.playing
    ? createProceduralLevels(timestamp)
    : createZeroLevels();
}

function readLiveLevels() {
  const graph = ensureAnalyserGraph();

  if (!graph) {
    return null;
  }

  graph.analyser.getByteFrequencyData(graph.data);

  const levels = Array.from({ length: barCount }, (_, index) => {
    const value = graph.data[index] ?? 0;
    const lowBoost = index < 10 ? 1.18 : index < 24 ? 1.04 : 0.9;

    return Math.min(1, Math.pow(value / 255, 0.72) * lowBoost);
  });
  const energy = levels.reduce((sum, level) => sum + level, 0) / levels.length;

  return energy > 0.018 ? levels : null;
}

function ensureAnalyserGraph() {
  const audioElement = player.getAudioElement?.();

  if (!audioElement || typeof window === 'undefined') {
    return null;
  }

  const cachedGraph = analyserCache.get(audioElement);

  if (cachedGraph) {
    resumeContext(cachedGraph.context);
    return cachedGraph;
  }

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  try {
    const context = new AudioContextConstructor();
    const source = context.createMediaElementSource(audioElement);
    const analyser = context.createAnalyser();
    analyser.fftSize = barCount * 2;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -20;
    analyser.smoothingTimeConstant = 0.68;

    const data = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    analyser.connect(context.destination);

    const graph = { analyser, context, data, source };
    analyserCache.set(audioElement, graph);
    resumeContext(context);
    return graph;
  } catch (error) {
    console.warn('Failed to initialize mirror spectrum visualizer:', error);
    return null;
  }
}

function resumeContext(context) {
  if (context?.state !== 'suspended') {
    return;
  }

  context.resume().catch((error) => {
    console.warn('Failed to resume mirror spectrum visualizer:', error);
  });
}

function createProceduralLevels(timestamp) {
  const seconds = timestamp / 1000;
  const beat = Math.pow((Math.sin(seconds * 3.2) + 1) / 2, 3.2);

  return Array.from({ length: barCount }, (_, index) => {
    const ratio = index / (barCount - 1);
    const bass = Math.max(0, 1 - ratio * 1.72) * beat * 0.52;
    const wave =
      Math.sin(seconds * (4.6 + ratio * 2.1) + index * 0.36) * 0.18 +
      Math.sin(seconds * 7.4 + index * 0.12) * 0.1;
    const body = (1 - Math.abs(ratio - 0.48) * 0.76) * 0.23;

    return clampLevel(0.08 + bass + body + wave);
  });
}

function createZeroLevels() {
  return Array.from({ length: barCount }, () => 0);
}

function clampLevel(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function resetSpectrumLevels() {
  smoothedLevels.fill(0);
}

function isSpectrumSettled() {
  return smoothedLevels.every((level) => level < settledLevel);
}

function clearSpectrumCanvas() {
  canvasContext?.clearRect(0, 0, canvasWidth, canvasHeight);
}

function refreshSpectrumColors() {
  const canvas = canvasRef.value;

  if (!canvas || typeof window === 'undefined') {
    return;
  }

  const styles = window.getComputedStyle(canvas);
  const nextColors = [
    parseCssColor(styles.getPropertyValue('--cover-secondary')),
    parseCssColor(styles.getPropertyValue('--cover-tertiary')),
    parseCssColor(styles.getPropertyValue('--cover-primary')),
  ].filter(Boolean);

  spectrumColors = nextColors.length >= 2 ? nextColors : fallbackSpectrumColors;
}

function getSpectrumColor(index, alpha = 1) {
  const colors = spectrumColors.length >= 2 ? spectrumColors : fallbackSpectrumColors;
  const position = index / Math.max(1, barCount - 1);
  const scaledPosition = position * (colors.length - 1);
  const startIndex = Math.floor(scaledPosition);
  const endIndex = Math.min(colors.length - 1, startIndex + 1);
  const mix = scaledPosition - startIndex;
  const color = mixRgb(colors[startIndex], colors[endIndex], mix);

  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function mixRgb(start, end, mix) {
  return {
    r: Math.round(start.r + (end.r - start.r) * mix),
    g: Math.round(start.g + (end.g - start.g) * mix),
    b: Math.round(start.b + (end.b - start.b) * mix),
  };
}

function parseCssColor(value) {
  const color = String(value ?? '').trim();

  if (!color) {
    return null;
  }

  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (hexMatch) {
    const hex = hexMatch[1].length === 3
      ? hexMatch[1].split('').map((part) => `${part}${part}`).join('')
      : hexMatch[1];
    const numeric = Number.parseInt(hex, 16);

    return {
      r: (numeric >> 16) & 255,
      g: (numeric >> 8) & 255,
      b: numeric & 255,
    };
  }

  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);

  if (!rgbMatch) {
    return null;
  }

  const channels = rgbMatch[1]
    .split(',')
    .slice(0, 3)
    .map((channel) => Number.parseFloat(channel.trim()));

  if (channels.some((channel) => !Number.isFinite(channel))) {
    return null;
  }

  return {
    r: Math.max(0, Math.min(255, Math.round(channels[0]))),
    g: Math.max(0, Math.min(255, Math.round(channels[1]))),
    b: Math.max(0, Math.min(255, Math.round(channels[2]))),
  };
}

function fillRoundedRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    return;
  }

  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.fill();
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
</script>
