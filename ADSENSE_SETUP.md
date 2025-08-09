# AdSense Setup Guide for Web Version

This guide explains how to set up Google AdSense for the web version of your taxi app.

## Prerequisites

1. **Google AdSense Account**: You need an approved Google AdSense account
2. **Website Verification**: Your website must be added and verified in AdSense
3. **Ad Units**: Create ad units in your AdSense dashboard

## Setup Steps

### 1. Create AdSense Account and Ad Units

1. Go to [Google AdSense](https://www.google.com/adsense/)
2. Create an account or sign in
3. Add your website and get it approved
4. Create ad units:
   - **Banner Ad Unit**: For banner ads (recommended: responsive)
   - **Rectangle Ad Unit**: For larger ads (optional)

### 2. Configure Ad Settings

Edit `config/adConfig.js` and update the following:

```javascript
// Production IDs (replace with your actual IDs)
production: {
  // Web (AdSense)
  web: {
    // Replace with your actual AdSense publisher ID
    publisherId: 'ca-pub-XXXXXXXXXXXXXXXX',
    banner: {
      // Replace with your banner ad unit ID
      slot: 'YYYYYYYYYY',
      format: 'auto',
      responsive: true,
    },
    rectangle: {
      // Replace with your rectangle ad unit ID (optional)
      slot: 'ZZZZZZZZZZ',
      format: 'rectangle',
      responsive: true,
    },
  },
},
```

### 3. Get Your AdSense IDs

#### Publisher ID:
1. Go to your AdSense dashboard
2. Look for your Publisher ID (starts with `ca-pub-`)
3. It's usually visible in the top-right corner or in account settings

#### Ad Unit IDs:
1. Go to **Ads** → **By ad unit** in your AdSense dashboard
2. Create a new ad unit or use existing ones
3. Copy the Ad Unit ID (10-digit number)
4. Paste it in the `slot` field in your config

### 4. Test Your Setup

#### Development Testing:
- The app uses test ads in development mode
- No real ads will show during development
- Check browser console for AdSense logs

#### Production Testing:
1. Deploy your app to a live domain
2. Ensure the domain is added to your AdSense account
3. Wait for ads to appear (can take a few minutes)

### 5. Ad Placement

The app automatically shows banner ads on all screens via the `BannerAdComponent`. The ads appear at the bottom of each screen.

#### Current Ad Placements:
- **Banner Ads**: Bottom of all screens
- **Auto Ads**: Enabled (if configured in AdSense)
- **Interstitial-style**: Triggered by app actions (using auto ads)

### 6. AdSense Features Enabled

#### Auto Ads:
- **Page-level ads**: Enabled
- **Anchor ads**: Bottom overlay ads
- **Multiplex ads**: In-feed ads

#### Manual Ads:
- **Banner refresh**: Every 30 seconds (configurable)
- **Lazy loading**: Enabled for better performance
- **Responsive**: Ads adapt to screen size

### 7. Privacy and Compliance

The configuration includes:
- **Non-personalized ads**: Enabled by default
- **Cookie consent**: Ready for integration
- **GDPR compliance**: Basic setup included

### 8. Troubleshooting

#### Ads Not Showing:
1. Check browser console for errors
2. Verify your Publisher ID and Ad Unit IDs
3. Ensure your domain is approved in AdSense
4. Wait 24-48 hours after setup for ads to appear

#### Console Errors:
- `AdSense script failed to load`: Check your Publisher ID
- `Ad unit not found`: Verify your Ad Unit IDs
- `Domain not approved`: Add your domain to AdSense

#### Performance Issues:
- Ads load asynchronously to avoid blocking the UI
- Lazy loading is enabled by default
- Banner refresh can be disabled by setting `refreshInterval: 0`

### 9. Configuration Options

Edit `config/adConfig.js` to customize:

```javascript
adsense: {
  settings: {
    // Auto ads configuration
    autoAds: {
      enabled: true,          // Enable/disable auto ads
      pageLevel: true,        // Page-level ads
      anchor: true,           // Anchor ads
      multiplex: true,        // Multiplex ads
    },
    
    // Manual ad settings
    manualAds: {
      enabled: true,          // Enable manual banner ads
      lazyLoading: true,      // Lazy load ads
      refreshInterval: 30000, // Banner refresh interval (ms)
    },
    
    // Privacy settings
    privacy: {
      nonPersonalizedAds: true,  // Show non-personalized ads
      cookieConsent: true,       // Enable cookie consent
    },
  },
}
```

### 10. Revenue Optimization Tips

1. **Ad Placement**: Banner ads at the bottom work well for mobile web
2. **Auto Ads**: Enable for additional revenue opportunities
3. **Responsive Design**: Ads automatically adapt to screen sizes
4. **User Experience**: Ads don't block core functionality
5. **Refresh Rate**: 30-second refresh balances revenue and UX

## Support

If you encounter issues:
1. Check the browser console for detailed error messages
2. Verify your AdSense account status
3. Ensure your domain is properly configured in AdSense
4. Test with different browsers and devices

## Important Notes

- **Real ads only show in production** on approved domains
- **Test ads are used in development** mode
- **AdSense approval** can take 24-48 hours for new domains
- **Revenue tracking** is available in your AdSense dashboard
