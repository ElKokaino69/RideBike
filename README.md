# RideBike

**3D-Fahrradnavigation auf Basis von OpenStreetMap für Android.**
© 2026 Florian Enders. Alle Rechte vorbehalten.

App-ID: `de.enders.ridebike` · Capacitor 8 · MapLibre GL 5 · Vite

---

## Funktionen

**Karte & 3D**
- Vektorkarten von OpenStreetMap (OpenFreeMap) in 7 Stilen: Liberty, Bright, Light, Night, Fjord, CyclOSM (Radkarte), Satellit
- 3D-Gelände mit einstellbarer Überhöhung (1–3×), Kameraneigung bis 80°, 3D-Gebäude, Reliefschattierung, Himmel & Dunst
- Animierter Kartenstart (Anflug zum Standort), leuchtende Radwege, fließende Routenlinie
- Kompass, 2D/3D-Umschalter, Drehen und Neigen mit zwei Fingern

**Pro-Funktionen (v1.7, in der Beta frei)**
- E-Bike-Reichweite: Akku-Simulation entlang der Route (Steigung, Gewicht, Roll-/Luftwiderstand, Abregelgrenze), Vergleich Eco/Tour/Sport/Turbo, Warnung mit Punkt „Akku leer“, Ladestationen in der Nähe (Overpass)
- Wartungs-Tracker: Kette, Kassette, Bremsbeläge, Reifen, Inspektion – Fahrten zählen automatisch (Gelände & E-Bike beschleunigen Verschleiß), Hinweise bei 90 %, „Teil finden“-Link (Partner-ID in `config.js` → `PARTS_SHOP`)
- 3D-Flyover als Hochformat-Video (720×1280) mit Tourdaten, Höhenprofil und Abspann – teilen über das Android-Teilen-Menü; auch für aufgezeichnete Fahrten

**Design wie Vorlage „RideBike 3D Premium“ (v1.6)**
- Karte: Suche mit eigenem Standort-Knopf, Kompass darunter; rechts nur 3D, Ebenen (Kartenstil), Route planen und „Mehr“ (Radwege & Trails, Kartenansicht, Offline, Meilensteine, Fahrt aufzeichnen)
- Route bleibt nach „Zurück“ auf der Karte, unten drei Kacheln (Höhe mit Anstieg, Strecke, Zeit)
- Legende als zwei Karten: Linienarten links, MTB-Skala S0–S6 rechts
- Kartenstil: Satellit-Kachel und 3D-Schalter in einer Reihe
- Navigation: Abbiegekarte mit Straßennummer (z. B. B307), rechts Ton/3D/Zentrieren, großer blauer Pfeil
- Mein Rad: wischbare Radtyp-Reihe, realistische Rad-Grafik im Lichtkegel
- Kamera wird nicht mehr in einen Hang gestellt (Kollisionsschutz im Gebirge)

**Fotorealistische 3D-Karte (v1.5)**
- HD-Gelände online über Mapterhorn (512er Terrarium-Kacheln, in den Alpen sehr fein); offline, im Sparmodus oder bei Ausfall automatisch das gespeicherte Standardmodell
- Himmel über dem Gelände: ziehende Wolken mit Parallaxe, Sonne mit Lichthof an ihrer echten Position, Sterne bei Nacht – exakt am berechneten Horizont
- Luftperspektive: bläulicher Dunst in der Ferne, Luftbild nachts abgedunkelt
- Steile Standard-Kamera (78°, max. 85°) mit filmischem Anflug beim Start
- Route auf dem Luftbild mit kräftigem Leuchten und hellem Lichtsaum
- Neue Schalter unter Kartenstil: „Wolken & Sonne“, „HD-Gelände“

