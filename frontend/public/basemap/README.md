# Context layers of the map

`<city>.json` (for example `krakow.json`) holds the rivers, lakes, main roads, railways and a few landmarks that the map draws over the district colours, so a reader can find their way. It is served with the app, so the browser never asks a map server for anything.

**The data is © OpenStreetMap contributors, under the Open Database Licence (ODbL) 1.0** (<https://www.openstreetmap.org/copyright>). The map shows that credit under it. A simplified extract like this one is a derived database: if it is shared, it is shared under the ODbL, with the credit. The rest of this repository is under its own licence (`../../../LICENSE`).

For that reason the generated file is **not committed**. Make it once, from the folder of the repository, while the data API runs:

```bash
python3 frontend/scripts/build_basemap.py            # reads the extent and the city code from the API, asks Overpass once, writes frontend/public/basemap/<city>.json
```

The app works without the file: the map then shows the district shapes alone. A deployment builds the file as a build step. Landmarks are listed per city in the script.
