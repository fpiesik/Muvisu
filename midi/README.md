# MIDI-Bibliothek

Lege MIDI-Dateien (`.mid` oder `.midi`) in diesem Ordner ab und ergänze sie in
`manifest.json`. Jeder Eintrag benötigt einen sichtbaren `title` und den relativen
Dateinamen unter `file`. Danach erscheint der Titel automatisch im Auswahlfeld der
Browser-Oberfläche.

Falls ein Review- oder Pull-Request-System keine Binärdateien akzeptiert, kann eine
MIDI-Datei stattdessen als Base64-Text gespeichert werden:

```bash
base64 -w 76 song.mid > song.mid.base64
```

Der zugehörige Manifest-Eintrag erhält dann zusätzlich `"encoding": "base64"`.
`musefall-demo.mid.base64` zeigt dieses Format und wird im Browser vor dem Parsen
automatisch dekodiert.
