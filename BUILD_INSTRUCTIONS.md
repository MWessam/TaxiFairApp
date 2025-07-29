# Android App Bundle Build Instructions

## Prerequisites

1. **Android Studio** installed with Android SDK
2. **Java JDK** (version 11 or higher)
3. **Gradle** (usually comes with Android Studio)
4. **Mapbox Token** configured in environment

## Version Management

### Current Version
- **Version**: 1.0.0
- **Version Code**: 10

### Version Types
- **Patch**: Bug fixes (1.0.0 → 1.0.1)
- **Minor**: New features (1.0.0 → 1.1.0)
- **Major**: Breaking changes (1.0.0 → 2.0.0)

## Build Commands

### Quick Build (Patch Version)
```bash
npm run build:aab
```

### Specific Version Builds
```bash
# Patch version (bug fixes)
npm run build:aab:patch

# Minor version (new features)
npm run build:aab:minor

# Major version (breaking changes)
npm run build:aab:major
```

### Build Without Version Update
```bash
node ./scripts/build-aab.js patch --skip-version
```

### Manual Version Update
```bash
# Update version only
npm run version:patch
npm run version:minor
npm run version:major

# Set specific version code
npm run version:set 15  # Sets version code to 15
```

## Build Output

The build will create:
1. **AAB file**: `android/app/build/outputs/bundle/release/app-release.aab`
2. **Copy**: `builds/taxifairmock-{version}.aab`

## Google Play Store Upload

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app
3. Go to "Production" → "Create new release"
4. Upload the `.aab` file from the `builds/` folder
5. Add release notes
6. Review and roll out

## Troubleshooting

### Build Fails
1. Clean the project: `cd android && ./gradlew clean`
2. Check Mapbox token is set
3. Ensure all dependencies are installed: `npm install`

### Version Issues
1. Check `app.config.js` has correct version and versionCode
2. Ensure versionCode is always incremented for new releases

### File Size Too Large
- The build uses ABI splitting (armeabi-v7a, arm64-v8a only)
- ProGuard/R8 optimization is enabled
- Resource shrinking is enabled

## Environment Variables

Make sure these are set in your `.env` file:
```
MAPBOX_ACCESS_TOKEN=your_mapbox_token
MAPBOX_DOWNLOADS_TOKEN=your_mapbox_downloads_token
```

## Build Features

✅ **ProGuard/R8 Optimization** - Code obfuscation and optimization
✅ **Resource Shrinking** - Removes unused resources
✅ **ABI Splitting** - Smaller APK sizes per architecture
✅ **PNG Crunching** - Compresses images
✅ **Hermes Engine** - Faster JavaScript execution
✅ **Version Management** - Automatic version incrementing 