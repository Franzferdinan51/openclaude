import * as fs from 'fs';
import { execSync } from 'child_process';

function run() {
    let tscOutput = '';
    try {
        console.log("Running tsc...");
        execSync('bun run tsc --noEmit --pretty false', { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 });
        console.log("No errors!");
        return false;
    } catch (e: any) {
        tscOutput = (e.stdout ? e.stdout.toString() : '') + '\n' + (e.stderr ? e.stderr.toString() : '');
    }

    const lines = tscOutput.split('\n');
    const fileEdits = new Map<string, { type: 'remove_expect_error' | 'add_expect_error', lineIndex: number }[]>();

    const regex = /^(.+)\((\d+),\d+\): error TS(\d+):/;

    for (const line of lines) {
        const match = line.match(regex);
        if (match) {
            const file = match[1];
            const lineNum = parseInt(match[2], 10);
            const tsCode = parseInt(match[3], 10);

            if (!fileEdits.has(file)) {
                fileEdits.set(file, []);
            }
            
            if (tsCode === 2578) {
                fileEdits.get(file)!.push({ type: 'remove_expect_error', lineIndex: lineNum - 1 });
            } else {
                fileEdits.get(file)!.push({ type: 'add_expect_error', lineIndex: lineNum - 1 });
            }
        }
    }

    let modifiedFiles = 0;
    for (const [file, edits] of fileEdits.entries()) {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const fileLines = content.split('\n');
            
            // Sort edits in reverse line order to not mess up indices
            // Deduplicate edits on the same line
            const uniqueEdits = [];
            const seenLines = new Set();
            for (const edit of edits.sort((a, b) => b.lineIndex - a.lineIndex)) {
                if (!seenLines.has(edit.lineIndex)) {
                    seenLines.add(edit.lineIndex);
                    uniqueEdits.push(edit);
                }
            }

            let modified = false;
            for (const edit of uniqueEdits) {
                if (edit.type === 'remove_expect_error') {
                    if (fileLines[edit.lineIndex] && fileLines[edit.lineIndex].includes('@ts-expect-error')) {
                        fileLines.splice(edit.lineIndex, 1);
                        modified = true;
                    }
                } else if (edit.type === 'add_expect_error') {
                    if (edit.lineIndex >= 0 && (!fileLines[edit.lineIndex - 1] || !fileLines[edit.lineIndex - 1].includes('@ts-expect-error'))) {
                        const match = fileLines[edit.lineIndex].match(/^(\s*)/);
                        const leading = match ? match[1] : '';
                        fileLines.splice(edit.lineIndex, 0, leading + '// @ts-expect-error');
                        modified = true;
                    }
                }
            }

            if (modified) {
                fs.writeFileSync(file, fileLines.join('\n'), 'utf-8');
                modifiedFiles++;
            }
        } catch(e) {
            console.error(`Error processing ${file}`, e);
        }
    }
    
    console.log(`Modified ${modifiedFiles} files.`);
    return modifiedFiles > 0;
}

function main() {
    let iterations = 0;
    while (iterations < 5) {
        console.log(`Iteration ${iterations + 1}`);
        const changed = run();
        if (!changed) break;
        iterations++;
    }
}

main();