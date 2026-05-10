import { Project } from "ts-morph";
import * as fs from "fs";

async function main() {
    const project = new Project({
        tsConfigFilePath: "tsconfig.json",
    });

    const diagnostics = project.getPreEmitDiagnostics();
    console.log(`Found ${diagnostics.length} diagnostics.`);

    const diagnosticsByFile = new Map<string, number[]>();
    for (const diagnostic of diagnostics) {
        const sourceFile = diagnostic.getSourceFile();
        const line = diagnostic.getLineNumber();
        if (sourceFile && line) {
            const filePath = sourceFile.getFilePath();
            if (!diagnosticsByFile.has(filePath)) {
                diagnosticsByFile.set(filePath, []);
            }
            diagnosticsByFile.get(filePath)!.push(line);
        }
    }

    let modifiedFiles = 0;
    for (const [filePath, lineNumbers] of diagnosticsByFile.entries()) {
        const sourceFile = project.getSourceFile(filePath);
        if (!sourceFile) continue;

        // Deduplicate line numbers and sort descending
        const uniqueLines = Array.from(new Set(lineNumbers)).sort((a, b) => b - a);
        let modified = false;

        const fullText = sourceFile.getFullText();
        const lines = fullText.split('\n');

        for (const line of uniqueLines) {
            const lineIndex = line - 1;
            
            // Check if there is already a comment
            if (lineIndex >= 0) {
                const prevLine = lineIndex > 0 ? lines[lineIndex - 1] : '';
                if (!prevLine.includes('@ts-expect-error') && !prevLine.includes('@ts-ignore')) {
                    const match = lines[lineIndex].match(/^(\s*)/);
                    const leadingWhitespace = match ? match[1] : '';
                    lines.splice(lineIndex, 0, leadingWhitespace + '// @ts-expect-error');
                    modified = true;
                }
            }
        }

        if (modified) {
            fs.writeFileSync(filePath, lines.join('\n'));
            modifiedFiles++;
        }
    }

    console.log(`Modified ${modifiedFiles} files.`);
}

main().catch(console.error);