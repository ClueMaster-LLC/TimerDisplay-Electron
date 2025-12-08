import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = path.resolve(__dirname, '..', 'src', 'config', 'environment.mjs');

console.log(`\n🔄 Resetting environment.mjs to empty strings...`);

// Read the environment.mjs file
let envFileContent = fs.readFileSync(targetFile, 'utf8');

// Replace any values with empty strings
envFileContent = envFileContent.replace(/VITE_API_BASE_URL:\s*'[^']*'/g, `VITE_API_BASE_URL: ''`);
envFileContent = envFileContent.replace(/VITE_ENVIRONMENT:\s*'[^']*'/g, `VITE_ENVIRONMENT: ''`);
envFileContent = envFileContent.replace(/VITE_APP_VERSION:\s*'[^']*'/g, `VITE_APP_VERSION: ''`);
envFileContent = envFileContent.replace(/VITE_PRODUCT_NAME:\s*'[^']*'/g, `VITE_PRODUCT_NAME: ''`);
envFileContent = envFileContent.replace(/VITE_APP_ID:\s*'[^']*'/g, `VITE_APP_ID: ''`);

// Write back
fs.writeFileSync(targetFile, envFileContent, 'utf8');

console.log(`✅ Environment variables reset to empty strings`);
console.log(`📝 File is now ready to commit to git\n`);