**Meilensteine & Fahrtaufzeichnung (v1.4)**
- Fahrten werden bei der Navigation automatisch aufgezeichnet; freie Fahrten über den roten Aufnahme-Knopf
- Gemessen: Strecke, Fahrzeit in Bewegung, Schnitt, Höchstgeschwindigkeit, Höhenmeter auf/ab (aus dem Geländemodell), höchster Punkt, steilste Steigung (über 100 m), Untergrund (Radweg, Wald-/Feldweg, Pfad, MTB-Trail inkl. Schwierigkeit), befahrene Trails und Radrouten, erreichte Gipfel, besuchte Gebiete
- 50 Meilensteine in 8 Kategorien (Distanz, Höhenmeter, Tempo, Ausdauer, Tageszeit & Saison, Gelände & Trails, Entdecken, Rad & Antrieb), jeweils mit Bronze, Silber und Gold – 150 Stufen
- Übersicht mit Medaillenzähler, Gesamtwerten, Filter nach Kategorie, Fortschrittsbalken bis zur nächsten Stufe und Detailansicht aller Schwellen
- Fahrt-Zusammenfassung mit Höhenprofil, Untergrund-Verteilung und neuen Medaillen; Fahrtenliste
- Feier beim Freischalten: Medaille fliegt drehend ein, Lichtstrahlen, Glanz, Konfetti in Medaillenfarbe, Vibration; während der Fahrt dezente Live-Meldung

**Fotorealistischer Look (v1.4)**
- „Satellit 3D“ ist Standard-Kartenstil: Luftbild mit 3D-Gelände, hellem Himmel, Straßennamen, Radwegen und Trails darüber
- Ohne Netz bzw. im Modus „Nur offline“ automatisch Wechsel auf die gespeicherte Vektorkarte

**Premium-Design (v1.3)**
- Neues Erscheinungsbild nach Vorlage „RideBike 3D Premium“: Lime-Grün auf dunklem Glas, Schrift Inter (mitgeliefert, offline), Bergspitzen-Logo mit Schriftzug „Ride**Bike**“
- Startbildschirm mit Bergsilhouetten, gezeichnetem Trail und animiertem Schriftzug
- Suchleiste mit grünem Standort-Knopf, runde Bedienknöpfe (3D, Kartenstil, Trails, Kartenansicht, Offline), Zoom +/−
- Legende „Radwege & Trails“ mit aufklappbarer MTB-Skala S0–S6; Kartenfarben: Radwege grün, Wald- & Feldwege blau, Pfade gelb, MTB rot
- Höhen-, Strecken- und Zeit-Chips auf der Karte (mit Zähl-Animation)
- Kartenstil-Auswahl mit Vorschaubildern, grünem Haken und 3D-Schalter
- „Route planen“: Listenzeilen Start/Ziel/Via, Fahrradprofil-Menü, Kennzahlen, Höhenprofil in Lime mit Einblend-Animation, großer Knopf „Navigation starten“
- Navigation: großer Abbiegepfeil, Seitenknöpfe (Ton, 2D/3D, Zentrieren, Beenden), drei Kacheln (km/h, bis zum Ziel, Restzeit), blauer 3D-Pfeil mit Lichtspur, Zielflagge
- „Mein Rad“: Fahrrad-Illustration je Typ (Federgabel, Akku, Lastenbox …), Typ-Chips, Reifenbreite, Gewicht-Stepper, Aero-Setup, Erweitert-Bereich
- Animationen: Feder-Übergänge der Fenster, gestaffelte Listen, Knopf-Wellen, Glanz auf dem Hauptknopf, Wechsel-Animation des Abbiegehinweises; respektiert „Bewegung reduzieren“
- Kartenzugriff umschaltbar: Online / Nur WLAN / Nur offline

**Grafik (v1.2)**
- Grafikqualität Auto / Hoch / Ausgewogen / Sparsam: Auto erkennt das Gerät (Speicher, Kerne, Grafikchip) und schaltet bei dauerhaft ruckelnder Karte automatisch eine Stufe herunter
- Stufen steuern Auflösung (Pixel-Ratio), Grafikspeicher (Kachel-Cache) und Animationsrate – schützt schwächere Handys auf langen Touren
- Richtungspfeile auf der Route, pulsierender Zielmarker, veredelter Standort-Puck
- Animierter Wasser-Schimmer, automatische Nachtkarte nach Sonnenuntergang, Satellit mit Straßennamen
- Akku: Effekte pausieren nach 90 s ohne Berührung (nicht während Navigation, Flyover oder Panorama-Drift)

