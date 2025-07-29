const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { buildAPK } = require('./build-apk.js');

async function buildAndInstallAPK(versionType = 'patch', skipVersionUpdate = false, forceClean = false, runPrebuild = false) {
  console.log('🚀 Building and preparing APK for installation...');
  
  try {
    // Build the APK
    await buildAPK(versionType, skipVersionUpdate, forceClean, runPrebuild);
    
    // Find the APK file
    const apkPath = path.join(__dirname, '../android/app/build/outputs/apk/release/app-release.apk');
    const buildsDir = path.join(__dirname, '../builds');
    const apkFiles = fs.readdirSync(buildsDir).filter(file => file.endsWith('.apk'));
    
    if (apkFiles.length === 0) {
      throw new Error('No APK files found in builds directory');
    }
    
    const latestApk = apkFiles.sort().reverse()[0]; // Get the most recent APK
    const apkFilePath = path.join(buildsDir, latestApk);
    
    console.log('\n📱 APK Build Complete!');
    console.log(`📦 APK file: ${apkFilePath}`);
    
    // Check if adb is available
    try {
      execSync('adb version', { stdio: 'pipe' });
      console.log('\n🔧 ADB detected. You can install the APK using:');
      console.log(`adb install "${apkFilePath}"`);
      
      // Ask if user wants to install directly
      console.log('\n💡 To avoid permission issues:');
      console.log('1. Uninstall the old app completely from your device');
      console.log('2. Install the new APK');
      console.log('3. Grant permissions when prompted');
      
    } catch (error) {
      console.log('\n💡 Installation Instructions:');
      console.log('1. Transfer the APK to your Android device');
      console.log('2. Uninstall the old app completely from your device');
      console.log('3. Install the new APK from your device');
      console.log('4. Grant permissions when prompted');
      console.log('\n⚠️  IMPORTANT: Uninstalling the old app is necessary because');
      console.log('   the new keystore makes Android treat this as a different app.');
    }
    
    console.log('\n✅ Ready for installation!');
    
  } catch (error) {
    console.error('❌ Build and install preparation failed:', error.message);
    process.exit(1);
  }
}

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const versionType = args[0] || 'patch';
  const skipVersionUpdate = args.includes('--skip-version');
  const forceClean = args.includes('--force-clean');
  const runPrebuild = args.includes('--prebuild');
  
  if (!['major', 'minor', 'patch'].includes(versionType)) {
    console.error('❌ Invalid version type. Use: major, minor, or patch');
    console.error('Available options:');
    console.error('  --skip-version    Skip version update');
    console.error('  --force-clean     Force clean before build');
    console.error('  --prebuild        Run expo prebuild before building');
    process.exit(1);
  }
  
  buildAndInstallAPK(versionType, skipVersionUpdate, forceClean, runPrebuild);
}

module.exports = { buildAndInstallAPK }; 