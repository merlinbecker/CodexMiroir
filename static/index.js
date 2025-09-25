const fs = require('fs').promises;
const path = require('path');

// MIME type mapping
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'text/plain';
}

module.exports = async function (context, req) {
  context.log('Static file request:', req.url);
  
  try {
    // Get the requested path
    let requestPath = req.params.path || '';
    
    // Skip API routes - let the codex function handle them
    if (requestPath.startsWith('api/')) {
      context.res = {
        status: 404,
        body: 'Not found - API routes are handled by codex function'
      };
      return;
    }
    
    // Default to index.html for root or paths without file extension (SPA routing)
    if (!requestPath || requestPath === '' || (!path.extname(requestPath) && !requestPath.includes('.'))) {
      requestPath = 'index.html';
    }
    
    // Try multiple locations: frontend first, then assets, then root
    const possiblePaths = [
      path.join(__dirname, '..', 'frontend', requestPath),
      path.join(__dirname, '..', 'assets', requestPath),
      path.join(__dirname, '..', requestPath)
    ];
    
    let filePath = null;
    let fileContent = null;
    
    // Try each path until we find the file
    for (const testPath of possiblePaths) {
      try {
        fileContent = await fs.readFile(testPath);
        filePath = testPath;
        context.log('Serving file from:', testPath);
        break;
      } catch (error) {
        continue; // Try next path
      }
    }
    
    if (fileContent && filePath) {
      const mimeType = getMimeType(filePath);
      
      context.res = {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': mimeType.startsWith('text/html') ? 'no-cache' : 'public, max-age=31536000'
        },
        body: fileContent,
        isRaw: true
      };
    } else {
      // File not found in any location, try to serve index.html from frontend for SPA routing
      if (requestPath !== 'index.html') {
        const frontendIndexPath = path.join(__dirname, '..', 'frontend', 'index.html');
        try {
          const indexContent = await fs.readFile(frontendIndexPath);
          context.res = {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'no-cache'
            },
            body: indexContent,
            isRaw: true
          };
        } catch (indexError) {
          context.res = {
            status: 404,
            headers: { 'Content-Type': 'text/html' },
            body: '<html><body><h1>404 - Frontend not found</h1><p>Please check that the frontend is properly set up.</p></body></html>'
          };
        }
      } else {
        context.res = {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
          body: '<html><body><h1>404 - File not found</h1></body></html>'
        };
      }
    }
    
  } catch (error) {
    context.log('Static file serving error:', error);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
      body: '<html><body><h1>500 - Internal Server Error</h1></body></html>'
    };
  }
};