**Offline-Karten (v1.2)**
- Eigener Kachel-Cache (IndexedDB) über das Protokoll `rbc://`, versionsunabhängig für OpenFreeMap-Kacheln und Höhenmodell
- Tour speichern: Korridor entlang der Route (Zoom 6–14, ±1,2 km) inkl. 3D-Gelände, Trails und der Route selbst
- Vor dem Tourstart wird das Speichern aktiv angeboten (abschaltbar, „Nicht mehr fragen“)
- Kartenausschnitt speichern – ideal vor der Tourenplanung (bis ca. 9 000 Kacheln)
- Verwaltung: Speicherbelegung, gespeicherte Gebiete und Touren öffnen, zeigen, löschen; Rückfrage bei mobilen Daten
- Offline-Modus: Hinweis oben, gespeicherte Touren öffnen und navigieren; Suche, neue Routen und Höhenlinien brauchen Internet

**Kartendetails & Animation (v1.1)**
- Höhenlinien mit Höhenangaben, live aus dem Geländemodell berechnet (maplibre-contour, im Web-Worker)
- Gipfel mit Name und Höhe, Waldtextur mit Baumkronen, optional leicht erhabener 3D-Wald
- Rad-POIs: Radläden, Verleih, Radparkplätze, Ladestationen, Trinkwasser, Unterstände, WC, Cafés, Biergärten, Aussichtspunkte, Camping, Hütten (antippbar, „Hierher fahren“)
- Unbefestigte Straßen gepunktet markiert
- Tageslicht nach echtem Sonnenstand: Himmel, Horizont, Dunst, Gebäudelicht und Reliefschatten folgen der Sonne; Modi Live, Morgen, Mittag, Abend, Nacht
- Gelände „wächst“ beim Wechsel in 3D, Panorama-Drift im Leerlauf, fließende Trails, weiche Überblendung beim Stilwechsel, Genauigkeitskreis um den Standort


- Radwege, Feld-/Waldwege, Pfade und MTB-Trails als eigene, einzeln schaltbare Ebenen
- MTB-Trails nach Schwierigkeit gefärbt (S0–S6)
- Radrouten- und MTB-Netz aus OSM (Overpass API): EuroVelo, national, regional, lokal, mit Name, Nummer und Farbe
- Antippen eines Trails → Info-Karte (Länge, Verlauf, Betreiber, Schwierigkeit, Beschreibung, Links) und „Hinfahren“
- Antippen eines Radwegs → Weginfo (Belag, Freigabe, MTB-Skala)
- Optionale Overlays von Waymarked Trails

**Mein Rad (individuelle Parameter)**
- 9 Radtypen mit Voreinstellungen: Trekking, City, Rennrad, Gravel, MTB, E-Bike, E-MTB, S-Pedelec, Lastenrad
- Frei einstellbar: Fahrergewicht, Radgewicht, Gepäck, Dauerleistung (W), Motorunterstützung (W), Höchstgeschwindigkeit, Reifen (Rollwiderstand), Sitzposition (Luftwiderstand)
- Wegewahl: Verkehr meiden, Radrouten bevorzugen, steile Anstiege meiden, Treppen vermeiden, unbefestigte Wege bevorzugen
- Live-Anzeige der berechneten Durchschnittsgeschwindigkeit in der Ebene
- Die Werte gehen als Profilparameter an BRouter (Physikmodell für Fahrzeit, Routingvorlieben) und in die eigene Ankunftszeit-Schätzung ein

**Routing & Navigation**
- Suche (Photon/komoot), lang drücken auf die Karte für Ziel, Start oder Zwischenziel
- Routing mit BRouter, Profil abhängig vom Radtyp (trekking, fastbike, gravel, mtb)
- Ziehbare Wegpunkte, Route nach Steigung gefärbt, interaktives Höhenprofil
- Strecke, Dauer, Anstieg, Abstieg
- 3D-Flyover entlang der Route
- Turn-by-Turn-Navigation mit Abbiegepfeilen, deutschen Sprachansagen, Vibration, Neuberechnung beim Abweichen, mitlaufender 3D-Kamera, Tacho, Restdistanz und Ankunftszeit
- Bildschirm bleibt an, Android-Zurück-Taste wird unterstützt

---

## Funktionsfähige Vorschau als eine HTML-Datei

