import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultTheme, getThemeByGovernorate } from './Colors';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [currentGovernorate, setCurrentGovernorate] = useState('mansoura');
  const [theme, setTheme] = useState(DefaultTheme);

  // Load saved governorate from AsyncStorage on app start
  useEffect(() => {
    loadSavedGovernorate();
  }, []);

  const loadSavedGovernorate = async () => {
    try {
      const savedGovernorate = await AsyncStorage.getItem('selectedGovernorate');
      if (savedGovernorate) {
        setCurrentGovernorate(savedGovernorate);
        setTheme(getThemeByGovernorate(savedGovernorate));
      }
    } catch (error) {
      console.log('Error loading saved governorate:', error);
    }
  };

  const changeGovernorate = async (governorateKey) => {
    try {
      setCurrentGovernorate(governorateKey);
      const newTheme = getThemeByGovernorate(governorateKey);
      setTheme(newTheme);
      await AsyncStorage.setItem('selectedGovernorate', governorateKey);
    } catch (error) {
      console.log('Error saving governorate:', error);
    }
  };

  const value = {
    theme,
    currentGovernorate,
    changeGovernorate,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}; 