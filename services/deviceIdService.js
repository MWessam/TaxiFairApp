import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEVICE_ID_KEY = 'taxi_fair_device_id';

class DeviceIdService {
  constructor() {
    this.deviceId = null;
  }

  async getDeviceId() {
    if (this.deviceId) {
      return this.deviceId;
    }

    try {
      // Try to get existing device ID from storage
      let storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      
      if (storedId) {
        this.deviceId = storedId;
        return this.deviceId;
      }

      // Generate new device ID
      const newDeviceId = await this.generateDeviceId();
      
      // Store it
      await AsyncStorage.setItem(DEVICE_ID_KEY, newDeviceId);
      this.deviceId = newDeviceId;
      
      return this.deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      // Fallback to a basic ID
      return this.generateFallbackId();
    }
  }

  async generateDeviceId() {
    try {
      const components = [];
      
      // Add platform info
      components.push(Platform.OS);
      components.push(Platform.Version);
      
      // Add app info from Constants
      if (Constants.expoConfig?.extra?.eas?.projectId) {
        components.push(Constants.expoConfig.extra.eas.projectId);
      }
      
      if (Constants.expoConfig?.version) {
        components.push(Constants.expoConfig.version);
      }
      
      // Add device info if available
      if (Constants.deviceName) {
        components.push(Constants.deviceName);
      }
      
      // Add timestamp for uniqueness
      components.push(Date.now().toString());
      
      // Add random component for additional uniqueness
      components.push(Math.random().toString(36).substring(2, 8));
      
      // Create a hash from the components
      const combinedString = components.join('|');
      const hash = await this.hashString(combinedString);
      
      return hash.substring(0, 16); // Use first 16 characters
    } catch (error) {
      console.error('Error generating device ID:', error);
      return this.generateFallbackId();
    }
  }

  async hashString(str) {
    // Simple hash function for React Native
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  generateFallbackId() {
    // Fallback ID using timestamp and random number
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}`;
  }

  async resetDeviceId() {
    try {
      await AsyncStorage.removeItem(DEVICE_ID_KEY);
      this.deviceId = null;
      return await this.getDeviceId();
    } catch (error) {
      console.error('Error resetting device ID:', error);
      throw error;
    }
  }
}

// Export singleton instance
const deviceIdService = new DeviceIdService();
export default deviceIdService; 