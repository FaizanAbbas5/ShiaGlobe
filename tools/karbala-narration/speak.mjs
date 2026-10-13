// Kokoro (Apache-2.0, runs locally) with exact phonetics for names, a storyteller's pauses and emphasis, and MP3 output.
import { KokoroTTS, phonemizeText } from 'kokoro-js';
import lamejs from '@breezystack/lamejs';
import { NAME_IPA, WORD_MARKS } from './names.mjs';

export const loadTTS = () => KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp32', device: 'cpu' });

// A small word phonemized on its own (between two names) comes back stressed, e.g. 'and' as ˈænd; in running speech it is weak.
const WEAK = { 'ˈænd': 'ænd', 'ðˈə': 'ðə', 'ðˈiː': 'ðɪ', 'ˈʌv': 'ʌv', 'ˈɪn': 'ɪn', 'tˈuː': 'tə', 'fɹˈʌm': 'fɹʌm', 'hˈɪz': 'hɪz', 'ˈæt': 'æt', 'ˈɑːn': 'ɑːn',
  'wˈɪð': 'wɪð', 'fˈɔːɹ': 'fɚ', 'bˈaɪ': 'baɪ', 'ˈæz': 'æz', 'hˈɜː': 'hɜː', 'ˈɔːɹ': 'ɚ', 'ˈæn': 'ən', 'ˈɪz': 'ɪz', 'wˈʌz': 'wʌz' };
const unstress = ph => ph.replace(/(^|\s)([^\s,.!?;:]+)(?=[\s,.!?;:]|$)/g, (m, sp, w) => sp + (WEAK[w] ?? w));
// emphasis: every word in the phrase carries a full stress
const VOWEL = /[aeiouæɑɐɒɔəɛɜɪʊʌɚᵻ]/;
const emph = ph => ph.split(' ').map(w => w.includes('ˈ') ? w : w.includes('ˌ') ? w.replace('ˌ', 'ˈ') : w.replace(VOWEL, 'ˈ$&')).join(' ');

// Text may already carry name markers ⟦id⟧; further known words are marked here. Plain parts go through
// Kokoro's own phonemizer; marked names get their hand-written phonetics.
async function plainPh(text, lang) {
  for (const [re, id] of WORD_MARKS) text = text.replace(re, `⟦${id}⟧`);
  const parts = text.split(/⟦([a-z]+)⟧/), out = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2) {
      let ipa = NAME_IPA[parts[i]] ?? await phonemizeText(parts[i], lang);
      // a possessive after a name: Hussain's
      if (/^['’]s\b/.test(parts[i + 1] || '')) { ipa += /[szʃʒ]$/.test(ipa) ? 'ɪz' : /[ptkfθ]$/.test(ipa) ? 's' : 'z'; parts[i + 1] = parts[i + 1].slice(2); }
      out.push(ipa); continue;
    }
    if (parts[i].trim()) out.push(unstress(await phonemizeText(parts[i], lang)));
  }
  return out.join(' ');
}
// *words* are emphasised
export async function toPhonemes(text, lang) {
  const out = [];
  for (const [i, part] of text.split(/\*([^*]+)\*/).entries()) {
    if (!part.trim()) continue;
    const ph = await plainPh(part, lang);
    out.push(i % 2 ? emph(ph) : ph);
  }
  return out.join(' ').replace(/\s+([,.!?;:])/g, '$1').replace(/\s+/g, ' ').trim();
}

// How a storyteller reads: a breath at colons, semicolons and dashes and between sentences, glosses set off by commas.
// ‖ marks a pause (each ‖ is PAUSE seconds); a line's own direction can add more.
const PAUSE = .36;
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth',
  'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
