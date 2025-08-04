import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/constants/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { theme } = useTheme();
  const { signInAnonymously, signInWithGoogle, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Get Google client ID from config
  const googleClientId = Constants.expoConfig?.extra?.GOOGLE_CLIENT_ID || '916645906844-8c68e10bfe7ae49d04a059.apps.googleusercontent.com';

  // Google OAuth configuration
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: googleClientId,
    iosClientId: googleClientId,
    webClientId: googleClientId,
    expoClientId: googleClientId,
  });

  // Handle Google sign-in response
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSignIn(response.authentication);
    }
  }, [response]);

  const handleGoogleSignIn = async (authentication) => {
    try {
      setIsSigningIn(true);
      const result = await signInWithGoogle();
      if (!result.success) {
        Alert.alert('خطأ في تسجيل الدخول', result.error || 'حدث خطأ أثناء تسجيل الدخول بحساب Google');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      Alert.alert('خطأ في تسجيل الدخول', 'حدث خطأ أثناء تسجيل الدخول بحساب Google');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    try {
      setIsSigningIn(true);
      const result = await signInAnonymously();
      if (!result.success) {
        Alert.alert('خطأ في تسجيل الدخول', result.error || 'حدث خطأ أثناء تسجيل الدخول المجهول');
      }
    } catch (error) {
      console.error('Anonymous sign-in error:', error);
      Alert.alert('خطأ في تسجيل الدخول', 'حدث خطأ أثناء تسجيل الدخول المجهول');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignInPress = async () => {
    try {
      setIsSigningIn(true);
      await promptAsync();
    } catch (error) {
      console.error('Error prompting Google sign-in:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء فتح نافذة تسجيل الدخول');
    } finally {
      setIsSigningIn(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>تسجيل الدخول</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* App Logo/Icon */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="car" size={64} color={theme.primary} />
          </View>
          <Text style={styles.appName}>كام الأجرة</Text>
          <Text style={styles.appDescription}>
            ساعد في تحسين أسعار التاكسي في مصر
          </Text>
        </View>

        {/* Sign In Options */}
        <View style={styles.signInContainer}>
          {/* Google Sign In Button */}
          <TouchableOpacity
            style={[styles.googleButton, { opacity: isSigningIn ? 0.6 : 1 }]}
            onPress={handleGoogleSignInPress}
            disabled={isSigningIn || loading}
          >
            {isSigningIn ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.googleButtonText}>تسجيل الدخول بحساب Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>أو</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Anonymous Sign In Button */}
          <TouchableOpacity
            style={[styles.anonymousButton, { opacity: isSigningIn ? 0.6 : 1 }]}
            onPress={handleAnonymousSignIn}
            disabled={isSigningIn || loading}
          >
            {isSigningIn ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <Ionicons name="person" size={20} color={theme.primary} style={styles.buttonIcon} />
                <Text style={styles.anonymousButtonText}>استمر كزائر</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Info Text */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            تسجيل الدخول يساعد في:
          </Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
              <Text style={styles.benefitText}>حفظ رحلاتك الشخصية</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
              <Text style={styles.benefitText}>مشاركة البيانات بأمان</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
              <Text style={styles.benefitText}>تحسين دقة التقديرات</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 8,
  },
  appDescription: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  signInContainer: {
    marginBottom: 32,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: theme.textSecondary,
  },
  anonymousButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  anonymousButtonText: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginLeft: 8,
  },
}); 