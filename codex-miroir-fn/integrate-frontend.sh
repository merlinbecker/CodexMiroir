#!/bin/bash

# Integration script for building and copying frontend to Azure Function
echo "🚀 CodexMiroir - Frontend Integration Script"
echo "==========================================="

# Check if we're in the right directory
if [ ! -f "../package.json" ]; then
    echo "❌ Error: Please run this script from the codex-miroir-fn directory"
    exit 1
fi

# Step 1: Build the frontend
echo "📦 Step 1: Building frontend..."
cd ..
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi

# Step 2: Copy assets to function directory
echo "📋 Step 2: Copying assets to Azure Function..."
cd codex-miroir-fn

# Remove old assets
rm -rf assets/ index.html manifest.json sw.js

# Copy new assets
cp -r ../dist/public/* .

if [ $? -ne 0 ]; then
    echo "❌ Failed to copy assets!"
    exit 1
fi

# Step 3: Verify setup
echo "🔍 Step 3: Verifying setup..."
node verify-setup.js

if [ $? -ne 0 ]; then
    echo "❌ Setup verification failed!"
    exit 1
fi

# Step 4: Test static serving
echo "🧪 Step 4: Testing static file serving..."
node test-static.js

if [ $? -ne 0 ]; then
    echo "❌ Static serving test failed!"
    exit 1
fi

echo ""
echo "✅ Integration complete!"
echo ""
echo "Next steps:"
echo "1. Deploy to Azure: func azure functionapp publish codex-miroir-fn"
echo "2. Configure environment variables (AZURE_BLOB_CONN, API_KEY)"
echo "3. Access your app at: https://your-function-app.azurewebsites.net/"
echo ""
echo "Frontend will be served at: /"
echo "API will be available at: /api/codex"