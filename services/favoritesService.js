import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'taxi_app_favorite_locations';
const MAX_FAVORITES = 20; // Increased since we're storing individual locations

class FavoritesService {
  // Get all favorite locations
  async getFavorites() {
    try {
      const favoritesJson = await AsyncStorage.getItem(FAVORITES_KEY);
      return favoritesJson ? JSON.parse(favoritesJson) : [];
    } catch (error) {
      console.error('Error loading favorites:', error);
      return [];
    }
  }

  // Add a new favorite location
  async addFavorite(location) {
    try {
      const favorites = await this.getFavorites();
      
      // Check if this location already exists (same name and coordinates)
      const exists = favorites.some(fav => 
        fav.name === location.name || 
        (Math.abs(fav.lat - location.lat) < 0.001 && Math.abs(fav.lng - location.lng) < 0.001)
      );
      
      if (exists) {
        return { success: false, error: 'هذا الموقع موجود بالفعل في المفضلة' };
      }

      // Validate location data
      if (!location.name || !location.lat || !location.lng) {
        return { success: false, error: 'بيانات الموقع غير مكتملة' };
      }

      // Create favorite object
      const favorite = {
        id: Date.now().toString(),
        name: location.name,
        lat: location.lat,
        lng: location.lng,
        createdAt: new Date().toISOString(),
      };

      // Add to beginning of array (most recent first)
      const updatedFavorites = [favorite, ...favorites];

      // Keep only max favorites (remove oldest if needed)
      if (updatedFavorites.length > MAX_FAVORITES) {
        updatedFavorites.splice(MAX_FAVORITES);
      }

      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updatedFavorites));
      return { success: true, favorite };
    } catch (error) {
      console.error('Error adding favorite:', error);
      return { success: false, error: 'حدث خطأ أثناء إضافة الموقع للمفضلة' };
    }
  }

  // Remove a favorite location by ID
  async removeFavorite(favoriteId) {
    try {
      const favorites = await this.getFavorites();
      const updatedFavorites = favorites.filter(fav => fav.id !== favoriteId);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updatedFavorites));
      return { success: true };
    } catch (error) {
      console.error('Error removing favorite:', error);
      return { success: false, error: 'حدث خطأ أثناء حذف المفضلة' };
    }
  }

  // Clear all favorites
  async clearFavorites() {
    try {
      await AsyncStorage.removeItem(FAVORITES_KEY);
      return { success: true };
    } catch (error) {
      console.error('Error clearing favorites:', error);
      return { success: false, error: 'حدث خطأ أثناء مسح المفضلة' };
    }
  }

  // Check if a location is favorited
  async isFavorited(location) {
    try {
      const favorites = await this.getFavorites();
      return favorites.some(fav => 
        fav.name === location.name ||
        (Math.abs(fav.lat - location.lat) < 0.001 && Math.abs(fav.lng - location.lng) < 0.001)
      );
    } catch (error) {
      console.error('Error checking if favorited:', error);
      return false;
    }
  }

  // Get favorite count
  async getFavoriteCount() {
    try {
      const favorites = await this.getFavorites();
      return favorites.length;
    } catch (error) {
      console.error('Error getting favorite count:', error);
      return 0;
    }
  }
}

export default new FavoritesService(); 