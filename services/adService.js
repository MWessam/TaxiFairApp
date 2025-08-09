// Platform-specific ad service
// This file automatically imports the correct version based on platform

import { Platform } from 'react-native';

let adService;

if (Platform.OS === 'web') {
  // Import web version with AdSense support
  adService = require('./adService.web.js').default;
} else {
  // Import native version with AdMob support
  adService = require('./adService.native.js').default;
}

export default adService;
