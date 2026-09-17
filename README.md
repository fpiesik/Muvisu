# Musefall

Ein vollständig clientseitiger MIDI-Visualizer für den Browser. MIDI-Dateien werden lokal verarbeitet und als fallende Noten dargestellt. Die Wiedergabe nutzt ein gesampeltes Piano-Soundfont; über die Computer-Tastatur oder die Klaviatur kann live mitgespielt werden.

## Lokal starten

Da Musefall ohne Build-Schritt auskommt, genügt ein statischer Webserver:

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000` öffnen. Für GitHub Pages als Quelle einfach den Root des Branches auswählen.

## Bedienung

- **MIDI öffnen** importiert `.mid`- oder `.midi`-Dateien direkt im Browser.
- **Leertaste** startet oder pausiert die Wiedergabe, **R** springt zum Anfang.
- **A W S E D F T G Z H U J K** spielt die Töne von C4 bis C5.

Das Piano-Soundfont wird beim ersten Abspielen über jsDelivr geladen. Falls dies nicht möglich ist, steht automatisch ein Web-Audio-Synthesizer als Fallback bereit.
