import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/constants/AuthContext';
import { useTheme } from '@/constants/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function AuthGuard({ children, fallback = null }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>جاري التحقق من تسجيل الدخول...</Text>
      </View>
    );
  }

  // Show fallback or default auth prompt if not authenticated
  if (!isAuthenticated) {
    if (fallback) {
      return fallback;
    }

    return (
      <View style={styles.authContainer}>
        <Ionicons name="lock-closed" size={64} color={theme.textSecondary} />
        <Text style={styles.authTitle}>تسجيل الدخول مطلوب</Text>
        <Text style={styles.authText}>
          يجب تسجيل الدخول للوصول لهذه الصفحة
        </Text>
        <TouchableOpacity
          style={styles.authButton}
          onPress={() => router.push('/(other)/SignInScreen')}
        >
          <Text style={styles.authButtonText}>تسجيل الدخول</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // User is authenticated, render children
  return children;
}

const styles = {
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  authTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  authText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  authButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: '80%',
    marginBottom: 16,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
}; 