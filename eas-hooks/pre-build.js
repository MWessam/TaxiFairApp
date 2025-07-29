const fs = require('fs');
const path = require('path');

module.exports = async (config) => {
  console.log('🔧 Running pre-build hook for Android...');
  
  // Ensure the android directory exists
  const androidDir = path.join(process.cwd(), 'android');
  if (!fs.existsSync(androidDir)) {
    console.log('❌ Android directory not found');
    return;
  }

  // Set environment variables for the build
  process.env.MAPBOX_DOWNLOADS_TOKEN = process.env.MAPBOX_DOWNLOADS_TOKEN || 'sk.eyJ1IjoibWVkb3dlc3NhbSIsImEiOiJjbWRrd3ZlNG8wemIzMmpyem83aXJqczQxIn0.nSQC-IHcUe1ER3kHjYacQg';
  
  // Ensure the project-level build.gradle has the Mapbox repository
  const projectBuildGradlePath = path.join(androidDir, 'build.gradle');
  if (fs.existsSync(projectBuildGradlePath)) {
    let buildGradleContent = fs.readFileSync(projectBuildGradlePath, 'utf8');
    
    // Check if Mapbox repository is already configured
    if (!buildGradleContent.includes('api.mapbox.com/downloads/v2/releases/maven')) {
      console.log('🔧 Adding Mapbox Maven repository to build.gradle...');
      
      // Find the allprojects repositories section and add Mapbox
      const repositoriesPattern = /allprojects\s*\{\s*repositories\s*\{([^}]+)\}/;
      const match = buildGradleContent.match(repositoriesPattern);
      
      if (match) {
        const mapboxRepo = `
    maven { 
      url 'https://api.mapbox.com/downloads/v2/releases/maven'
      credentials {
        username = 'mapbox'
        password = project.hasProperty('MAPBOX_DOWNLOADS_TOKEN') ? project.property('MAPBOX_DOWNLOADS_TOKEN') : System.getenv('MAPBOX_DOWNLOADS_TOKEN')
      }
    }`;
        
        const newRepositoriesSection = `allprojects {
  repositories {
    maven {
      // All of React Native (JS, Obj-C sources, Android binaries) is installed from npm
      url(reactNativeAndroidDir)
    }

    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }${mapboxRepo}
  }
}`;
        
        buildGradleContent = buildGradleContent.replace(repositoriesPattern, newRepositoriesSection);
        fs.writeFileSync(projectBuildGradlePath, buildGradleContent);
        console.log('✅ Mapbox Maven repository added to build.gradle');
      }
    } else {
      console.log('✅ Mapbox Maven repository already configured');
    }
  }
  
  console.log('✅ Pre-build hook completed');
  console.log('📱 Android build configuration ready');
  
  return config;
}; 