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
  // TS2749: 'X' refers to a value, but is being used as a type here. Did you mean 'typeof X'?
  const typeRefMatch = line.match(/error TS2749: '([^']+)' refers to a value, but is being used as a type here/);
  if (typeRefMatch) {
    const exp = typeRefMatch[1];
    const fileMatch = line.match(/^(src\/.*?\.tsx?)\(\d+,\d+\): error TS2749:/);
    if (fileMatch) {
       const sourceFile = fileMatch[1];
       // We need to figure out which module exported it, or just add the type to the missing stub if we know it.
       // Actually, the error might happen in the file that imported it. Let's just find where it's imported in the sourceFile.
       const content = fs.readFileSync(sourceFile, 'utf-8');
       const importMatch = content.match(new RegExp(`import\\s+.*?(?:{|\\b)${exp}\\b.*?from\\s+['"]([^'"]+)['"]`));
       if (importMatch) {
         let mod = importMatch[1];
         if (mod.startsWith('.')) {
           let resolved = path.resolve(path.dirname(sourceFile), mod);
           resolved = resolved.split('?')[0];
           if (resolved.endsWith('.js')) resolved = resolved.replace(/\.js$/, '.ts');
           else if (!resolved.endsWith('.ts') && !resolved.endsWith('.tsx')) resolved += '.ts';
           
           if (fs.existsSync(resolved)) {
             let stubContent = fs.readFileSync(resolved, 'utf-8');
             const exportTypeStr = `export type ${exp} = any;\n`;
             if (!stubContent.includes(`export type ${exp}`)) {
               stubContent += exportTypeStr;
               fs.writeFileSync(resolved, stubContent, 'utf-8');
               console.log(`Added type export ${exp} to ${resolved}`);
             }
           }
         }
       }
    }
  }
}
console.log("Type exports added.");
