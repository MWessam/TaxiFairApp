# Zone Management Guide

This guide explains how to create and manage complex polygon zones for your taxi fare prediction system.

## 🎯 Recommended Tools

### **1. Google My Maps (Free & Easy)**
**Best for: Quick zone creation**

1. Go to [Google My Maps](https://www.google.com/mymaps)
2. Create a new map
3. Click "Add layer" → "Draw a line or shape"
4. Draw polygons around your zones
5. Name each zone
6. Export as KML/KMZ

### **2. QGIS (Free & Professional)**
**Best for: Complex zone analysis**

1. Download [QGIS](https://qgis.org/)
2. Add OpenStreetMap as base layer
3. Create new polygon layer
4. Draw zones with polygon tool
5. Export as GeoJSON

### **3. Mapbox Studio (Paid)**
**Best for: Production mapping**

1. Create account at [Mapbox](https://www.mapbox.com/)
2. Use Mapbox Studio
3. Draw polygons with precision tools
4. Export as GeoJSON

### **4. GeoJSON.io (Free Web Tool)**
**Best for: Simple zone creation**

1. Go to [geojson.io](http://geojson.io/)
2. Draw polygons on the map
3. Add properties (name, zone_key)
4. Copy GeoJSON data

## 🚀 Zone Creation Workflow

### **Step 1: Draw Zones**
1. Choose your tool (Google My Maps recommended)
2. Draw polygons around Mansoura areas:
   - University campus
   - Toreil neighborhood
   - City center
   - Railway station
   - Hospital area
   - Shopping districts
   - Residential areas

### **Step 2: Export Data**
- **From Google My Maps**: Export as KML
- **From QGIS**: Export as GeoJSON
- **From Mapbox**: Export as GeoJSON

### **Step 3: Convert Format (if needed)**
If you have KML, convert to GeoJSON:
- Use [KML to GeoJSON converter](https://kml2geojson.com/)
- Or use QGIS to import KML and export GeoJSON

### **Step 4: Import to Your System**
Use the `importZones` function:

```javascript
const geojson = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "zone_key": "university",
        "name": "University"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [31.03, 31.37], [31.05, 31.37], 
          [31.05, 31.39], [31.03, 31.39], 
          [31.03, 31.37]
        ]]
      }
    }
  ]
};

// Call the import function
const result = await firebase.functions().httpsCallable('importZones')({
  geojson: geojson
});
```

## 📋 Zone Management Functions

### **Get All Zones**
```javascript
const result = await firebase.functions().httpsCallable('getZones')();
console.log(result.data.zones);
```

### **Add New Zone**
```javascript
const result = await firebase.functions().httpsCallable('addZone')({
  zoneKey: 'shopping_mall',
  zoneName: 'Shopping Mall',
  polygonCoordinates: [
    [31.04, 31.36], [31.06, 31.36], 
    [31.06, 31.38], [31.04, 31.38], 
    [31.04, 31.36]
  ]
});
```

### **Remove Zone**
```javascript
const result = await firebase.functions().httpsCallable('removeZone')({
  zoneKey: 'shopping_mall'
});
```

### **Export Zones**
```javascript
const result = await firebase.functions().httpsCallable('exportZones')();
console.log(result.data.geojson);
```

## 🎨 Zone Design Best Practices

### **Zone Size**
- **Too small**: Not enough data for ML
- **Too large**: Loses precision
- **Optimal**: 0.5-2 km² per zone

### **Zone Boundaries**
- Follow natural boundaries (roads, rivers)
- Include complete neighborhoods
- Avoid overlapping zones
- Cover high-traffic areas

### **Zone Names**
- Use descriptive names
- Keep consistent naming
- Include Arabic names if needed

### **Zone Properties**
- **Residential**: High demand during rush hours
- **Commercial**: High demand during business hours
- **Educational**: High demand during school hours
- **Transportation**: High demand during travel times

## 🔧 Technical Details

### **Polygon Format**
```javascript
// Each zone polygon is an array of [lat, lng] coordinates
const polygon = [
  [31.03, 31.37], // Start point
  [31.05, 31.37], // Point 2
  [31.05, 31.39], // Point 3
  [31.03, 31.39], // Point 4
  [31.03, 31.37]  // Back to start (closed polygon)
];
```

### **Validation Rules**
- Minimum 3 points per polygon
- Coordinates must be within Mansoura area
- Polygon must be closed (first = last point)
- No self-intersecting polygons

### **Performance Considerations**
- Keep polygons simple (max 20-30 points)
- Use efficient point-in-polygon algorithm
- Cache zone lookups for performance

## 📊 Zone Analysis

### **Data Collection**
- Monitor zone usage patterns
- Track fare variations by zone
- Analyze demand by time of day
- Identify high-value zones

### **ML Impact**
- Zones are categorical features
- Different zones have different base rates
- Zone combinations affect pricing
- Seasonal zone patterns

## 🛠️ Troubleshooting

### **Common Issues**

1. **Zone not detected**
   - Check polygon coordinates
   - Verify point-in-polygon algorithm
   - Ensure coordinates are in correct format

2. **Import errors**
   - Validate GeoJSON format
   - Check coordinate bounds
   - Verify polygon closure

3. **Performance issues**
   - Simplify complex polygons
   - Reduce number of zones
   - Optimize lookup algorithm

### **Debug Tools**
```javascript
// Test zone detection
const zone = getZoneFromCoordinates(31.04, 31.37);
console.log('Zone:', zone);

// Validate polygon
const validation = validatePolygon(polygonCoordinates);
console.log('Valid:', validation.valid);
```

## 📈 Future Enhancements

1. **Dynamic Zones**: Auto-create zones based on data
2. **Zone Hierarchies**: Sub-zones within main zones
3. **Time-based Zones**: Different zones for different times
4. **Zone Analytics**: Detailed zone performance metrics
5. **Zone Optimization**: ML-based zone boundary optimization

## 🎯 Next Steps

1. **Create zones** using Google My Maps
2. **Export as GeoJSON**
3. **Import to your system**
4. **Test zone detection**
5. **Monitor zone performance**
6. **Optimize based on data**

Your zone system is now ready for complex polygon management! 🚀 