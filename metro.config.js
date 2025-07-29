const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for native modules
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Ensure proper module resolution
config.resolver.alias = {
  ...config.resolver.alias,
  '@': __dirname,
};

// Add support for additional file extensions
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'mjs',
  'cjs',
];

// Bundle size optimizations
config.transformer.minifierConfig = {
  // Enable aggressive minification
  mangle: {
    keep_fnames: true, // Keep function names for better stack traces
  },
  // Remove unused code
  compress: {
    drop_console: false, // Set to true to remove console.logs in production
    drop_debugger: true,
    unused: true,
  },
};

// Optimize resolver for smaller bundles
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Enable tree shaking for better dead code elimination
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true, // Inline require() calls for smaller bundles
  },
});

module.exports = config; 