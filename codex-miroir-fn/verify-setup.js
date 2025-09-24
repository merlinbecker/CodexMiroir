#!/usr/bin/env node
// Quick test to verify our setup works

const fs = require('fs');
const path = require('path');

console.log('Testing Azure Function setup...');

// Test 1: Check file structure
console.log('\n1. Checking file structure:');
const requiredFiles = [
  'host.json',
  'package.json',
  'codex/function.json',
  'codex/index.js',
  'static/function.json', 
  'static/index.js',
  'index.html',
  'assets'
];

for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`   ${exists ? '✓' : '✗'} ${file}`);
}

// Test 2: Check if static assets are present
console.log('\n2. Checking static assets:');
const staticFiles = ['index.html', 'manifest.json', 'sw.js'];
for (const file of staticFiles) {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`   ${exists ? '✓' : '✗'} ${file}`);
}

// Test 3: Verify host.json configuration
console.log('\n3. Checking host.json configuration:');
try {
  const hostConfig = JSON.parse(fs.readFileSync('host.json', 'utf8'));
  console.log(`   ✓ Route prefix: "${hostConfig.extensions.http.routePrefix}"`);
  console.log(`   ✓ Function timeout: ${hostConfig.functionTimeout}`);
} catch (error) {
  console.log(`   ✗ Error reading host.json: ${error.message}`);
}

// Test 4: Check function routes
console.log('\n4. Checking function routes:');
try {
  const codexConfig = JSON.parse(fs.readFileSync('codex/function.json', 'utf8'));
  const staticConfig = JSON.parse(fs.readFileSync('static/function.json', 'utf8'));
  console.log(`   ✓ Codex API route: ${codexConfig.bindings[0].route}`);
  console.log(`   ✓ Static route: ${staticConfig.bindings[0].route}`);
} catch (error) {
  console.log(`   ✗ Error reading function configs: ${error.message}`);
}

console.log('\n✅ Setup verification complete!');