# Karbala narration recordings

The story's default narrator, Michael, is a set of MP3 files made with
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), an open-source speech model (Apache 2.0) that runs on your own computer.
`karbala.js` plays a line's recording when one exists, and otherwise reads the line with the browser's own voice.

Each recording is named by a fingerprint of its line's text. When the story's text changes, the changed lines have no recording
until they are recorded again:

1. Serve the site (see the main README), open `karbala.html`, and in the browser console run
   `copy(JSON.stringify(karbalaNarrationLines()))`. Paste the result into `lines.json` here.
2. In this folder, run `npm install` once, then `npm run record`.
   New and changed lines are recorded (about 2 seconds of work per second of speech on a laptop CPU; the model, about 330 MB,
   is downloaded on first use). Recordings for lines that no longer exist are deleted.
   The script writes `assets/audio/karbala/*.mp3` and `assets/js/karbala-narration.js`.

The voice is Kokoro's `am_michael` at speed 0.9. To change it, run `npm run record -- <voice> <speed>`, e.g. `npm run record -- bm_george 0.9`. A new voice re-records every line.
Kokoro's voices are listed on its [model page](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md).

## Names

The app marks each name it knows in the text, e.g. `⟦hussain⟧` (`NAME_SAY` in `karbala.js`). `names.mjs` gives each one its
pronunciation in the phonetic alphabet Kokoro reads (`NAME_IPA`), and marks further names and words itself (`WORD_MARKS`).
The phonetics actually used for each recording are kept in `manifest.json` (`ph`), so they can be checked.
To change how a name is said, edit `NAME_IPA`, delete that name's recordings (or the whole `files` entry in `manifest.json`) and record again.

## Reading

`speak.mjs` reads like a storyteller: dates as "the second of Muharram", a breath at colons, semicolons, dashes and between
sentences, and before a quotation. `directions.mjs` adds pauses (‖), stress (*word*) and a silence before particular lines,
such as "None did." To change how a line is read, edit its entry there, delete that line's recording (or its entry in
`manifest.json`) and record again.
