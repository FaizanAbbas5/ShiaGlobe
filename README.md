# Tārīkh al-Shi'a
 
> A web-based visualisation presenting key events from the life of of the Ahlul Bayt on an interactive globe
 
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://faizanabbas5.github.io/ShiaGlobe/)

---
 
## Overview
 
The project provides:
 
- A globe view showing locations related to Ahlul Bayt and events
- A time control to see who was alive in a given period
- Detail panels with names, dates, and brief biographical information
- A search function to quickly find specific individuals
- **The Journey to Karbala**: a narrated 3D story in seven chapters, from Yazid's orders in Damascus to the first Arbaeen (see below)
 
---
 
## Project Structure
 
```text
tarikh-al-shia/
├── index.html              # Landing page
├── globe.html              # Globe visualisation page
├── karbala.html            # The Journey to Karbala (3D story)
├── assets/
│   ├── css/
│   │   ├── landing-styles.css   # Styles for landing page
│   │   ├── globe-styles.css     # Styles for globe and UI
│   │   └── karbala-styles.css   # Styles for the Karbala story
│   └── js/
│       ├── landing.js           # Landing page scripts
│       ├── globe.js             # Globe logic and UI behaviour
│       ├── karbala.js           # Karbala story: scenes, camera, narration (ES module, three.js)
│       └── karbala-assets.js    # 3D models (base64 glTF) and map outlines for karbala.js
├── data/
│   └── scholars-data.json       # Historical data
└── README.md
```
 
You can adjust file names as needed, but the paths in the HTML files must match this structure.
 
---
 
## Data File
 
The file `data/scholars-data.json` contains the historical records used by the globe. A typical entry looks like:
 
```json
[
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
]
```
 
Key fields:
 
- `id`: Numeric identifier
- `name`: Name in English
- `arabic`: Name in Arabic
- `titles`: Honorifics or main title
- `lifespan`: Human-readable range
- `period`: Numeric range used for the timeline
- `bio`: Short biography
- `events`: List of dated, located events with type and coordinates
 
---
 
## The Journey to Karbala
 
`karbala.html` tells the story of the journey of Imam Hussain (AS) as a sequence of animated 3D scenes: seven chapters and 26 scenes, from Yazid's orders in Damascus, through Mecca, the road north, Hurr, Karbala and Ashura, to the captives in Kufa and Damascus and the first Arbaeen. A map card between places shows where the story is, and a mini-map follows along.
 
- **Narration**: the story is read aloud by the browser's own speech voices, sentence by sentence, with the sentence shown as a caption. Neural voices sound most natural (Microsoft Edge's "Natural" voices; Brian (US) is the default). The voice can be changed on the intro screen.
- **Pronunciation**: names are respelled for English voices, separately for American and British voices (`NAME_SAY` in `karbala.js`). The intro's "Fix pronunciation" panel lets you hear alternative spellings and copy your choices so they can be made the defaults.
- **Depiction**: members of the Prophet's family are never shown as figures. Each is shown as a floating light (noor), or as a curtained howdah; there is no battle animation, and Ashura is told as a roll call in which each light rises as its name is read.
- **Autoplay** is on by default; use Continue or the ← → keys to move yourself, and H to hide the text.
 
The scenes use [three.js](https://threejs.org/) 0.169, loaded from jsDelivr through the import map in `karbala.html`. Because `karbala.js` is an ES module, the page must be served over HTTP (see below); it will not run when opened directly from the file system.
 
### Credits for 3D models
 
- Camels: Poly by Google, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- Horses, rider figure and palm trees: Quaternius (CC0)
- Rocks: Quaternius and Kenney (CC0)
- Fire pit: CircuitZ (CC0)
 
All via [Poly Pizza](https://poly.pizza/). Tents, saddles, banners, howdahs, buildings and scenery are built in code. The same credits appear on the story's closing screen.
 
---
 
## Running Locally
 
Because the application loads JSON using `fetch`, it must be served over HTTP, not opened directly from the file system.
 
1. Open a terminal in the project directory.
 
2. Start a simple HTTP server, for example:
 
   ```bash
   # Python 3
   python -m http.server 8000
   ```
 
3. In a browser, open:
 
   - `http://localhost:8000/index.html` for the landing page
   - `http://localhost:8000/globe.html` for the globe view
   - `http://localhost:8000/karbala.html` for the Journey to Karbala
 
If the globe shows but no data appears, open browser developer tools (Console and Network tabs) and check for:
 
- Errors fetching `data/scholars-data.json`
- JSON parsing errors
 
---
 
## Contributing
 
Contributions are welcome:
 
### Data Verification
- Review existing records for accuracy
- Report discrepancies or errors through GitHub Issues
- Provide source citations for corrections
 
### Adding New Data
- Add more data on events across the lives of the Ahlul Bayt
- Include complete information: names (English and Arabic), dates, locations, events
- Provide coordinates for geographical locations
- Cite your sources in the pull request description
 
### Feature Suggestions
- Propose new functionality or improvements to existing features
- Open an issue describing the feature and its value
 
### Code Contributions
- Fix bugs or improve performance
- Improve the user interface or user experience
- Improve code documentation and comments
- Ensure changes are tested in multiple browsers
 
### Documentation
- Improve this README or other documentation
- Translate content to other languages
- Add examples or tutorials
 
---
 
## Inspiration
 
This project was inspired by `tarikh.io`. My aim is to work on Shia version of the project.
This project is built for educational purposes only.
