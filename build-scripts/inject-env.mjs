import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mode = process.argv[2] || 'development';
const envFile = mode === 'production' ? '.env.production' : '.env.development';
const envPath = path.resolve(__dirname, '..', envFile);
const targetFile = path.resolve(__dirname, '..', 'src', 'config', 'environment.mjs');

console.log(`\n📦 Injecting environment variables for ${mode} mode...`);
console.log(`📄 Reading from: ${envFile}`);

// Read .env file
if (!fs.existsSync(envPath)) {
  console.error(`❌ Error: ${envFile} not found at ${envPath}`);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};

envContent.split(/\r?\n/).forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  
  const equalIndex = line.indexOf('=');
  if (equalIndex > 0) {
    const key = line.substring(0, equalIndex).trim();
    let value = line.substring(equalIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
});

console.log(`✅ Loaded environment variables:`);
console.log(`   VITE_API_BASE_URL: ${env.VITE_API_BASE_URL}`);
console.log(`   VITE_ENVIRONMENT: ${env.VITE_ENVIRONMENT}`);
console.log(`   VITE_APP_VERSION: ${env.VITE_APP_VERSION}`);
console.log(`   VITE_PRODUCT_NAME: ${env.VITE_PRODUCT_NAME}`);

// Read the environment.mjs file
let envFileContent = fs.readFileSync(targetFile, 'utf8');

// Replace string values with actual environment values
// Simpler regex that matches quoted strings
envFileContent = envFileContent.replace(/VITE_API_BASE_URL:\s*'[^']*'/g, `VITE_API_BASE_URL: '${env.VITE_API_BASE_URL || ''}'`);
envFileContent = envFileContent.replace(/VITE_ENVIRONMENT:\s*'[^']*'/g, `VITE_ENVIRONMENT: '${env.VITE_ENVIRONMENT || ''}'`);
envFileContent = envFileContent.replace(/VITE_APP_VERSION:\s*'[^']*'/g, `VITE_APP_VERSION: '${env.VITE_APP_VERSION || ''}'`);
envFileContent = envFileContent.replace(/VITE_PRODUCT_NAME:\s*'[^']*'/g, `VITE_PRODUCT_NAME: '${env.VITE_PRODUCT_NAME || ''}'`);

// Write back
fs.writeFileSync(targetFile, envFileContent, 'utf8');

console.log(`✅ Environment variables injected into environment.mjs`);
console.log(`🚀 Ready to build!\n`);
