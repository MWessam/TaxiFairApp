import 'dotenv/config';
export default {
  "expo": {
    "name": "TaxiFairMock",
    "slug": "TaxiFairMock",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "taxifairmock",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": false,
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "package": "com.MedoWessam.TaxiOgraApp"
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ],
      "expo-location"
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "9f03bc33-b757-410d-90c9-1d5d4c61d73b"
      },
      "MAPBOX_ACCESS_TOKEN": process.env.MAPBOX_ACCESS_TOKEN
    }
  }
}
