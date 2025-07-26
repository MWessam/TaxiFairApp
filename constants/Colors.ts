/**
 * Governorate-based theme system for Egyptian taxi colors
 */

// Governorate taxi color schemes
export const GovernorateThemes = {
  mansoura: {
    name: 'المنصورة',
    primary: '#d32f2f',      // Red
    secondary: '#ffffff',     // White
    accent: '#f44336',        // Light red
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#212121',
    textOnPrimary: '#ffffff',
    textSecondary: '#757575',
    border: '#e0e0e0',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
  },
  cairo: {
    name: 'القاهرة',
    primary: '#212121',       // Dark gray (better for headers)
    secondary: '#ffffff',     // White
    accent: '#424242',        // Medium gray
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#212121',
    textOnPrimary: '#ffffff',
    textSecondary: '#757575',
    border: '#e0e0e0',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
  },
  alexandria: {
    name: 'الإسكندرية',
    primary: '#ffeb3b',       // Yellow
    secondary: '#000000',     // Black
    accent: '#ffc107',        // Amber
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#212121',
    textOnPrimary: '#000000',
    textSecondary: '#757575',
    border: '#e0e0e0',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
  },
  giza: {
    name: 'الجيزة',
    primary: '#2196f3',       // Blue
    secondary: '#ffffff',     // White
    accent: '#1976d2',        // Dark blue
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#212121',
    textOnPrimary: '#ffffff',
    textSecondary: '#757575',
    border: '#e0e0e0',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
  },
  aswan: {
    name: 'أسوان',
    primary: '#4caf50',       // Green
    secondary: '#ffffff',     // White
    accent: '#388e3c',        // Dark green
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#212121',
    textOnPrimary: '#ffffff',
    textSecondary: '#757575',
    border: '#e0e0e0',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
  },
  luxor: {
    name: 'الأقصر',
    primary: '#9c27b0',       // Purple
    secondary: '#ffffff',     // White
    accent: '#7b1fa2',        // Dark purple
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#212121',
    textOnPrimary: '#ffffff',
    textSecondary: '#757575',
    border: '#e0e0e0',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
  },
  hurghada: {
    name: 'الغردقة',
    primary: '#00bcd4',       // Cyan
    secondary: '#ffffff',     // White
    accent: '#0097a7',        // Dark cyan
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#212121',
    textOnPrimary: '#ffffff',
    textSecondary: '#757575',
    border: '#e0e0e0',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
  },
  sharm: {
    name: 'شرم الشيخ',
    primary: '#ff5722',       // Deep orange
    secondary: '#ffffff',     // White
    accent: '#d84315',        // Dark orange
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#212121',
    textOnPrimary: '#ffffff',
    textSecondary: '#757575',
    border: '#e0e0e0',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
  },
};

// Default theme (Mansoura)
export const DefaultTheme = GovernorateThemes.mansoura;

// Get all available governorates
export const getAvailableGovernorates = () => {
  return Object.keys(GovernorateThemes).map(key => ({
    key,
    ...GovernorateThemes[key]
  }));
};

// Get theme by governorate key
export const getThemeByGovernorate = (governorate) => {
  return GovernorateThemes[governorate] || DefaultTheme;
};

// Legacy Colors for backward compatibility
const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};
