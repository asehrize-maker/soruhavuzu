import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = path.resolve(__dirname, 'src');

function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        const match = line.match(/import.*from\s+['"](.*)['"]/);
        if (match) {
            let importPath = match[1];
            if (importPath.startsWith('.')) {
                let absPath = path.resolve(path.dirname(filePath), importPath);
                if (!fs.existsSync(absPath)) {
                    console.error(`Missing import in ${filePath}:${index + 1} -> ${importPath} (Resolved to ${absPath})`);
                }
            }
        }
    });
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.js')) {
            checkFile(fullPath);
        }
    });
}

walkDir(baseDir);
checkFile(path.resolve(__dirname, 'server.js'));
console.log('Checks complete.');
