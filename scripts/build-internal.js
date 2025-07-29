const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { updateVersion } = require('./version.js');

async function buildInternal(versionType = 'patch', skipVersionUpdate = false, forceClean = false, runPrebuild = false) {
  console.log('🚀 Starting Internal Testing APK build...');
  
  try {
    // Step 1: Update version (unless skipped)
    let versionInfo;
    if (!skipVersionUpdate) {
      console.log('📱 Updating version...');
      versionInfo = updateVersion(versionType);
    }
    
    // Step 2: Prebuild (ensure native dependencies are linked)
    if (runPrebuild) {
      console.log('🔧 Running prebuild...');
      execSync('npx expo prebuild --platform android', { stdio: 'inherit' });
    }
    
    // Step 3: Clean if forced (optional)
    if (forceClean) {
      console.log('🧹 Force cleaning previous builds...');
      process.chdir(path.join(__dirname, '../android'));
      execSync('gradlew clean', { stdio: 'inherit' });
      process.chdir(path.join(__dirname, '..'));
    }
    
    // Step 4: Build the Release APK (no minification for testing)
    console.log('🔨 Building Release APK (no minification for testing)...');
    process.chdir(path.join(__dirname, '../android'));
    execSync('gradlew assembleRelease', { stdio: 'inherit' });
    process.chdir(path.join(__dirname, '..'));
    
    // Step 5: Check if build was successful
    const apkPath = path.join(__dirname, '../android/app/build/outputs/apk/release/app-release.apk');
    if (fs.existsSync(apkPath)) {
      const stats = fs.statSync(apkPath);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log('\n✅ Internal build completed successfully!');
      console.log(`📦 APK file: ${apkPath}`);
      console.log(`📏 File size: ${fileSizeInMB} MB`);
      
      if (versionInfo) {
        console.log(`🏷️  Version: ${versionInfo.version} (${versionInfo.versionCode})`);
      }
      
      console.log('\n🎉 Ready for internal testing!');
      console.log('💡 This build uses your release keystore but without minification');
      console.log('   to avoid permission issues.');
      
      // Copy to a more accessible location
      const outputDir = path.join(__dirname, '../builds');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, `taxifairmock-internal-${versionInfo?.version || 'unknown'}.apk`);
      fs.copyFileSync(apkPath, outputPath);
      console.log(`📁 Also saved to: ${outputPath}`);
      
    } else {
      throw new Error('Internal APK file not found after build');
    }
    
  } catch (error) {
    console.error('❌ Internal build failed:', error.message);
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
  
  buildInternal(versionType, skipVersionUpdate, forceClean, runPrebuild);
}

module.exports = { buildInternal }; 