const ordinal = n => n <= 20 ? ORD[n] : n < 30 ? 'twenty-' + ORD[n - 20] : n === 30 ? 'thirtieth' : 'thirty-' + ORD[n - 30];
const MONTH = '(?:⟦muharram⟧|Muharram|Safar|Rajab|Ramadan|Shaabaan|Dhul Hijja)';
export function direct(text) {
  return text
    // dates as a storyteller says them: "On 2 Muharram 61 A H the caravan" → "On the second of Muharram, 61 A H, | the caravan"
    .replace(new RegExp(`\\b(\\d{1,2}) (?=${MONTH})`, 'g'), (m, d) => `the ${ordinal(+d)} of `)
    .replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/g, (m, d) => ordinal(+d))
    .replace(new RegExp(`^((?:On|At dawn on|Through) the [a-z-]+(?: of ${MONTH}(?: \\d+ A H)?)?)\\s+(?!of\\b)(?=[A-Za-z⟦])`), '$1, ‖ ')
    .replace(/(\d+ A H)\s+(?=[a-z])/g, '$1, ‖ ')
    // references such as (30:10) are for the eye
    .replace(/\s*\(\d+:\d+\)/g, '')
    // a quotation introduced without a colon still gets a breath
    .replace(/(\w) (["“])/g, '$1, ‖ $2')
    // long sentences breathe before their turns
    .replace(/, (so|but) (?=\w)/g, (m, w) => text.length > 120 ? `, ‖ ${w} ` : m)
    .replace(/\s*\(([^)]+)\)/g, ', $1,')
    .replace(/\s*[—–]\s*/g, ', ‖ ')
    .replace(/([:;])\s+(?!‖)/g, '$1 ‖ ')
    .replace(/([.!?]["”]?)\s+(?=["“]?(?:[A-Z⟦*]|al-))(?!‖)/g, '$1 ‖ ')
    .replace(/,\s*,/g, ',').replace(/,\s*([.!?:;])/g, '$1').replace(/\s+/g, ' ').trim();
}

// The model reads at most ~510 phoneme tokens at once; longer pieces are cut at clause breaks.
function chunks(text, max = 260) {
  if (text.length <= max) return [text];
  for (const re of [/(?<=[.!?]["”]?)\s+/, /(?<=[;:])\s+/, /(?<=,)\s+/]) {
    const bits = text.split(re);
    if (bits.length < 2) continue;
    const out = [];
    for (const b of bits) { if (out.length && (out[out.length - 1] + ' ' + b).length <= max) out[out.length - 1] += ' ' + b; else out.push(b); }
    if (out.every(o => o.length <= max)) return out;
    return out.flatMap(o => chunks(o, max));
  }
  return [text];
}

function trim(a, rate, pad = .05) {
  const th = .006, p = Math.round(pad * rate);
  let i = 0, j = a.length - 1;
  while (i < a.length && Math.abs(a[i]) < th) i++;
  while (j > i && Math.abs(a[j]) < th) j--;
  return a.subarray(Math.max(0, i - p), Math.min(a.length, j + p));
}

// opts: lead (seconds of silence before), raw (skip the reading rules)
export async function speak(tts, text, voice, speed = .92, opts = {}) {
  const lang = voice[0] === 'b' ? 'b' : 'a', phs = [], pieces = [];
  let rate = 24000;
  const bits = (opts.raw ? text : direct(text)).split(/\s*(‖+)\s*/);
  for (let i = 0; i < bits.length; i += 2) {
    if (!bits[i].trim()) continue;
    const cs = chunks(bits[i]);
    for (const [k, c] of cs.entries()) {
      const ph = await toPhonemes(c, lang);
      const { input_ids } = tts.tokenizer(ph, { truncation: true });
      const audio = await tts.generate_from_ids(input_ids, { voice, speed });
      rate = audio.sampling_rate; phs.push(ph); pieces.push(trim(audio.audio, rate));
      const gap = k < cs.length - 1 ? .22 : bits[i + 1] ? bits[i + 1].length * PAUSE : 0;
      if (gap) pieces.push(new Float32Array(Math.round(gap * rate)));
    }
  }
  if (opts.lead) pieces.unshift(new Float32Array(Math.round(opts.lead * rate)));
  const n = pieces.reduce((s, p) => s + p.length, 0), samples = new Float32Array(n);
  let o = 0;
  for (const p of pieces) { samples.set(p, o); o += p.length; }
  return { ph: phs.join(' | '), samples, rate };
}

export function toMp3(samples, rate, kbps = 48) {
  const enc = new lamejs.Mp3Encoder(1, rate, kbps), pcm = new Int16Array(samples.length), out = [];
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 32767;
  for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) out.push(Buffer.from(b)); }
  const e = enc.flush(); if (e.length) out.push(Buffer.from(e));
  return Buffer.concat(out);
}
