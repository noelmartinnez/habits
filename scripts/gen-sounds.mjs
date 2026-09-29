// Sintetiza los efectos de sonido de la app en assets/sounds/*.wav (mono, 44,1 kHz, 16 bits).
// Uso: node scripts/gen-sounds.mjs
// Todo se genera aquí para poder retocar timbres y duraciones sin depender de bancos de sonidos.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 44100;
const OUT = join(import.meta.dirname, "..", "assets", "sounds");

const hz = (semitonesFromA4) => 440 * 2 ** (semitonesFromA4 / 12);
// Pentatónica mayor de do (do re mi sol la): suena bien en cualquier orden.
const PENTA = [0, 2, 4, 7, 9];
/** Nota n de la escala a partir de do5. */
const penta = (n) => hz(3 + 12 * Math.floor(n / 5) + PENTA[n % 5]);

function buffer(seconds) {
  return new Float32Array(Math.ceil(seconds * RATE));
}

/** Suma un sonido en `buf` a partir de `at` segundos. `fn(t)` devuelve la muestra en el instante t. */
function mix(buf, at, seconds, fn, gain = 1) {
  const start = Math.floor(at * RATE);
  const n = Math.min(buf.length - start, Math.ceil(seconds * RATE));
  for (let i = 0; i < n; i++) buf[start + i] += gain * fn(i / RATE);
}

const TAU = Math.PI * 2;
const attack = (t, a) => Math.min(1, t / a);

/** Marimba: fundamental cálida y parciales altos que se apagan enseguida (el «toc» de la maza). */
const marimba = (f, decay = 0.11) => (t) =>
  attack(t, 0.002) *
  (Math.sin(TAU * f * t) * Math.exp(-t / decay) +
    0.3 * Math.sin(TAU * f * 3.93 * t) * Math.exp(-t / 0.025) +
    0.08 * Math.sin(TAU * f * 9.2 * t) * Math.exp(-t / 0.008));

/** Campana: parciales inarmónicos que brillan y se apagan despacio. */
const bell = (f, decay = 0.5) => (t) =>
  attack(t, 0.003) *
  (Math.sin(TAU * f * t) * Math.exp(-t / decay) +
    0.35 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t / (decay * 0.5)) +
    0.12 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t / (decay * 0.25)));

/** Golpe grave: seno que cae de tono, como un bombo. */
const thump = (from, to, decay = 0.22) => (t) => {
  const k = 12;
  const phase = TAU * (to * t + ((from - to) / k) * (1 - Math.exp(-k * t)));
  return attack(t, 0.002) * Math.sin(phase) * Math.exp(-t / decay);
};

/** Ruido muy corto para el clic inicial. */
const click = (seconds = 0.004) => (t) => (t < seconds ? (Math.random() * 2 - 1) * (1 - t / seconds) : 0);

/** Colchón suave: senos ligeramente desafinados con entrada lenta. */
const pad = (f, decay = 0.7) => (t) =>
  attack(t, 0.04) * (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 1.003 * t)) * Math.exp(-t / decay);

function normalize(buf, peak = 0.85) {
  let max = 0;
  for (const s of buf) max = Math.max(max, Math.abs(s));
  if (max > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / max;
  // Rampa final de 5 ms para que no chasquee al cortar.
  const fade = Math.floor(0.005 * RATE);
  for (let i = 0; i < fade; i++) buf[buf.length - 1 - i] *= i / fade;
  return buf;
}

function wav(buf) {
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const sounds = {};

// Una nota por hábito marcado: sube por la escala (10 notas, dos octavas).
for (let n = 0; n < 10; n++) {
  const b = buffer(0.4);
  mix(b, 0, 0.4, marimba(penta(n)));
  mix(b, 0, 0.01, click(), 0.06);
  sounds[`note-${n}`] = b;
}

// Desmarcar: dos notas que bajan, más suaves.
{
  const b = buffer(0.35);
  mix(b, 0, 0.3, marimba(penta(2), 0.07), 0.6);
  mix(b, 0.07, 0.28, marimba(penta(0), 0.08), 0.6);
  sounds.undo = b;
}

// Todos los hábitos del día hechos: arpegio de campana que sube.
{
  const b = buffer(1.3);
  [5, 7, 8, 10].forEach((n, i) => mix(b, i * 0.055, 1.2, bell(penta(n), 0.45), 1 - i * 0.08));
  mix(b, 0.22, 1.0, pad(penta(5) / 2, 0.5), 0.35);
  sounds.complete = b;
}

// Hito de racha (7, 30, 100…): golpe grave y campanas arriba.
{
  const b = buffer(1.6);
  mix(b, 0, 0.5, thump(140, 48), 1.2);
  [5, 8, 10, 13].forEach((n, i) => mix(b, 0.08 + i * 0.07, 1.4, bell(penta(n), 0.55), 0.8));
  sounds.milestone = b;
}

// Cerrar el día: acorde cálido (do mayor con séptima), sin prisa.
{
  const b = buffer(1.8);
  [0, 2, 3, 4].forEach((n, i) => mix(b, i * 0.03, 1.7, pad(penta(n), 0.75), 0.6));
  mix(b, 0, 1.2, bell(penta(5), 0.6), 0.35);
  sounds.close = b;
}

// Toque en una ficha o botón pequeño.
{
  const b = buffer(0.08);
  mix(b, 0, 0.08, (t) => Math.sin(TAU * 1600 * t) * Math.exp(-t / 0.012));
  mix(b, 0, 0.005, click(0.003), 0.15);
  sounds.tap = b;
}

mkdirSync(OUT, { recursive: true });
for (const [name, b] of Object.entries(sounds)) {
  writeFileSync(join(OUT, `${name}.wav`), wav(normalize(b, name === "tap" ? 0.5 : name === "undo" ? 0.6 : 0.85)));
}
console.log(`${Object.keys(sounds).length} sonidos → ${OUT}`);
