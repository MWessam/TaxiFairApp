import React, { createContext, useContext, useState, useEffect } from 'react';
import favoritesService from '../services/favoritesService';

const FavoritesContext = createContext();

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

export const FavoritesProvider = ({ children }) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load favorites on mount
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const loadedFavorites = await favoritesService.getFavorites();
      setFavorites(loadedFavorites);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFavorite = async (location) => {
    try {
      const result = await favoritesService.addFavorite(location);
      if (result.success) {
        // Reload favorites to get updated list
        await loadFavorites();
      }
      return result;
    } catch (error) {
      console.error('Error adding favorite:', error);
      return { success: false, error: 'حدث خطأ أثناء إضافة المفضلة' };
    }
  };

  const removeFavorite = async (favoriteId) => {
    try {
      const result = await favoritesService.removeFavorite(favoriteId);
      if (result.success) {
        // Update local state immediately for better UX
        setFavorites(prev => prev.filter(fav => fav.id !== favoriteId));
      }
      return result;
    } catch (error) {
      console.error('Error removing favorite:', error);
      return { success: false, error: 'حدث خطأ أثناء حذف المفضلة' };
    }
  };

  const clearFavorites = async () => {
    try {
      const result = await favoritesService.clearFavorites();
      if (result.success) {
        setFavorites([]);
      }
      return result;
    } catch (error) {
      console.error('Error clearing favorites:', error);
      return { success: false, error: 'حدث خطأ أثناء مسح المفضلة' };
    }
  };

  const isFavorited = async (location) => {
    try {
      return await favoritesService.isFavorited(location);
    } catch (error) {
      console.error('Error checking if favorited:', error);
      return false;
    }
  };

  const value = {
    favorites,
    loading,
    addFavorite,
    removeFavorite,
    clearFavorites,
    isFavorited,
    refreshFavorites: loadFavorites,
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}; 