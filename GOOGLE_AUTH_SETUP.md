# Google Authentication Setup Guide

This guide will help you set up Google authentication for the Kam El Ogra app with automatic Google sign-in.

## Prerequisites

1. Google Cloud Console project
2. Firebase project configured
3. OAuth 2.0 client IDs configured

## Setup Steps

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" > "Credentials"
4. Create OAuth 2.0 client IDs for:
   - Android (package: com.MedoWessam.TaxiOgraApp)
   - iOS (bundle ID: com.MedoWessam.TaxiOgraApp)
   - Web (for Expo development)

### 2. Firebase Authentication Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to "Authentication" > "Sign-in method"
4. Enable "Google" as a sign-in provider
5. Add your OAuth 2.0 client IDs

### 3. Get SHA-1 Fingerprint

Run this command in PowerShell to get your SHA-1 fingerprint:

```powershell
& "C:\Program Files\Java\jdk-23\bin\keytool.exe" -list -v -keystore "C:\Users\[YourUsername]\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

**Replace `[YourUsername]` with your actual Windows username.**

### 4. Environment Variables

Add the following to your `.env` file:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
```

### 5. App Configuration

The app is already configured with:
- `@react-native-google-signin/google-signin` plugin for automatic Google sign-in
- `expo-auth-session` plugin for web-based Google Sign-In
- Authentication context in `constants/AuthContext.js`
- Sign-in screen in `components/SignInScreen.js`

### 6. Testing

1. Run the app: `npm start`
2. Test automatic Google sign-in
3. Test manual Google Sign-In fallback
4. Test anonymous sign-in
5. Verify user data is stored correctly

## Features Implemented

- ✅ **Automatic Google Sign-In** - Silent sign-in when app opens
- ✅ **Manual Google Sign-In** - Fallback if automatic fails
- ✅ **Anonymous authentication** - For privacy-conscious users
- ✅ **Authentication state persistence** - Remembers user across app restarts
- ✅ **User profile management** - Display user info and sign-out functionality
- ✅ **Integration with existing app design** - Matches your app's theme

## Authentication Flow

1. **App starts** → Tries automatic Google sign-in (silent)
2. **If automatic fails** → Shows sign-in screen with options:
   - Google Sign-In (primary)
   - Anonymous (privacy option)
3. **User chooses** → Signs in and accesses app
4. **Future app launches** → Automatic sign-in if previously authenticated

## Usage

The authentication system automatically:
1. Attempts automatic Google sign-in on app start
2. Falls back to manual sign-in options if automatic fails
3. Provides Google Sign-In and anonymous options
4. Persists authentication state across app restarts
5. Uses authenticated user ID for all Firebase operations

## Troubleshooting

### Common Issues

1. **"Google Play Services not available" error**
   - Ensure Google Play Services is installed and updated
   - Check that your device supports Google Play Services
   - Verify your app is properly configured in Google Cloud Console

2. **"Invalid client ID" error**
   - Verify your OAuth 2.0 client IDs are correct
   - Ensure package names match your app configuration
   - Check that SHA-1 fingerprint is added to Firebase

3. **Automatic sign-in not working**
   - Check that user is signed in to Google account on device
   - Verify Google Sign-In is enabled for your app
   - Check OAuth consent screen configuration

4. **Sign-in not working on device**
   - Check that your app's SHA-1 fingerprint is added to Firebase
   - Verify OAuth consent screen is configured
   - Ensure Google Play Services is available

### Debug Mode

Enable debug logging by setting:
```javascript
console.log('Auth state:', { user, isAuthenticated, authMethod });
```

## Next Steps

After implementing authentication, you may want to:
1. Add user profile management
2. Implement trip history per user
3. Add admin role management
4. Implement rate limiting per user
5. Add user preferences and settings 