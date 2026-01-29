# Tārīkh al-Shi'a

> A web-based visualisation presenting key events from the life of of the Ahlul Bayt on an interactive globe

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://faizanabbas5.github.io/ShiaGlobe/)

![Preview](globe.png)
---

## Overview

The project provides:

- A globe view showing locations related to Ahlul Bayt and events
- A time control to see who was alive in a given period
- Detail panels with names, dates, and brief biographical information
- A search function to quickly find specific individuals

---

## Project Structure

```text
tarikh-al-shia/
├── index.html              # Landing page
├── globe.html              # Globe visualisation page
├── assets/
│   ├── css/
│   │   ├── landing-styles.css   # Styles for landing page
│   │   └── globe-styles.css     # Styles for globe and UI
│   └── js/
│       ├── landing.js           # Landing page scripts
│       └── globe.js             # Globe logic and UI behaviour
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
