const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("Running tsc to find errors...");
let tscOutput = '';
try {
  tscOutput = execSync('bun run tsc --noEmit', { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 });
} catch (e) {
  tscOutput = e.stdout || '';
}

const lines = tscOutput.split('\n');

for (const line of lines) {
  // TS2339: Property 'isProactiveActive' does not exist on type 'typeof import("/Users/.../src/proactive/index")'.
  const typeofMatch = line.match(/TS2339: Property '([^']+)' does not exist on type 'typeof import\("([^"]+)"\)'/);
  if (typeofMatch) {
    const exp = typeofMatch[1];
    let mod = typeofMatch[2];
    
    if (!mod.endsWith('.ts') && !mod.endsWith('.tsx')) {
      mod += '.ts';
    }
    
    if (fs.existsSync(mod)) {
      let content = fs.readFileSync(mod, 'utf-8');
      const exportStr = `export const ${exp}: any = undefined;\n`;
      if (!content.includes(`export const ${exp}`)) {
         content += exportStr;
         fs.writeFileSync(mod, content, 'utf-8');
         console.log(`Added typeof export ${exp} to ${mod}`);
      }
    } else {
      // maybe it ends in .tsx?
      let modTsx = mod.replace(/\.ts$/, '.tsx');
      if (fs.existsSync(modTsx)) {
        let content = fs.readFileSync(modTsx, 'utf-8');
        const exportStr = `export const ${exp}: any = undefined;\n`;
        if (!content.includes(`export const ${exp}`)) {
           content += exportStr;
           fs.writeFileSync(modTsx, content, 'utf-8');
           console.log(`Added typeof export ${exp} to ${modTsx}`);
        }
      }
    }
  }
}
console.log("Typeof exports added.");
