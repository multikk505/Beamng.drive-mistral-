# BeamLite — mobilna wersja BeamNG.drive (przeglądarka / PWA-ready)

Sterowanie dotykowe, wymuszony **tryb poziomy (landscape)**, grafika 3D (Three.js) i
**fizyka soft-body typu node/beam** — ta sama klasa symulacji, której używa BeamNG.drive.
Karoseria to siatka ~20 węzłów połączonych ~106 belkami ze sztywnością, tłumieniem i
**plastycznością**: przy zderzeniu blacha się gniecie **trwale** (widocznie i w fizyce),
a nie wraca do kształtu.

## Uruchomienie

```bash
npm install
npm start          # serwer na http://localhost:8080
```

Gra jest w 100% statyczna (three.js w vendoringu), więc działa też offline i na
każdym hostingu statycznym (m.in. GitHub Pages). Na telefonie otwórz przez HTTPS.

## Funkcje

- **Tryb poziomy** — nakładka „obróć urządzenie”, pełny ekran + próba `orientation.lock('landscape')`.
- **Sterowanie dotykowe** — kierownica (◀ ▶), gaz / hamulec / hamulec ręczny, multi-touch;
  na desktopie WSAD / strzałki / Spacja.
- **Soft-body crash physics** — węzły + belki (sprężystość, tłumienie, plastyczność, zrywanie),
  geometria nadwozia „skórowana” na węzłach → realistyczne, trwałe deformacje.
- **Model opon z okręgiem tarcia** — napęd AWD, poślizg, burnouty, podsterowność;
  zawieszenie na własnych belkach (pochylenie nadwozia, przysiad przy hamowaniu).
- **Poligon** — ściana crash-testowa, drugie auto soft-body do zderzenia czołowego,
  rampa do skoków, slalom ze stożkami, słupki, otoczenie z cieniami.
- **HUD** — prędkość km/h, pasek % uszkodzeń (suma trwałych odkształceń belek), 2 tryby kamery,
  dźwięk silnika (Web Audio, modulowany obrotami) + szum uderzeń, trzęsienie kamery przy crashu.

## Struktura

```
index.html          – ekran startowy, HUD, przyciski dotykowe, importmap
css/style.css       – UI mobile-first (landscape overlay, kontrolki)
js/softbody.js      – rdzeń fizyki: Node, Beam (plastyczność/zrywanie), kolizje OBB i node-node
js/vehicle.js       – auto: layout węzłów, belki, zawieszenie, model opon, geometria + skinning
js/environment.js   – poligon, tekstura asfaltu, przeszkody (OBB), rampa, drzewa
js/controls.js      – multi-touch + klawiatura
js/audio.js         – silnik i efekty dźwiękowe (Web Audio)
js/main.js          – scena, światła, kamery, pętla gry
vendor/three/       – three.js (offline)
tests/smoke.mjs     – test dymny fizyki (jazda / crash / reset / skręt) w Node.js
```

## Test fizyki

```bash
npm test
```

## Zakres i uproszczenia

Realistyczny silnik BeamNG ma tysiące elementów i dekadę iteracji — ten projekt to
grywalna, mobilna wersja tej samej rodziny fizyki: pełna deformacja nadwozia,
zderzenia między autami soft-body, poślizgi i skoki. Nie ma (świadomie) symulacji
każdej części mechanicznej osobno, ani trybu sieciowego.
