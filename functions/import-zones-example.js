// Example: How to import your zones from KML/GeoJSON

// Step 1: Your GeoJSON data (from KML conversion)
const yourGeoJSON = {
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
    },
    {
      "type": "Feature",
      "properties": {
        "zone_key": "city_center", 
        "name": "City Center"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [31.04, 31.37], [31.06, 31.37],
          [31.06, 31.39], [31.04, 31.39],
          [31.04, 31.37]
        ]]
      }
    }
    // Add your other 8 zones here...
  ]
};

// Step 2: Import using Firebase function
async function importMyZones() {
  try {
    const result = await firebase.functions().httpsCallable('importZones')({
      geojson: yourGeoJSON
    });
    
    if (result.data.success) {
      console.log('✅ Zones imported successfully!');
      console.log('Imported zones:', result.data.zones);
    } else {
      console.error('❌ Import failed:', result.data.error);
    }
  } catch (error) {
    console.error('❌ Error importing zones:', error);
  }
}

// Step 3: Test zone detection
async function testZones() {
  const testPoints = [
    { lat: 31.04, lng: 31.37, name: 'University area' },
    { lat: 31.05, lng: 31.38, name: 'City center area' },
    { lat: 31.08, lng: 31.40, name: 'Outside zones' }
  ];
  
  for (const point of testPoints) {
    const result = await firebase.functions().httpsCallable('debugZone')({
      lat: point.lat,
      lng: point.lng
    });
    
    console.log(`${point.name}:`, result.data.zoneInfo);
  }
}

// Usage:
// importMyZones();
// testZones(); 