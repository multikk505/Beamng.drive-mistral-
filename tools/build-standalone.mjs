#!/usr/bin/env node
/* Buduje jednoplikową wersję offline: dist/BeamLite.html (bez hostingu, bez modułów).
   Wymaga: npx esbuild (pobierany tymczasowo). Uruchomienie: npm run build */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

execSync(
  'npx --yes esbuild js/main.js --bundle --minify --format=iife ' +
  '--alias:three=./vendor/three/three.module.js --outfile=dist/bundle.js ' +
  '--log-level=error',
  { stdio: 'inherit' }
);

const css = readFileSync('css/style.css', 'utf8');
const js = readFileSync('dist/bundle.js', 'utf8');
const html = readFileSync('index.html', 'utf8');

// weź treść <body> z index.html bez <script> i <link>
let body = html.match(/<body>([\s\S]*)<\/body>/)[1];
body = body.replace(/<script[\s\S]*?<\/script>/g, '').trim();

const standalone = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>BeamLite</title>
<style>
${css}
</style>
</head>
<body>
${body}
<script>
${js}
</script>
</body>
</html>`;

writeFileSync('dist/BeamLite.html', standalone);
rmSync('dist/bundle.js');
console.log('OK: dist/BeamLite.html (wersja offline, wrzuć na telefon i otwórz w przeglądarce)');
