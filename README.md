# CarDrive – Candy Racing 🍭🏎️

Ein buntes Mobile-Rennspiel (primär Tablet, Querformat) im Kaugummi-/Brawl-Stars-Look:
Cockpit-Sicht, Lenkrad, Hindernissen ausweichen wie bei Subway Surfers, KI-Gegner,
Quests zum Freischalten neuer Fahrzeuge, Power-ups und Verschönerungen im Shop.
Sprache: Deutsch und Englisch.

A colourful mobile racing game (tablet-first, landscape) in a bubblegum / Brawl Stars style:
cockpit view, steering wheel, dodge obstacles Subway-Surfers-style, AI opponents,
quests that unlock new vehicles, power-ups and cosmetics in the shop. German + English.

## Spielen / Play

GitHub Pages: `https://marcelweissgerberit.github.io/CarDrive/`

Lokal / locally:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Steuerung / Controls

- **Lenkrad ziehen** oder **unten wischen** – lenken
- **Neigung** (optional in den Einstellungen) – Tablet kippen
- Tastatur: `←` `→` oder `A` `D`
- Power-up-Buttons links antippen (Nitro, Schild, Magnet, Zeitlupe)
- iPhone/iPad: am besten über „Teilen → Zum Home-Bildschirm“ installieren, dann läuft das Spiel ohne Safari-Leisten im Vollbild

## Features

- 3 Strecken (Zuckerwatte-Highway, Schoko-Canyon, Neon-Jelly-Nacht), nacheinander freischaltbar
- 3 KI-Gegner mit Hindernisvermeidung und Gummiband-Logik
- 6 Fahrzeuge mit Tempo/Lenkung/Panzerung, freischaltbar über Quests
- 11 Quests (Münzen, Juwelen oder Fahrzeuge als Belohnung)
- Shop: Power-ups für Münzen, Lackierungen/Felgen/Sticker für Juwelen, Münz-Juwelen-Tausch
- Cockpit mit lackierter Motorhaube und Sticker, 3D-Garage-Vorschau
- Spielstand im `localStorage`
- Sound komplett per WebAudio synthetisiert (keine Audiodateien)

## Technik

- Vanilla JS (ES-Module) + [three.js](https://threejs.org/), kein Build-Schritt
- Grafiken (Logo, Menü-Hintergrund, Fahrzeugportraits, Power-up-Icons, Gegner-Avatare, Deko-Referenzen) generiert mit **OpenArt** (Seedream 4.5 / Nano Banana Pro)
- 3D-Modelle (6 Fahrzeuge, 7 Landschafts-Objekte) aus den OpenArt-Bildern mit **Higgsfield** (Tripo H3.1 Image-to-3D) erzeugt, mit gltf-transform optimiert (`assets/models/`)
- three.js liegt lokal unter `vendor/three/` (kein CDN nötig)
- Deployment: GitHub Actions → GitHub Pages (`.github/workflows/pages.yml`)

## Struktur

```
index.html          Screens + HUD
css/style.css       Kaugummi-Look
js/main.js          App-Controller (Menü, Garage, Shop, Quests, Rennen-Flow)
js/game.js          Rennen-Engine (Terrain, Himmel, Straße, Hindernisse, KI, Power-ups)
js/models.js        GLB-Loader mit Toon-Shading und Cartoon-Umrandung
js/cars3d.js        Prozedurale Toy-Car-Modelle
js/garage.js        3D-Vorschau
js/input.js         Lenkrad / Wisch / Tastatur / Neigung
js/audio.js         WebAudio-Synth
js/data.js          Fahrzeuge, Strecken, Shop, Quests
js/i18n.js          DE / EN
js/save.js          Spielstand
assets/img/         OpenArt-Grafiken
assets/models/      GLB-3D-Modelle
vendor/three/       three.js + GLTFLoader
```
