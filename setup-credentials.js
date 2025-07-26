const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create the credentials directory if it doesn't exist
const credentialsDir = path.join(__dirname, 'credentials');
if (!fs.existsSync(credentialsDir)) {
  fs.mkdirSync(credentialsDir);
}

// Copy the keystore to credentials directory if it exists in root
const keystorePath = path.join(__dirname, 'android-keystore.jks');
const credentialsKeystorePath = path.join(credentialsDir, 'android-keystore.jks');

if (fs.existsSync(keystorePath) && !fs.existsSync(credentialsKeystorePath)) {
  fs.copyFileSync(keystorePath, credentialsKeystorePath);
  console.log('Keystore copied to credentials directory');
}

// Create the credentials configuration
const credentialsConfig = {
  android: {
    keystore: {
      keystorePath: "credentials/android-keystore.jks",
      keystorePassword: "android",
      keyAlias: "android-key-alias",
      keyPassword: "android"
    }
  }
};

// Write the credentials configuration
const credentialsFilePath = path.join(credentialsDir, 'android.json');
fs.writeFileSync(credentialsFilePath, JSON.stringify(credentialsConfig, null, 2));
console.log('Credentials configuration created');

console.log('Setup complete! You can now run:');
console.log('npx eas build --platform android --profile preview');
console.log('npx eas build --platform android --profile production'); 