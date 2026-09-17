# Musefall

Ein vollständig clientseitiger MIDI-Visualizer für den Browser. MIDI-Dateien werden lokal verarbeitet und als fallende Noten dargestellt. Die Wiedergabe nutzt ein gesampeltes Piano-Soundfont; über die Computer-Tastatur oder die Klaviatur kann live mitgespielt werden.

## Lokal starten

Da Musefall ohne Build-Schritt auskommt, genügt ein statischer Webserver:

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000` öffnen.

## Auf GitHub Pages veröffentlichen

Der Workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
veröffentlicht die statischen Dateien bei jedem Push auf `main`. Er lässt sich unter
**Actions → GitHub Pages bereitstellen → Run workflow** auch manuell starten.

Damit die Veröffentlichung funktioniert, muss unter **Settings → Pages → Build and
deployment → Source** einmalig **GitHub Actions** ausgewählt sein. Der erfolgreiche
Workflow zeigt anschließend die veröffentlichte URL im Deployment-Schritt an.

## Bedienung

- **MIDI öffnen** importiert `.mid`- oder `.midi`-Dateien direkt im Browser.
- Die **MIDI-Bibliothek** lädt Titel aus dem Ordner `midi/`; neue Dateien werden in `midi/manifest.json` eingetragen.
- Der **Tempo**-Regler passt die Wiedergabe zwischen 40 und 240 BPM an.
- **Leertaste** startet oder pausiert die Wiedergabe, **R** springt zum Anfang.
- **Y S X D C V G B H N J M ,** spielt die untere Oktave C3–C4; **Q 2 W 3 E R 5 T 6 Z 7 U I** die obere Oktave C4–C5.
- Auf Touch-Geräten lässt sich die Klaviatur mit mehreren Fingern spielen; beim Streichen wechseln die Töne mit den berührten Tasten.

Das Piano-Soundfont wird beim ersten Abspielen über jsDelivr geladen. Falls dies nicht möglich ist, steht automatisch ein Web-Audio-Synthesizer als Fallback bereit.
