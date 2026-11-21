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

- **Większa mapa z drogami** — arena 300 × 300 m na terenie 800 × 800 m: bulwar, aleje,
  ulice boczne, plac manewrowy (beton), oznakowanie poziome (krawędzie + przerywana linia).
- **Łatwiejsze prowadzenie** — wyższa przyczepność (okrąg tarcia 1.55), szybsza i szerzej
  skrętna kierownica, silniejsze hamulce; stabilna integracja (10 podkroków/klatkę).
- **Uszkodzenia tylko od kolizji** — plastyczność belek działa wyłącznie przy zgnieceniu
  (duża prędkość zgniatania albo odkształcenie ponad granicę geometryczną): jazda, skoki
  i hamowanie nie deformują auta losowo; zderzenie ze ścianą przy ~125 km/h daje ~55%
  trwałych odkształceń przodu.
- **Ładniejsze modele** — nowa sylwetka nadwozia z łukami nadkoli, węższe szyby, koła
  typu torus z felgami, piastami i ramionami, metaliczny lakier.
- **Tryb poziomy** — nakładka „obróć urządzenie”, pełny ekran + próba `orientation.lock('landscape')`.
- **Sterowanie dotykowe** — kierownica (◀ ▶), gaz / hamulec / hamulec ręczny, multi-touch;
  na desktopie WSAD / strzałki / Spacja.
- **Soft-body crash physics** — węzły + belki (sprężystość, tłumienie, plastyczność, zrywanie),
  geometria nadwozia „skórowana” na węzłach → realistyczne, trwałe deformacje.
- **Model opon z okręgiem tarcia** — napęd AWD, poślizg, burnouty, podsterowność;
  zawieszenie na własnych belkach (pochylenie nadwozia, przysiad przy hamowaniu).
- **Poligon** — ściana crash-testowa, drugie auto soft-body do zderzenia czołowego,
  rampa do skoków, slalom ze stożkami, słupki, otoczenie z cieniami.
- **Wersja offline** — `npm run build` tworzy `dist/BeamLite.html` (jeden plik ~550 KB
  z wbudowanym three.js; otwórz na telefonie bez żadnego hostingu).
- **HUD** — prędkość km/h, pasek % uszkodzeń (suma trwałych odkształceń belek), 2 tryby kamery,
  dźwięk silnika (Web Audio, modulowany obrotami) + szum uderzeń, trzęsienie kamery przy crashu.

## Struktura

```
index.html          – ekran startowy, HUD, przyciski dotykowe, importmap
css/style.css       – UI mobile-first (landscape overlay, kontrolki)
js/softbody.js      – rdzeń fizyki: Node, Beam (plastyczność/zrywanie), kolizje OBB i node-node
js/vehicle.js       – auto: layout węzłów, belki, zawieszenie, model opon, geometria + skinning
js/environment.js   – mapa z drogami, tekstury proceduralne, przeszkody (OBB), rampa, drzewa
js/controls.js      – multi-touch + klawiatura
js/audio.js         – silnik i efekty dźwiękowe (Web Audio)
js/main.js          – scena, światła, kamery, pętla gry
vendor/three/       – three.js (offline)
tests/smoke.mjs     – test dymny fizyki (jazda / brak losowych uszkodzeń / crash / reset / skręt)
tools/build-standalone.mjs – build wersji offline (dist/BeamLite.html)
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
