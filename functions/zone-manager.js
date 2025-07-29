// Zone Manager for Complex Polygon Zones
const pointInPolygon = require('point-in-polygon');

// Mansoura zones with complex polygon boundaries
// Converted from your CSV data
const MANSOURA_ZONES = {
  'qanat_al_suez': {
    name: 'Qanat Al Suez',
    polygon: [
      [31.0468034, 31.3954479], [31.0485499, 31.4084083], [31.0551771, 31.411752], 
      [31.0560595, 31.4086836], [31.0547084, 31.4055186], [31.0536147, 31.4030724], 
      [31.0524014, 31.4002293], [31.0510594, 31.3971286], [31.0496623, 31.395294], 
      [31.0468034, 31.3954479]
    ]
  },
  'mohafza': {
    name: 'Mohafza',
    polygon: [
      [31.0496623, 31.395294], [31.0512065, 31.3973476], [31.0533573, 31.3957812], 
      [31.0512433, 31.3932921], [31.0504896, 31.3914253], [31.0498462, 31.3898803], 
      [31.0414447, 31.3897086], [31.042272, 31.3922529], [31.0440185, 31.3951835], 
      [31.0496623, 31.395294]
    ]
  },
  'toreil': {
    name: 'Toreil',
    polygon: [
      [31.0533573, 31.3957812], [31.0512065, 31.3973476], [31.0560595, 31.4086836], 
      [31.0607345, 31.4020105], [31.0613779, 31.4011308], [31.0533573, 31.3957812]
    ]
  },
  'olongeel': {
    name: 'Olongeel',
    polygon: [
      [31.0613779, 31.4011308], [31.0597241, 31.4033122], [31.0654589, 31.4052434], 
      [31.066525, 31.4059944], [31.0659, 31.4078183], [31.0669477, 31.4093847], 
      [31.0687489, 31.4107795], [31.0711566, 31.4076037], [31.0675175, 31.4044495], 
      [31.0613779, 31.4011308]
    ]
  },
  'gedila': {
    name: 'Gedila',
    polygon: [
      [31.0659, 31.4078183], [31.066525, 31.4059944], [31.0654589, 31.4052434], 
      [31.0597241, 31.4033122], [31.0570647, 31.4074142], [31.0560198, 31.4087892], 
      [31.0551771, 31.411752], [31.0629959, 31.4161868], [31.0654773, 31.4138479], 
      [31.0687489, 31.4107795], [31.0659, 31.4078183]
    ]
  },
  'mashaya_tayeba': {
    name: 'Mashaya Tayeba',
    polygon: [
      [31.0484352, 31.3860619], [31.047541, 31.3738188], [31.0471917, 31.3738831], 
      [31.0465667, 31.3739475], [31.0420371, 31.3718717], [31.0399206, 31.3697849], 
      [31.0414447, 31.3897086], [31.0463211, 31.3891303], [31.0495474, 31.3889265], 
      [31.0484352, 31.3860619]
    ]
  },
  'mashayah_al_sherera': {
    name: 'Mashayah Al Sherera',
    polygon: [
      [31.0454382, 31.3483541], [31.0443351, 31.3485687], [31.040842, 31.349942], 
      [31.040695, 31.3518946], [31.0352528, 31.3586538], [31.0393251, 31.3630739], 
      [31.0379555, 31.367623], [31.0420371, 31.3718717], [31.044905, 31.3730089], 
      [31.0470008, 31.3735668], [31.047541, 31.3738188], [31.047681, 31.3721506], 
      [31.0480854, 31.3678591], [31.0474788, 31.3632242], [31.0471846, 31.3558428], 
      [31.0459897, 31.3501565], [31.0454382, 31.3483541]
    ]
  },
  'hay_el_gamaa': {
    name: 'Hay El Gamaa',
    polygon: [
      [31.0406153, 31.3499695], [31.0346584, 31.3508708], [31.0324521, 31.3533598], 
      [31.0295837, 31.3605696], [31.0279289, 31.3607413], [31.0267888, 31.3645178], 
      [31.0307973, 31.3670069], [31.0365521, 31.3707405], [31.0383356, 31.3662344], 
      [31.0393528, 31.3634174], [31.0352528, 31.3586538], [31.040695, 31.3518946], 
      [31.0406153, 31.3499695]
    ]
  },
  'abdelsalam_aref': {
    name: 'Abdelsalam Aref',
    polygon: [
      [31.035956, 31.3942882], [31.0440185, 31.3951835], [31.0414447, 31.3897086], 
      [31.0405204, 31.3793875], [31.0399206, 31.3697849], [31.0379555, 31.367623], 
      [31.0365521, 31.3707405], [31.0267888, 31.3645178], [31.0258113, 31.3698173], 
      [31.0247149, 31.3758834], [31.0339887, 31.3843533], [31.035956, 31.3942882]
    ]
  },
  'geish_street': {
    name: 'Geish Street',
    polygon: [
      [31.0468034, 31.3954479], [31.035956, 31.3942882], [31.0339887, 31.3843533], 
      [31.0179972, 31.3916114], [31.019689, 31.3938001], [31.0485499, 31.4084083], 
      [31.0474391, 31.4006755], [31.0468034, 31.3954479]
    ]
  }
};

