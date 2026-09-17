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
- **Leertaste** startet oder pausiert die Wiedergabe, **R** springt zum Anfang.
- **A W S E D F T G Z H U J K** spielt die Töne von C4 bis C5.

Das Piano-Soundfont wird beim ersten Abspielen über jsDelivr geladen. Falls dies nicht möglich ist, steht automatisch ein Web-Audio-Synthesizer als Fallback bereit.
