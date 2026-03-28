const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'node_modules', 'lucide-static', 'icons');

function loadSvg(name, size = 16) {
  const file = path.join(iconsDir, `${name}.svg`);
  let svg = fs.readFileSync(file, 'utf-8');
  svg = svg.replace(/<!--[\s\S]*?-->\n?/, '');
  svg = svg.replace(/width="24"/, `width="${size}"`);
  svg = svg.replace(/height="24"/, `height="${size}"`);
  return svg;
}

module.exports = {
  chevronDown: loadSvg('chevron-down', 14),
  chevronRight: loadSvg('chevron-right', 14),
  plus: loadSvg('plus', 14),
  x: loadSvg('x', 14),
  square: loadSvg('square', 13),
  pencil: loadSvg('pencil', 13),
  settings: loadSvg('settings', 15),
  helpCircle: loadSvg('help-circle', 15),
  info: loadSvg('info', 15),
  folderOpen: loadSvg('folder-open', 15),
  terminal: loadSvg('terminal', 20),
  trash2: loadSvg('trash-2', 13),
  circleStop: loadSvg('circle-stop', 14),
};
