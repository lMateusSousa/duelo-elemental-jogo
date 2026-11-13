// Gera luta/<id>-anim-data.js com os quadros PNG de assets/<id>_anim/ em base64
// (para o jogo funcionar abrindo o index.html direto, sem servidor).
// Uso: node luta/assets/embutir-anim.js geada brasa
const fs = require('fs'), path = require('path');
const ids = process.argv.slice(2);
if (!ids.length) { console.log('uso: node embutir-anim.js <personagem> [...]'); process.exit(1); }
for (const id of ids) {
  const pasta = path.join(__dirname, `${id}_anim`);
  const anims = {};
  for (const arq of fs.readdirSync(pasta).sort()) {
    const m = arq.match(/^([a-z0-9]+)_(\d+)\.png$/);
    if (!m) continue;
    (anims[m[1]] = anims[m[1]] || [])[+m[2]] = 'data:image/png;base64,' + fs.readFileSync(path.join(pasta, arq)).toString('base64');
  }
  let js = `// Animações de ${id} geradas no PixelLab (assets/${id}_anim/*.png embutidas)\n`;
  js += `var ANIM_DATA = window.ANIM_DATA || {};\nANIM_DATA.${id} = {\n`;
  for (const [nome, quadros] of Object.entries(anims)) {
    js += `  ${nome}: [\n${quadros.filter(Boolean).map((q) => `    '${q}',`).join('\n')}\n  ],\n`;
  }
  js += '};\n';
  const saida = path.join(__dirname, '..', `${id}-anim-data.js`);
  fs.writeFileSync(saida, js);
  console.log('ok', saida, Object.fromEntries(Object.entries(anims).map(([k, v]) => [k, v.filter(Boolean).length])));
}
