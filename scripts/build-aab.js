const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { updateVersion } = require('./version.js');
const { syncVersion } = require('./sync-version.js');

async function buildAAB(versionType = 'patch', skipVersionUpdate = false, forceClean = false, runPrebuild = false) {
  console.log('🚀 Starting Android App Bundle build...');
  
  try {
    // Step 1: Update version (unless skipped)
    let versionInfo;
    if (!skipVersionUpdate) {
      console.log('📱 Updating version...');
      versionInfo = updateVersion(versionType);
    }
    
    // Step 1.5: Sync version to gradle.properties
    console.log('🔄 Syncing version to gradle.properties...');
    syncVersion();
    
    // Step 2: Prebuild (ensure native dependencies are linked)
    if (runPrebuild) {
      console.log('🔧 Running prebuild...');
      // No --clean flag to preserve your custom gradle configurations
      execSync('npx expo prebuild --platform android', { stdio: 'inherit' });
    }
    
    // Step 3: Clean if forced (optional)
    if (forceClean) {
      console.log('🧹 Force cleaning previous builds...');
      process.chdir(path.join(__dirname, '../android'));
      execSync('gradlew clean', { stdio: 'inherit' });
      process.chdir(path.join(__dirname, '..'));
    }
    
    // Step 4: Build the AAB
    console.log('🔨 Building Android App Bundle...');
    process.chdir(path.join(__dirname, '../android'));
    execSync('gradlew bundleRelease', { stdio: 'inherit' });
    process.chdir(path.join(__dirname, '..'));
    
    // Step 4: Check if build was successful
    const aabPath = path.join(__dirname, '../android/app/build/outputs/bundle/release/app-release.aab');
    if (fs.existsSync(aabPath)) {
      const stats = fs.statSync(aabPath);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log('\n✅ Build completed successfully!');
      console.log(`📦 AAB file: ${aabPath}`);
      console.log(`📏 File size: ${fileSizeInMB} MB`);
      
      if (versionInfo) {
        console.log(`🏷️  Version: ${versionInfo.version} (${versionInfo.versionCode})`);
      }
      
      console.log('\n🎉 Ready for Google Play Store upload!');
      
      // Copy to a more accessible location
      const outputDir = path.join(__dirname, '../builds');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, `taxifairmock-${versionInfo?.version || 'unknown'}.aab`);
      fs.copyFileSync(aabPath, outputPath);
      console.log(`📁 Also saved to: ${outputPath}`);
      
    } else {
      throw new Error('AAB file not found after build');
    }
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
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
    console.error('  --force-clean     Force clean before build (use with caution)');
    console.error('  --prebuild        Run expo prebuild before building');
    process.exit(1);
  }
  
  buildAAB(versionType, skipVersionUpdate, forceClean, runPrebuild);
}

module.exports = { buildAAB }; 