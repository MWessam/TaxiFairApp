import { useWindowDimensions, Platform } from 'react-native';

export function useBreakpoints() {
  const { width } = useWindowDimensions();
  return {
    width,
    isSmall: width < 600,
    isMedium: width >= 600 && width < 1024,
    isLarge: width >= 1024,
    isWeb: Platform.OS === 'web',
  };
}

export function useResponsiveValue(values) {
  // values: { small?, medium?, large?, default? }
  const { isSmall, isMedium, isLarge } = useBreakpoints();
  if (isLarge && values.large !== undefined) return values.large;
  if (isMedium && values.medium !== undefined) return values.medium;
  if (isSmall && values.small !== undefined) return values.small;
  return values.default;
}


