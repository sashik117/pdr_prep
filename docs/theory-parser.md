# Theory Parser

Theory content is sourced only from the official Infotech handbook:

- `https://pdr.infotech.gov.ua/theory/rules`
- `https://pdr.infotech.gov.ua/theory/road-signs`
- `https://pdr.infotech.gov.ua/theory/road-markings`
- `https://pdr.infotech.gov.ua/theory/regulator`
- `https://pdr.infotech.gov.ua/theory/traffic-light`

## Parser entrypoints

- legacy-compatible: [backend/import_handbook.py](/D:/PDRPrep/backend/import_handbook.py)
- new package entrypoint: [backend/parsers/parse_theory_infotech.py](/D:/PDRPrep/backend/parsers/parse_theory_infotech.py)

## Supporting files

- [backend/parsers/theory_sources.py](/D:/PDRPrep/backend/parsers/theory_sources.py)
- [backend/parsers/theory_normalizers.py](/D:/PDRPrep/backend/parsers/theory_normalizers.py)

## Typical commands

```powershell
cd D:\PDRPrep\backend
.\venv311\Scripts\python.exe import_handbook.py --reset --download-images
.\venv311\Scripts\python.exe -m uvicorn main:app --reload
```

## Migration direction

Current imports still reuse the proven `import_handbook.py` flow, but the public parser entrypoint now lives in `backend/parsers` so parsing logic can be split by topic over time:

- `parse_rules()`
- `parse_road_signs()`
- `parse_road_markings()`
- `parse_regulator()`
- `parse_traffic_light()`

