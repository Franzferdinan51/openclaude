const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("Running tsc to find TS2315 errors...");
let tscOutput = '';
try {
  tscOutput = execSync('bun run tsc --noEmit', { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 });
} catch (e) {
  tscOutput = e.stdout || '';
}

const lines = tscOutput.split('\n');

for (const line of lines) {
  // src/screens/REPL.tsx(4201,52): error TS2315: Type 'ProgressMessage' is not generic.
  const match = line.match(/error TS2315: Type '([^']+)' is not generic\./);
  if (match) {
    const exp = match[1];
    const fileMatch = line.match(/^(src\/.*?\.tsx?)\(\d+,\d+\): error TS2315:/);
    if (fileMatch) {
       const sourceFile = fileMatch[1];
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
             // Replace `export type X = any;` with `export type X<T = any, U = any, V = any, W = any> = any;`
             const re = new RegExp(`export type ${exp} = any;`);
             if (stubContent.match(re)) {
               stubContent = stubContent.replace(re, `export type ${exp}<T = any, U = any, V = any, W = any> = any;`);
               fs.writeFileSync(resolved, stubContent, 'utf-8');
               console.log(`Made type ${exp} generic in ${resolved}`);
             } else {
               // Maybe we need to append it?
               // If it's not exported as a type but as a typeof export:
               // Add it as a generic type.
               if (!stubContent.includes(`export type ${exp}<`)) {
                   stubContent += `\nexport type ${exp}<T = any, U = any, V = any, W = any> = any;\n`;
                   fs.writeFileSync(resolved, stubContent, 'utf-8');
                   console.log(`Added generic type export ${exp} to ${resolved}`);
               }
             }
           }
         }
       }
    }
  }
}
console.log("Generic types fixed.");