```bash
npm run build:single   # → dist-single/RideBike-App.html
```
Die komplette App (Karte, 3D, Suche, Routenplanung, Mein Rad, Meilensteine, Offline-Speicher) in einer Datei – im Browser oder auf dem Smartphone öffnen. Kartendaten kommen live aus dem Netz.

## Projektstruktur

```
ridebike/
├─ index.html                 App-Gerüst (Splash, Karte, Sheets, Navi-HUD)
├─ public/logo.svg            Logo
├─ src/
│  ├─ main.js                 Verdrahtung, UI-Logik, Sheets, Planung, Navi-UI
│  ├─ mapcore.js              Karte, Stile, 3D-Gelände, Himmel, Gebäude, Radweg-Ebenen
│  ├─ trails.js               Radrouten & MTB-Trails aus Overpass
│  ├─ routing.js              BRouter, Routendarstellung, Höhenprofil, Flyover
│  ├─ nav.js                  GPS, Turn-by-Turn, Sprachausgabe
│  ├─ bike.js                 Radtypen, Physikmodell, BRouter-Parameter
│  ├─ bike-defaults.js        Standard-Radprofil
│  ├─ settings.js             Einstellungen (Capacitor Preferences)
│  ├─ config.js               Dienste, Stile, Farben, Standardwerte
│  ├─ geo.js                  Geometrie-Helfer
│  ├─ ui.js                   Icons, Sheets, Toasts
│  └─ style.css               Design
├─ assets/                    Icon & Splash (für @capacitor/assets)
├─ scripts/android-setup.mjs  Manifest-Berechtigungen
├─ build-ridebike-apk.ps1     Ein-Klick-Build für Windows
├─ capacitor.config.json
└─ vite.config.js
```

---

## APK bauen (Windows 11)

Voraussetzungen: Node.js 22 oder neuer, Android Studio (mit SDK und dem mitgelieferten JDK 21).

```powershell
cd C:\Users\ender\Desktop\RideBike\ridebike
powershell -ExecutionPolicy Bypass -File .\build-ridebike-apk.ps1
```

Das Skript setzt `JAVA_HOME` auf das JDK von Android Studio (Capacitor 8 braucht JDK 21) und `ANDROID_HOME` auf `%LOCALAPPDATA%\Android\Sdk`. Danach installiert es die Pakete, baut die Web-App, legt beim ersten Lauf das Android-Projekt an, ergänzt die Berechtigungen, erzeugt Icon und Splash, synchronisiert und baut die APK.
Ergebnis: `RideBike-debug.apk` im Projektordner.

Manuell:

```bash
npm install
npm run build
npx cap add android          # nur beim ersten Mal
node scripts/android-setup.mjs
npx capacitor-assets generate --android
npx cap sync android
npx cap open android         # oder: cd android && gradlew assembleDebug
```

Im Browser testen: `npm run dev` → `http://localhost:5173` (GPS über die Browserfreigabe, Sprache über die Web Speech API).

---

## Datenquellen & Nutzungsbedingungen

- Höhenmodell HD: Mapterhorn (https://mapterhorn.com) – Quellenangabe in der Karte


| Zweck | Dienst | Hinweis |
|---|---|---|
| Vektorkarten | OpenFreeMap (OpenMapTiles-Schema) | kostenlos, ohne API-Key |
| Höhendaten | Mapzen/Tilezen Terrain Tiles (AWS Open Data) | kostenlos |
| Routing | brouter.de | öffentlicher Server, bitte maßvoll nutzen |
| Suche | photon.komoot.io | Fair-Use |
| Radrouten/Trails | Overpass API | Fair-Use, Abfragen werden zwischengespeichert |
| Overlays | Waymarked Trails, CyclOSM | Fair-Use |
| Satellit | Esri World Imagery | Nutzungsbedingungen von Esri beachten |

Kartendaten © OpenStreetMap-Mitwirkende, ODbL. Die Quellenangaben erscheinen in der Karte und unter „Kartenansicht → Info“.

Wenn RideBike im Play Store landet oder viele Nutzer bekommt, sollten Routing (eigener BRouter-Server) und Suche selbst gehostet oder kommerziell bezogen werden.

---

© 2026 Florian Enders
