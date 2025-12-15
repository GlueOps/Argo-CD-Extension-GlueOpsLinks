#!/bin/bash
set -e

echo "🔨 Building ArgoCD Extension"
echo ""

# Check prerequisites
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js and npm."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "extension/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd extension
    npm install
    cd ..
fi

# Build extension
echo "🔨 Building extension with webpack..."
cd extension
npm run build
cd ..

# Package extension with proper structure
echo "📦 Packaging extension..."
rm -rf resources
mkdir -p resources/glueops-links-extension
cp extension/dist/extensions.js resources/glueops-links-extension/extensions.js
tar -czf extension.tar.gz resources/
rm -rf resources

echo ""
echo "✅ Build complete!"
echo "   Output: extension.tar.gz"
echo ""
echo "Archive contents:"
tar -tzf extension.tar.gz
echo ""
echo "To release:"
echo "  1. Update version in extension/package.json and helm-values.yaml"
echo "  2. Run: ./build.sh"
echo "  3. Run: git add -A && git commit -m 'vX.X.X: Description'"
echo "  4. Run: git tag vX.X.X && git push && git push --tags"
echo "  5. Run: gh release create vX.X.X extension.tar.gz --title 'vX.X.X' --notes 'Description'"
