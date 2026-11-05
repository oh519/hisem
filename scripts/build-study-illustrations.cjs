// Build the static endpoint from the actual complete animation objects.
// This keeps desktop assembly, the final illustration and mobile art identical.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'study-layers.js'), 'utf8'), context);
const material = context.window.HISEM_STUDY_LAYERS.materials;
const defs = new Map();
const bodies = [...material.layers].sort((a,b) => a.z-b.z).map(layer => {
  if (!layer.src.startsWith('data:image/svg+xml;') || layer.mask || layer.clip) throw Error('Use complete vector objects');
  let markup = decodeURIComponent(layer.src.slice(layer.src.indexOf(',')+1));
  markup = markup.replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>$/, '');
  return markup.replace(/<defs>([\s\S]*?)<\/defs>/g, (_, value) => { defs.set(value, value); return ''; });
});
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+material.width+'" height="'+material.height+'" viewBox="0 0 '+material.width+' '+material.height+'"><defs>'+[...defs.values()].join('')+'</defs>'+bodies.join('')+'</svg>\n';
fs.writeFileSync(path.join(root, material.baseSrc), svg);
console.log('Built silicon illustration from '+material.layers.length+' complete objects.');
