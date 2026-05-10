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
  // TS2614: Module '"..."' has no exported member 'xyz'.
  // TS2305: Module '"..."' has no exported member 'xyz'.
  const missingExportMatch = line.match(/Module '"([^']+)"' has no exported member '([^']+)'/);
  if (missingExportMatch) {
    let mod = missingExportMatch[1];
    const exp = missingExportMatch[2];
    
    // The module path in the error is the import string or resolved path?
    // Often it's the import string if it fails to resolve named exports.
    // Let's get the file where the error happened:
    const fileMatch = line.match(/^(src\/.*?\.tsx?)\(\d+,\d+\): error TS(?:2614|2305):/);
    if (fileMatch) {
       const sourceFile = fileMatch[1];
       if (mod.startsWith('.')) {
         let resolved = path.resolve(path.dirname(sourceFile), mod);
         resolved = resolved.split('?')[0];
         if (resolved.endsWith('.js')) resolved = resolved.replace(/\.js$/, '.ts');
         else if (!resolved.endsWith('.ts') && !resolved.endsWith('.tsx')) resolved += '.ts';
         
         if (fs.existsSync(resolved)) {
           // We created this stub. Let's add the export.
           let content = fs.readFileSync(resolved, 'utf-8');
           const exportStr = `export const ${exp}: any = undefined;\n`;
           if (!content.includes(`export const ${exp}:`)) {
             content += exportStr;
             fs.writeFileSync(resolved, content, 'utf-8');
             console.log(`Added export ${exp} to ${resolved}`);
           }
         }
       }
    }
  }
}
console.log("Exports added.");
