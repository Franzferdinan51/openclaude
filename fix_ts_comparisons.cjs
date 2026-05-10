const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("Running tsc to find TS2367 errors...");
let tscOutput = '';
try {
  tscOutput = execSync('bun run tsc --noEmit', { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 });
} catch (e) {
  tscOutput = e.stdout || '';
}

const lines = tscOutput.split('\n');

for (const line of lines) {
  // src/main.tsx(4587,11): error TS2367: This comparison appears to be unintentional because the types '"external"' and '"ant"' have no overlap.
  const match = line.match(/^(src\/.*?\.tsx?)\(\d+,\d+\): error TS2367: This comparison appears to be unintentional because the types '"([^']+)"' and '"([^']+)"' have no overlap\./);
  if (match) {
    const file = match[1];
    const val1 = match[2];
    const val2 = match[3];
    
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf-8');
      
      // Look for `"val1" === 'val2'` or `'val1' === 'val2'` or `"val1" === "val2"` etc.
      // Since it could be formatted differently, let's use a regex
      const re1 = new RegExp(`"${val1}"\\s*===\\s*'${val2}'`, 'g');
      const re2 = new RegExp(`'${val1}'\\s*===\\s*'${val2}'`, 'g');
      const re3 = new RegExp(`"${val1}"\\s*===\\s*"${val2}"`, 'g');
      const re4 = new RegExp(`'${val1}'\\s*===\\s*"${val2}"`, 'g');
      
      // Also reverse
      const re5 = new RegExp(`"${val2}"\\s*===\\s*'${val1}'`, 'g');
      const re6 = new RegExp(`'${val2}'\\s*===\\s*'${val1}'`, 'g');
      const re7 = new RegExp(`"${val2}"\\s*===\\s*"${val1}"`, 'g');
      const re8 = new RegExp(`'${val2}'\\s*===\\s*"${val1}"`, 'g');

      let modified = content
        .replace(re1, 'false')
        .replace(re2, 'false')
        .replace(re3, 'false')
        .replace(re4, 'false')
        .replace(re5, 'false')
        .replace(re6, 'false')
        .replace(re7, 'false')
        .replace(re8, 'false');

      // What about !== ?
      const re9 = new RegExp(`"${val1}"\\s*!==\\s*'${val2}'`, 'g');
      const re10 = new RegExp(`'${val1}'\\s*!==\\s*'${val2}'`, 'g');
      const re11 = new RegExp(`"${val1}"\\s*!==\\s*"${val2}"`, 'g');
      const re12 = new RegExp(`'${val1}'\\s*!==\\s*"${val2}"`, 'g');
      
      const re13 = new RegExp(`"${val2}"\\s*!==\\s*'${val1}'`, 'g');
      const re14 = new RegExp(`'${val2}'\\s*!==\\s*'${val1}'`, 'g');
      const re15 = new RegExp(`"${val2}"\\s*!==\\s*"${val1}"`, 'g');
      const re16 = new RegExp(`'${val2}'\\s*!==\\s*"${val1}"`, 'g');
      
      modified = modified
        .replace(re9, 'true')
        .replace(re10, 'true')
        .replace(re11, 'true')
        .replace(re12, 'true')
        .replace(re13, 'true')
        .replace(re14, 'true')
        .replace(re15, 'true')
        .replace(re16, 'true');
        
      if (modified !== content) {
        fs.writeFileSync(file, modified, 'utf-8');
        console.log(`Fixed overlap comparison in ${file}`);
      } else {
        console.log(`Failed to match exact string for ${file} with ${val1} and ${val2}`);
        // fallback regex for generic replacement
        // Just cast the left side to String to force typescript to accept it:
        // `String("external") === 'ant'`
        modified = content.replace(new RegExp(`"${val1}"`, 'g'), `String("${val1}")`);
        if (modified !== content) {
           fs.writeFileSync(file, modified, 'utf-8');
           console.log(`Applied String() cast for ${file}`);
        }
      }
    }
  }
}
console.log("Done fixing TS2367.");
