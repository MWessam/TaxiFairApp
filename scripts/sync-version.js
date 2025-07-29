const fs = require('fs');
const path = require('path');

const appConfigPath = path.join(__dirname, '../app.config.js');
const gradlePropertiesPath = path.join(__dirname, '../android/gradle.properties');

function syncVersion() {
  try {
    // Read app.config.js
    const configContent = fs.readFileSync(appConfigPath, 'utf8');
    
    // Extract version and versionCode
    const versionMatch = configContent.match(/"version":\s*"([^"]+)"/);
    const versionCodeMatch = configContent.match(/"versionCode":\s*(\d+)/);
    
    if (!versionMatch || !versionCodeMatch) {
      console.error('❌ Could not find version or versionCode in app.config.js');
      return false;
    }
    
    const version = versionMatch[1];
    const versionCode = versionCodeMatch[1];
    
    console.log(`📱 Syncing version: ${version} (${versionCode})`);
    
    // Read gradle.properties
    let gradleContent = fs.readFileSync(gradlePropertiesPath, 'utf8');
    
    // Update or add version properties
    const versionCodeRegex = /^versionCode=.*$/m;
    const versionNameRegex = /^versionName=.*$/m;
    
    if (versionCodeRegex.test(gradleContent)) {
      gradleContent = gradleContent.replace(versionCodeRegex, `versionCode=${versionCode}`);
    } else {
      gradleContent += `\nversionCode=${versionCode}`;
    }
    
    if (versionNameRegex.test(gradleContent)) {
      gradleContent = gradleContent.replace(versionNameRegex, `versionName=${version}`);
    } else {
      gradleContent += `\nversionName=${version}`;
    }
    
    // Write back to gradle.properties
    fs.writeFileSync(gradlePropertiesPath, gradleContent);
    
    console.log(`✅ Synced version to gradle.properties`);
    return true;
    
  } catch (error) {
    console.error('❌ Error syncing version:', error.message);
    return false;
  }
}

// Command line usage
if (require.main === module) {
  syncVersion();
}

module.exports = { syncVersion }; 