const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("Running tsc to find missing modules...");
let tscOutput = '';
try {
  tscOutput = execSync('bun run tsc --noEmit', { encoding: 'utf-8' });
} catch (e) {
  tscOutput = e.stdout || '';
}

const lines = tscOutput.split('\n');
const missingMap = new Map();

for (const line of lines) {
  // Format: src/utils/worktree.ts(668,17): error TS2307: Cannot find module './postCommitAttribution.js'
  const match = line.match(/^(src\/.*?\.tsx?)\(\d+,\d+\): error TS2307: Cannot find module '([^']+)'/);
  if (match) {
    const file = match[1];
    const mod = match[2];
    if (mod.startsWith('.')) {
      let resolved = path.resolve(path.dirname(file), mod);
      // If it ends with .js, replace with .ts
      if (resolved.endsWith('.js')) {
        resolved = resolved.replace(/\.js$/, '.ts');
      } else {
        resolved = resolved + '.ts';
      }
      missingMap.set(resolved, true);
    }
  }
}

for (const missingFile of missingMap.keys()) {
  if (!fs.existsSync(missingFile)) {
    console.log("Creating stub for", missingFile);
    fs.mkdirSync(path.dirname(missingFile), { recursive: true });
    // A generic stub that exports a proxy or just any to satisfy TS
    const code = `
const _stub: any = new Proxy({}, { get: () => () => ({} as any) });
export default _stub;
export const __stub = true;
`;
    fs.writeFileSync(missingFile, code, 'utf-8');
  }
}

console.log("Stubs created.");
