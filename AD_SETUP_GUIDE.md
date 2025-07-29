# Ad Setup Guide for Taxi Fare App

This guide will help you set up a balanced ad strategy for your taxi fare app that generates revenue without being intrusive.

## 🎯 Ad Strategy Overview

### What We've Implemented:
1. **Banner Ads** - Small, non-intrusive ads at the bottom of screens
2. **Interstitial Ads** - Full-screen ads shown at strategic moments (not too frequently)
3. **Premium Upgrade** - Option for users to remove ads for a small fee
4. **Smart Ad Timing** - Ads only show when users try to go back from results or after trip estimation

### Ad Display Rules:
- ✅ Show banner ads on main screens
- ✅ Show interstitial ads when user tries to go back from fare results
- ✅ Show interstitial ads after trip estimation (not tracking)
- ❌ No popup ads
- ❌ No ads immediately on app launch
- ❌ No ads after tracking rides and showing results
- ❌ Maximum 3 ads per session
- ❌ Minimum 1-minute interval between interstitial ads

## 📱 Setup Instructions

### 1. Install Dependencies

The required packages have been added to `package.json`:
```bash
npm install
```

### 2. Configure AdMob

1. **Create AdMob Account:**
   - Go to [AdMob Console](https://admob.google.com/)
   - Create a new app for your taxi fare app
   - Get your App ID

2. **Create Ad Units:**
   - Create a Banner ad unit
   - Create an Interstitial ad unit
   - Copy the ad unit IDs

3. **Update Configuration:**
   - Open `config/adConfig.js`
   - Replace the placeholder IDs with your actual AdMob IDs:
     ```javascript
     production: {
       android: {
         banner: 'ca-app-pub-YOUR_ACTUAL_BANNER_ID',
         interstitial: 'ca-app-pub-YOUR_ACTUAL_INTERSTITIAL_ID',
       },
       ios: {
         banner: 'ca-app-pub-YOUR_ACTUAL_BANNER_ID',
         interstitial: 'ca-app-pub-YOUR_ACTUAL_INTERSTITIAL_ID',
       },
     },
     appId: {
       android: 'ca-app-pub-YOUR_ACTUAL_APP_ID',
       ios: 'ca-app-pub-YOUR_ACTUAL_APP_ID',
     }
     ```

### 3. Platform-Specific Setup

#### Android Setup:
1. **Update `android/app/src/main/AndroidManifest.xml`:**
   ```xml
   <manifest>
     <application>
       <!-- Add this meta-data tag -->
       <meta-data
         android:name="com.google.android.gms.ads.APPLICATION_ID"
         android:value="ca-app-pub-YOUR_ACTUAL_APP_ID"/>
     </application>
   </manifest>
   ```

2. **Update `android/app/build.gradle`:**
   ```gradle
   dependencies {
     // Add this line if not already present
     implementation 'com.google.android.gms:play-services-ads:22.0.0'
   }
   ```

#### iOS Setup:
1. **Update `ios/YourApp/Info.plist`:**
   ```xml
   <dict>
     <!-- Add this key -->
     <key>GADApplicationIdentifier</key>
     <string>ca-app-pub-YOUR_ACTUAL_APP_ID</string>
     
     <!-- Add this for iOS 14+ -->
     <key>NSUserTrackingUsageDescription</key>
     <string>This identifier will be used to deliver personalized ads to you.</string>
   </dict>
   ```

### 4. Test the Implementation

1. **Development Testing:**
   - The app uses test ad IDs in development mode
   - You'll see test ads with "Test Ad" labels
   - This is safe and won't affect your AdMob account

2. **Production Testing:**
   - Change `__DEV__` to `false` in `services/adService.js` for production testing
   - Use real ad unit IDs
   - Test on real devices

## 💰 Revenue Optimization Tips

### 1. Ad Placement Strategy:
- **Banner ads** on main screens (home, results)
- **Interstitial ads** after positive actions (fare calculation, trip submission)
- **Premium upgrade** option prominently displayed

### 2. User Experience:
- Don't show ads immediately when app opens
- Show ads after users complete actions (positive reinforcement)
- Provide clear premium upgrade option
- Keep ad frequency reasonable (max 3 per session)

### 3. Ad Content:
- Target relevant keywords: 'taxi', 'transportation', 'travel'
- Use non-personalized ads for privacy compliance
- Monitor ad performance in AdMob console

## 🔧 Customization Options

### Adjust Ad Frequency:
Edit `config/adConfig.js`:
```javascript
settings: {
  minAdInterval: 60000, // Change interval between ads
  maxAdsPerSession: 3,  // Change max ads per session
}
```

### Add More Ad Triggers:
In `services/adService.js`, add new methods:
```javascript
async showAdAfterSpecificAction() {
  return await this.showInterstitialAd();
}
```

### Premium Pricing:
Edit `components/PremiumUpgradeModal.js`:
```javascript
<Text style={styles.price}>$2.99</Text> // Change price
```

## 🚀 Going Live

### 1. Final Checklist:
- [ ] Replace all test IDs with production IDs
- [ ] Test on real devices
- [ ] Verify ad compliance with app store policies
- [ ] Set up AdMob payment information

### 2. App Store Compliance:
- **Google Play:** Ads are allowed, but follow [AdMob policies](https://support.google.com/admob/answer/6128543)
- **App Store:** Follow [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) for ads

### 3. Monitoring:
- Use AdMob console to monitor performance
- Track user engagement and revenue
- Adjust ad frequency based on user feedback

## 📊 Expected Revenue

With this balanced approach, you can expect:
- **Banner ads:** $0.50 - $2.00 per 1000 impressions
- **Interstitial ads:** $2.00 - $8.00 per 1000 impressions
- **Premium upgrades:** $2.99 per purchase

**Estimated monthly revenue** (with 1000 daily active users):
- Ad revenue: $30 - $150/month
- Premium upgrades: $50 - $200/month
- **Total: $80 - $350/month**

## 🆘 Troubleshooting

### Common Issues:
1. **Ads not showing:** Check ad unit IDs and network connectivity
2. **Test ads in production:** Ensure `__DEV__` is properly set
3. **App crashes:** Verify all dependencies are installed correctly

### Support:
- [AdMob Help Center](https://support.google.com/admob/)
- [React Native Google Mobile Ads Documentation](https://github.com/react-native-admob/admob)

---

**Remember:** The key to successful ad monetization is balancing revenue with user experience. This implementation prioritizes user satisfaction while still generating meaningful revenue. 