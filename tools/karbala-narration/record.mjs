// Records the Karbala story's narration with Kokoro: one MP3 per line in assets/audio/karbala/, named by the
// FNV-1a fingerprint of the line's text (the same one karbala.js computes), and the list in assets/js/karbala-narration.js.
// Each line is read as directions.mjs says (pauses, stress); the file is still named by the line's own text.
// Lines already recorded with the same voice and speed are kept; lines no longer in lines.json are deleted.
// usage: npm run record                 (voice and speed from manifest.json, or am_michael at 0.9)
//        npm run record -- am_michael 0.9
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTTS, speak, toMp3 } from './speak.mjs';
import { directed } from './directions.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..', '..');
const AUDIO = 'assets/audio/karbala', audioDir = path.join(root, AUDIO), listFile = path.join(root, 'assets/js/karbala-narration.js');
const manFile = path.join(here, 'manifest.json'), KBPS = 40;
const key = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };

let man = fs.existsSync(manFile) ? JSON.parse(fs.readFileSync(manFile, 'utf8')) : null;
const voice = process.argv[2] || man?.voice || 'am_michael', speed = +(process.argv[3] || man?.speed || .9);
if (!man || man.voice !== voice || man.speed !== speed) man = { voice, speed, files: {}, ph: {} };
const lines = JSON.parse(fs.readFileSync(path.join(here, 'lines.json'), 'utf8'));
fs.mkdirSync(audioDir, { recursive: true });

const save = () => fs.writeFileSync(manFile, JSON.stringify(man, null, 1));
let tts = null, made = 0;
const want = new Set();
for (const [n, l] of lines.entries()) {
  const k = key(l.say); want.add(k);
  if (man.files[k] && fs.existsSync(path.join(audioDir, k + '.mp3'))) continue;
  tts ??= await loadTTS();
  const d = directed(l.say);
  const { ph, samples, rate } = await speak(tts, d.text, voice, speed, { lead: d.lead });
  fs.writeFileSync(path.join(audioDir, k + '.mp3'), toMp3(samples, rate, KBPS));
  man.files[k] = +(samples.length / rate).toFixed(2); man.ph[k] = ph; made++; save();
  console.log(`${n + 1}/${lines.length} ${k} ${man.files[k]}s  ${l.say.slice(0, 70)}`);
}
for (const k of Object.keys(man.files)) if (!want.has(k)) { delete man.files[k]; delete man.ph[k]; }
for (const f of fs.readdirSync(audioDir)) if (/^[0-9a-f]{8}\.mp3$/.test(f) && !man.files[f.slice(0, 8)]) fs.unlinkSync(path.join(audioDir, f));
save();
fs.writeFileSync(listFile, `// Recorded narration for karbala.js: line fingerprint → length in seconds. Voice: Kokoro (${man.voice}), Apache 2.0.\n` +
  `// Written by tools/karbala-narration/record.mjs.\n` +
  `window.NARR_AUDIO = ${JSON.stringify({ voice: man.voice, base: AUDIO + '/', files: man.files })};\n`);
const secs = Object.values(man.files).reduce((a, b) => a + b, 0);
console.log(`${made} recorded; ${Object.keys(man.files).length} lines, ${(secs / 60).toFixed(1)} minutes of speech`);
