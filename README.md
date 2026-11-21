# Komet

A browser game about trust: grey dots with comet trails, yellow hunters, fog and a field of 0/1 bits, where every round is a choice between building and devouring.

**Play:** https://komet.run

## Status

Single player against bots works. Multiplayer is planned and needs an authoritative server, so it is not part of this repository yet. The live site may run an earlier build than the one in this repository.

## Features

- Single player against bots, with a wordless learning screen of animated tiles
- Procedural obstacles (sixteen families), fog and light, landscape fullscreen mode
- Touch and keyboard controls
- Sound synthesized locally in the browser, no audio files
- Installable PWA with an offline cache

## Stack

Plain JavaScript, HTML and CSS with a canvas renderer. No build step, no dependencies. The service worker uses a network-first strategy with a versioned cache.

## Run locally

Serve the folder with any static file server and open it in a browser, for example:

```
python -m http.server 8080
```

Then open `http://localhost:8080/`.

## Structure

```
index.html      page, styles and menu
silnik.js       game rules and simulation
boty.js         bot behaviour
klient.js       rendering, input and HUD
ksztalty.js     procedural obstacles
nauka.js        learning screen (animated tiles)
dzwiek.js       sound synthesis
sw.js           service worker
manifest.json   PWA manifest
icon-*.png      app icons
```

## License

All rights reserved.
