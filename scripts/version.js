const fs = require('fs');
const path = require('path');

const appConfigPath = path.join(__dirname, '../app.config.js');

function updateVersion(type = 'patch') {
  // Read current app.config.js
  let configContent = fs.readFileSync(appConfigPath, 'utf8');
  
  // Extract current version
  const versionMatch = configContent.match(/"version":\s*"([^"]+)"/);
  const versionCodeMatch = configContent.match(/"versionCode":\s*(\d+)/);
  
  if (!versionMatch || !versionCodeMatch) {
    console.error('❌ Could not find version or versionCode in app.config.js');
    return;
  }
  
  const currentVersion = versionMatch[1];
  const currentVersionCode = parseInt(versionCodeMatch[1]);
  
  console.log(`📱 Current version: ${currentVersion} (${currentVersionCode})`);
  
  // Parse version parts
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  let newVersion;
  let newVersionCode = currentVersionCode + 1; // Always increment by 1
  
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  // Update version in config
  configContent = configContent.replace(
    /"version":\s*"[^"]+"/,
    `"version": "${newVersion}"`
  );
  
  // Update versionCode in config
  configContent = configContent.replace(
    /"versionCode":\s*\d+/,
    `"versionCode": ${newVersionCode}`
  );
  
  // Write back to file
  fs.writeFileSync(appConfigPath, configContent);
  
  console.log(`✅ Updated to version: ${newVersion} (${newVersionCode})`);
  console.log(`📦 Ready for ${type} release!`);
  
  return { version: newVersion, versionCode: newVersionCode };
}

function setVersionCode(versionCode) {
  // Read current app.config.js
  let configContent = fs.readFileSync(appConfigPath, 'utf8');
  
  // Extract current version
  const versionMatch = configContent.match(/"version":\s*"([^"]+)"/);
  const versionCodeMatch = configContent.match(/"versionCode":\s*(\d+)/);
  
  if (!versionMatch || !versionCodeMatch) {
    console.error('❌ Could not find version or versionCode in app.config.js');
    return;
  }
  
  const currentVersion = versionMatch[1];
  const currentVersionCode = parseInt(versionCodeMatch[1]);
  
  console.log(`📱 Current version: ${currentVersion} (${currentVersionCode})`);
  console.log(`🎯 Setting version code to: ${versionCode}`);
  
  // Update versionCode in config
  configContent = configContent.replace(
    /"versionCode":\s*\d+/,
    `"versionCode": ${versionCode}`
  );
  
  // Write back to file
  fs.writeFileSync(appConfigPath, configContent);
  
  console.log(`✅ Updated version code to: ${versionCode}`);
  
  return { version: currentVersion, versionCode: versionCode };
}

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'set') {
    const versionCode = parseInt(args[1]);
    if (isNaN(versionCode)) {
      console.error('❌ Invalid version code. Use: node version.js set <number>');
      process.exit(1);
    }
    setVersionCode(versionCode);
  } else {
    const type = command || 'patch';
    if (!['major', 'minor', 'patch'].includes(type)) {
      console.error('❌ Invalid command. Use:');
      console.error('  node version.js <major|minor|patch> - Update version');
      console.error('  node version.js set <number> - Set specific version code');
      process.exit(1);
    }
    updateVersion(type);
  }
}

module.exports = { updateVersion, setVersionCode }; 