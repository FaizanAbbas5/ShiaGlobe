# Tārīkh al-Shi'a

> A visual archive of the Ahlul Bayt and Shia scholars: an interactive globe, a narrated 3D journey to Karbala, and stories for children.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://faizanabbas5.github.io/ShiaGlobe/)

---

## What's inside

- **[Shia Globe](https://faizanabbas5.github.io/ShiaGlobe/globe.html)**: the Imams and scholars on an interactive globe, with a timeline showing who was alive in a given period, detail panels with names, dates and short biographies, and search.
- **[The Journey to Karbala](https://faizanabbas5.github.io/ShiaGlobe/karbala.html)**: a narrated 3D story in seven chapters, from Yazid's orders in Damascus to the first Arbaeen. Members of the Prophet's family are never shown as figures: each appears as a light (noor) or a curtained howdah, there is no battle animation, and Ashura is told as a roll call.
- **Stories for children**:
  - [Dua al-Faraj for Children](https://faizanabbas5.github.io/ShiaGlobe/dua-al-faraj/), a learn-along animated film
  - [How Do You Wrap a Kindness?](https://faizanabbas5.github.io/ShiaGlobe/wrap-a-kindness/), a Kumayl & Fizza picture book for the 15th of Sha'ban
  - [The Littlest Khadim](https://faizanabbas5.github.io/ShiaGlobe/littlest-khadim/), a Kumayl & Fizza picture book about the Arbaeen walk

  The picture books are in progress; their pages are added as they are finished.

---

## Project structure

```text
├── index.html                 # Landing page
├── globe.html                 # Shia Globe
├── karbala.html               # The Journey to Karbala
├── dua-al-faraj/              # The stories for children (copied in by tools/sync-stories.py)
├── wrap-a-kindness/
├── littlest-khadim/
├── assets/
│   ├── audio/karbala/         # Recorded narration, one MP3 per line
│   ├── img/                   # Karbala poster; story pictures for the cards and link previews
│   ├── css/                   # landing-style.css, globe-styles.css, karbala-styles.css
│   └── js/
│       ├── landing.js         # Landing page: navbar, contact form, "Our Vision" tabs
│       ├── globe.js           # Globe and timeline
│       ├── karbala.js         # Karbala story: scenes, camera, narration (ES module, three.js)
│       ├── karbala-assets.js  # 3D models (glTF) and map outlines
│       └── karbala-narration.js # The recorded narration lines
├── data/scholars-data.json    # Historical data for the globe
└── tools/
    ├── karbala-narration/     # Records the narration with Kokoro (see its README)
    └── sync-stories.py        # Copies the children's stories into the site
```

---

## Running locally

The pages load data and ES modules, so serve the folder over HTTP rather than opening the files directly:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

To update a story after it changes in its own project, run `python tools/sync-stories.py` (add `--thumbs` to redraw the card pictures). It needs Microsoft Edge and Pillow: the 2D book's pages are drawn to pictures for the site, so its page turns stay smooth on phones.

---

## Data

`data/scholars-data.json` holds the records shown on the globe. A typical entry:

```json
{
  "id": 1,
  "name": "Ali ibn Abi Talib",
  "arabic": "علي بن أبي طالب",
  "titles": "Amir al-Muminin",
  "lifespan": "23 BH – 40 AH",
  "period": [11, 40],
  "bio": "Short biographical summary.",
  "events": [
    {
      "year": 600,
      "title": "Birth in Mecca",
      "description": "Born in Mecca.",
      "location": "Mecca",
      "type": "birth",
      "coordinates": { "lat": 21.4225, "lng": 39.8262 }
    }
  ]
}
```

`period` is the numeric range used by the timeline; each event has a type and coordinates.

---

## Credits

- **The Journey to Karbala**: camels by Poly by Google ([CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)); horses, palm trees and the Universal Base Characters behind the riders and people by Quaternius (CC0); rocks by Quaternius and Kenney (CC0); fire pit by CircuitZ (CC0), all via [Poly Pizza](https://poly.pizza/). The howdahs, riders and people were made in [Blender](https://www.blender.org/). Scenes use [three.js](https://threejs.org/). Narration voice: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) by hexgrad (Apache 2.0).
- **Dua al-Faraj for Children**: recitation by Jihad al-Haddad ([CC BY](https://www.youtube.com/watch?v=G1wbWnDvuyE)).

---

## Contributing

Contributions are welcome, especially:

- **Checking the data**: report errors through GitHub Issues, with sources.
- **Adding data**: events from the lives of the Ahlul Bayt and scholars, with English and Arabic names, dates, places, coordinates and sources.
- **Ideas and code**: open an issue describing a feature, or a pull request tested in more than one browser.

---

## Inspiration

Inspired by `tarikh.io`; this is a Shia version of the idea. Built for educational purposes only.

By [Faizan Abbas](https://www.linkedin.com/in/faizan-abbas-b774a2217/).
