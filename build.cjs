const fs = require('node:fs'),
  path = require('node:path'),
  esbuild = require('esbuild');
const root = __dirname,
  read = (file) =>
    fs
      .readFileSync(path.join(root, 'src', file), 'utf8')
      .replace(/\r\n/g, '\n');
// Bundle the pinned renderer inside the document. No runtime imports or CDN.
const three = esbuild.buildSync({
  stdin: {
    contents: "import * as THREE from 'three'; window.THREE=THREE;",
    resolveDir: root,
  },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'inline',
}).outputFiles[0].text;
const license = fs.readFileSync(
  path.join(root, 'node_modules/three/LICENSE'),
  'utf8',
);
let html = read('index.html');
if (html.split('/* THREE_JS */').length !== 2)
  throw new Error('Missing or duplicate renderer marker');
html = html.replace(
  '/* THREE_JS */',
  () =>
    '/*! Three.js 0.187.0\n' +
    license +
    '*/\n' +
    three.replace(/<\/script/gi, '<\\/script'),
);
for (const [marker, file] of [
  ['/* APP_CSS */', 'style.css'],
  ['/* GAME_CONTENT */', 'game-content.js'],
  ['/* GAME_MODEL */', 'game-model.js'],
  ['/* SCENE_JS */', 'scene.js'],
  ['/* APP_JS */', 'app.js'],
]) {
  if (html.split(marker).length !== 2)
    throw new Error('Missing or duplicate build marker ' + marker);
  const source = read(file);
  if (/<\/script/i.test(source))
    throw new Error('Unexpected script close in ' + file);
  html = html.replace(marker, () => source);
}
// Embed the recording for each sound slot that has one in src/sounds. A slot
// with no file keeps the game's built-in sound, or silence.
const SOUND_SLOTS = ['pop', 'blue', 'coral', 'pale'],
  soundDir = path.join(root, 'src', 'sounds'),
  sounds = {};
if (fs.existsSync(soundDir))
  for (const file of fs.readdirSync(soundDir).sort()) {
    if (file.startsWith('.')) continue;
    const slot = path.parse(file).name;
    if (!SOUND_SLOTS.includes(slot) || path.extname(file) !== '.mp3')
      throw new Error(
        `Unexpected file src/sounds/${file}. Use ${SOUND_SLOTS.map((s) => s + '.mp3').join(', ')}`,
      );
    const recording = fs.readFileSync(path.join(soundDir, file));
    if (recording.length > 100 * 1024)
      throw new Error(`src/sounds/${file} is over 100 KB. Trim it first`);
    sounds[slot] = recording.toString('base64');
  }
if (html.split('/* GAME_SOUNDS */').length !== 2)
  throw new Error('Missing or duplicate sounds marker');
html = html.replace(
  '/* GAME_SOUNDS */',
  () => 'window.BleileSounds = ' + JSON.stringify(sounds) + ';',
);
if (/<(?:script|link)[^>]+(?:src|href)=/i.test(html))
  throw new Error('External runtime dependency found');
const output = path.join(root, 'Bleile-in-the-Light.html');
fs.writeFileSync(output, html, 'utf8');
fs.writeFileSync(path.join(root, 'index.html'), html, 'utf8');
console.log(
  `Built ${output} (${Math.round(Buffer.byteLength(html) / 1024)} KB), with all code and artwork embedded.`,
);
