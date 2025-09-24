// Test static file serving logic
const staticHandler = require('./static/index.js');

// Mock context
const createMockContext = () => ({
  log: console.log,
  res: null
});

// Test cases
async function runTests() {
  console.log('Testing static file serving...\n');

  // Test 1: Root path should serve index.html
  console.log('Test 1: Root path (/) -> index.html');
  const context1 = createMockContext();
  const req1 = { url: '/', params: { path: '' } };
  await staticHandler(context1, req1);
  console.log(`Status: ${context1.res.status}, Content-Type: ${context1.res.headers['Content-Type']}`);
  console.log(`Is HTML: ${context1.res.headers['Content-Type'].includes('text/html')}\n`);

  // Test 2: CSS file
  console.log('Test 2: CSS asset');
  const context2 = createMockContext();
  const req2 = { url: '/assets/index-B5Mxc1fT.css', params: { path: 'assets/index-B5Mxc1fT.css' } };
  await staticHandler(context2, req2);
  console.log(`Status: ${context2.res.status}, Content-Type: ${context2.res.headers['Content-Type']}\n`);

  // Test 3: JS file
  console.log('Test 3: JavaScript asset');
  const context3 = createMockContext();
  const req3 = { url: '/assets/index-BRPh6qcI.js', params: { path: 'assets/index-BRPh6qcI.js' } };
  await staticHandler(context3, req3);
  console.log(`Status: ${context3.res.status}, Content-Type: ${context3.res.headers['Content-Type']}\n`);

  // Test 4: API route (should return 404)
  console.log('Test 4: API route (should be 404 - handled by other function)');
  const context4 = createMockContext();
  const req4 = { url: '/api/codex', params: { path: 'api/codex' } };
  await staticHandler(context4, req4);
  console.log(`Status: ${context4.res.status}\n`);

  // Test 5: SPA route (should fallback to index.html)
  console.log('Test 5: SPA route /voice-codex (should fallback to index.html)');
  const context5 = createMockContext();
  const req5 = { url: '/voice-codex', params: { path: 'voice-codex' } };
  await staticHandler(context5, req5);
  console.log(`Status: ${context5.res.status}, Content-Type: ${context5.res.headers['Content-Type']}\n`);

  console.log('✅ Static file serving tests complete!');
}

runTests().catch(console.error);