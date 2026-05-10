const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Template for a robust stub that acts as both object and function
const STUB_HEADER = `
const _stub: any = new Proxy(() => ({}), { 
  get: (target, prop) => {
    if (prop === 'then') return undefined;
    if (typeof prop === 'symbol' || prop === 'toString' || prop === 'valueOf') return target[prop];
    return _stub;
  },
  apply: () => ({})
});
export default _stub;
export const __stub = true;
`;

// Find all .ts and .tsx files in src that contain "any = undefined" OR "export default null"
const files = execSync('grep -lE "any = undefined|export default null" src/**/*.ts src/**/*.tsx', { encoding: 'utf-8' }).split('\n').filter(Boolean);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  console.log(`Fixing potential stub in ${file}`);
  
  const namedExports = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^export (?:const|type) (\w+): any =/);
    if (match) {
      namedExports.push(match[1]);
    }
  }
  
  let newContent = STUB_HEADER;
  for (const name of namedExports) {
    newContent += `export const ${name}: any = _stub;\n`;
  }
  fs.writeFileSync(file, newContent, 'utf-8');
}
console.log("All potential stubs updated.");
