import 'dotenv/config';
export default {
  "expo": {
    "name": "TaxiFairMock",
    "slug": "TaxiFairMock",
    "version": "1.0.25",
    "orientation": "portrait",
    "icon": "./assets/images/cair_icon_transparent.png",
    "scheme": "taxifairmock",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": false,
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "UIBackgroundModes": [
          "location",
          "background-processing",
          "background-fetch"
        ],
        "NSLocationAlwaysAndWhenInUseUsageDescription": "This app needs precise location access to accurately track your taxi rides in the background.",
        "NSLocationWhenInUseUsageDescription": "This app needs precise location access to accurately track your taxi rides.",
        "NSLocationTemporaryUsageDescriptionDictionary": {
          "Taxi Tracking": "This app needs precise location to track your taxi ride distance and route."
        }
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/cair_icon_transparent.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "package": "com.MedoWessam.TaxiOgraApp",
      "versionCode": 35,
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "WAKE_LOCK"
      ],
      "enableProguardInReleaseBuilds": true,
      "enableSeparateBuildPerCPUArchitecture": true,
      "universalApk": false
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/cair_icon_transparent.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
                  "image": "./assets/images/cair_icon_transparent.png",
        "imageWidth": 200,
        "resizeMode": "contain",
        "backgroundColor": "#ffffff"
        }
      ],
      "expo-location",
      "expo-notifications",
      // Temporarily disabled AdMob for debugging
      // [
      //   "react-native-google-mobile-ads",
      //   {
      //     "android_app_id": "ca-app-pub-916645906844~8c68e10bfe7ae49d04a059"
      //   }
      // ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "9f03bc33-b757-410d-90c9-1d5d4c61d73b"
      },
      "MAPBOX_ACCESS_TOKEN": process.env.MAPBOX_ACCESS_TOKEN,
      "ORS_API_KEY": process.env.ORS_API_KEY,
      "FIREBASE_API_KEY": process.env.FIREBASE_API_KEY,
      "FIREBASE_AUTH_DOMAIN": process.env.FIREBASE_AUTH_DOMAIN,
      "FIREBASE_PROJECT_ID": process.env.FIREBASE_PROJECT_ID,
      "FIREBASE_STORAGE_BUCKET": process.env.FIREBASE_STORAGE_BUCKET,
      "FIREBASE_MESSAGING_SENDER_ID": process.env.FIREBASE_MESSAGING_SENDER_ID,
      "FIREBASE_APP_ID": process.env.FIREBASE_APP_ID,
      "FIREBASE_MEASUREMENT_ID": process.env.FIREBASE_MEASUREMENT_ID,
      "APP_CHECK_SITE_KEY": process.env.APP_CHECK_SITE_KEY
    }
  }
}