// Helper function to calculate distance from point to polygon
function distanceToPolygon(point, polygon) {
  let minDistance = Infinity;
  
  // Calculate distance to each edge of the polygon
  for (let i = 0; i < polygon.length - 1; i++) {
    const p1 = polygon[i];
    const p2 = polygon[i + 1];
    
    // Distance from point to line segment
    const distance = distanceToLineSegment(point, p1, p2);
    minDistance = Math.min(minDistance, distance);
  }
  
  return minDistance;
}

// Helper function to calculate distance from point to line segment
function distanceToLineSegment(point, lineStart, lineEnd) {
  const [px, py] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;
  
  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  const dx = px - xx;
  const dy = py - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}

// Function to determine zone from coordinates using polygon boundaries
function getZoneFromCoordinates(lat, lng) {
  const point = [lat, lng];
  
  // First, check if point is inside any polygon
  for (const [zoneKey, zone] of Object.entries(MANSOURA_ZONES)) {
    if (pointInPolygon(point, zone.polygon)) {
      return zone.name;
    }
  }
  
  // If not inside any polygon, find the nearest zone
  let nearestZone = 'Other';
  let nearestDistance = Infinity;
  
  for (const [zoneKey, zone] of Object.entries(MANSOURA_ZONES)) {
    const distance = distanceToPolygon(point, zone.polygon);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestZone = zone.name;
    }
  }
  
  return nearestZone;
}

// Function to add a new zone
function addZone(zoneKey, zoneName, polygonCoordinates) {
  MANSOURA_ZONES[zoneKey] = {
    name: zoneName,
    polygon: polygonCoordinates
  };
}

// Function to remove a zone
function removeZone(zoneKey) {
  delete MANSOURA_ZONES[zoneKey];
}

// Function to get all zones
function getAllZones() {
  return MANSOURA_ZONES;
}

// Function to get zone with distance information (for debugging)
function getZoneWithDistance(lat, lng) {
  const point = [lat, lng];
  
  // First, check if point is inside any polygon
  for (const [zoneKey, zone] of Object.entries(MANSOURA_ZONES)) {
    if (pointInPolygon(point, zone.polygon)) {
      return {
        zone: zone.name,
        zoneKey: zoneKey,
        distance: 0,
        method: 'inside'
      };
    }
  }
  
  // If not inside any polygon, find the nearest zone
  let nearestZone = 'Other';
  let nearestZoneKey = 'other';
  let nearestDistance = Infinity;
  
  for (const [zoneKey, zone] of Object.entries(MANSOURA_ZONES)) {
    const distance = distanceToPolygon(point, zone.polygon);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestZone = zone.name;
      nearestZoneKey = zoneKey;
    }
  }
  
  return {
    zone: nearestZone,
    zoneKey: nearestZoneKey,
    distance: nearestDistance,
    method: 'nearest'
  };
}

// Function to validate polygon coordinates
function validatePolygon(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 3) {
    return { valid: false, error: 'Polygon must have at least 3 points' };
  }
  
  for (const coord of coordinates) {
    if (!Array.isArray(coord) || coord.length !== 2) {
      return { valid: false, error: 'Each coordinate must be [lat, lng]' };
    }
    
    const [lat, lng] = coord;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return { valid: false, error: 'Coordinates must be numbers' };
    }
    
    if (lat < 30.9 || lat > 31.2 || lng < 31.3 || lng > 31.5) {
      return { valid: false, error: 'Coordinates outside Mansoura area' };
    }
  }
  
  return { valid: true };
}

// Function to import zones from GeoJSON
function importZonesFromGeoJSON(geojson) {
  try {
    const zones = {};
    
    geojson.features.forEach(feature => {
      const zoneKey = feature.properties.zone_key || feature.properties.name?.toLowerCase().replace(/\s+/g, '_');
      const zoneName = feature.properties.name || feature.properties.zone_name;
      
      if (feature.geometry.type === 'Polygon') {
        zones[zoneKey] = {
          name: zoneName,
          polygon: feature.geometry.coordinates[0] // First ring of polygon
        };
      }
    });
    
    return { success: true, zones };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Function to export zones to GeoJSON
function exportZonesToGeoJSON() {
  const features = Object.entries(MANSOURA_ZONES).map(([zoneKey, zone]) => ({
    type: 'Feature',
    properties: {
      zone_key: zoneKey,
      name: zone.name
    },
    geometry: {
      type: 'Polygon',
      coordinates: [zone.polygon]
    }
  }));
  
  return {
    type: 'FeatureCollection',
    features
  };
}

module.exports = {
  getZoneFromCoordinates,
  getZoneWithDistance,
  addZone,
  removeZone,
  getAllZones,
  validatePolygon,
  importZonesFromGeoJSON,
  exportZonesToGeoJSON,
  MANSOURA_ZONES
}; 