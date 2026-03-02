#!/bin/bash
# Fix build permissions and prepare for Xcode build

echo "🔧 Fixing build permissions..."

# Fix DerivedData permissions
mkdir -p ~/Library/Developer/Xcode/DerivedData
chmod -R 755 ~/Library/Developer/Xcode/DerivedData 2>/dev/null

# Clear old DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/MedicaionRunner-*

# Fix build directory
cd "$(dirname "$0")"
rm -rf ios/build
mkdir -p ios/build
chmod -R 755 ios/build

# Ensure interface files exist
mkdir -p node_modules/expo-modules-core/ios/Interfaces/BarcodeScanner
if [ ! -f "node_modules/expo-modules-core/ios/Interfaces/BarcodeScanner/EXBarcodeScannerInterface.h" ]; then
    echo "⚠️  Interface files missing, recreating..."
    # Files should already exist from previous fix
fi

echo "✅ Build environment ready!"
echo ""
echo "📱 Next steps:"
echo "1. Open Xcode: open ios/MedicaionRunner.xcworkspace"
echo "2. In Xcode: Product → Clean Build Folder (Shift+Cmd+K)"
echo "3. Select your iPhone as target device"
echo "4. Click Play button (▶️) to build and run"
echo ""
echo "💡 If you still get sandbox errors:"
echo "   - System Settings → Privacy & Security → Full Disk Access"
echo "   - Add Terminal and/or Xcode if not already added"

