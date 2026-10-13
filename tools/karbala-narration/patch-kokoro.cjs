// kokoro-js keeps its text-to-phonemes step private. This exposes it as `phonemizeText`, so that speak.mjs can
// phonemize ordinary text and put in hand-written phonetics for names. Runs after `npm install`.
const fs = require('node:fs'), path = require('node:path');
const file = path.join(__dirname, 'node_modules', 'kokoro-js', 'dist', 'kokoro.js');
let s = fs.readFileSync(file, 'utf8');
if (/\bas phonemizeText\b/.test(s)) process.exit(0);
const m = /async function (\w+)\(e,a="a",t=!0\)/.exec(s);
if (!m || !s.includes('export{')) { console.error('patch-kokoro: kokoro-js has changed; keep the version pinned in package.json'); process.exit(1); }
s = s.replace('export{', `export{${m[1]} as phonemizeText,`);
fs.writeFileSync(file, s);
console.log('patch-kokoro: phonemizeText exported');
