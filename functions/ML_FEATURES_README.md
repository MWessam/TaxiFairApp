# ML Features for Taxi Fare Prediction

This document explains the machine learning features implemented for the taxi fare prediction model using Google Vertex AI.

## ML Features Overview

### Core Features (Input to ML Model)

1. **fare** (float) - The target variable to predict
2. **distance** (float) - Distance in kilometers
3. **duration** (float) - Duration in minutes
4. **passenger_count** (int) - Number of passengers (1-10)
5. **time_of_day** (int) - Hour of day (0-23)
6. **day_of_week** (int) - Day of week (0=Sunday, 6=Saturday)
7. **date** (string) - Date in YYYY-MM-DD format
8. **month** (int) - Month of year (1-12)
9. **day_of_month** (int) - Day of month (1-31)
10. **from_zone** (string) - Starting zone name
11. **to_zone** (string) - Destination zone name

### Derived Features (Calculated automatically)

1. **speed_kmh** (float) - Average speed in km/h

*Note: Weekend and holiday patterns are learned automatically by the ML model from `day_of_week`, `month`, and `day_of_month` features*

### Geographic Features

1. **from_lat** (float) - Starting latitude
2. **from_lng** (float) - Starting longitude
3. **to_lat** (float) - Destination latitude
4. **to_lng** (float) - Destination longitude

## Zone Mapping (Mansoura)

The system includes predefined zones for Mansoura:

- **University** - University area
- **Toreil** - Toreil neighborhood
- **City Center** - Downtown area
- **Railway Station** - Train station area
- **Hospital** - Hospital area
- **Other** - Default for unmapped areas

## Data Collection

### Trip Submission
When a trip is submitted via `submitTrip`, the system automatically:

1. Validates the input data
2. Extracts ML features from the raw data
3. Stores both raw and derived features in Firestore
4. Returns the extracted ML features for verification

### Example Trip Submission
```javascript
const tripData = {
  fare: 50,
  distance: 10,
  duration: 20,
  passenger_count: 2,
  from: { lat: 31.04, lng: 31.37, name: 'University' },
  to: { lat: 31.05, lng: 31.36, name: 'Toreil' },
  start_time: '2024-01-15T08:30:00Z',
  governorate: 'Mansoura'
};
```

### Extracted ML Features
```javascript
{
  time_of_day: 8,
  day_of_week: 1, // Monday
  date: '2024-01-15',
  month: 1, // January
  day_of_month: 15,
  speed_kmh: 30,
  from_zone: 'University',
  to_zone: 'Toreil'
}
```

## Data Export for ML Training

### Export Function
Use `exportTripsForML` to export data for Vertex AI training:

```javascript
const exportData = {
  startDate: '2024-01-01',
  endDate: '2024-01-31'
};
```

### CSV Format
The export function returns data in CSV format with headers:
```
id,fare,distance,duration,passenger_count,time_of_day,day_of_week,date,month,day_of_month,speed_kmh,from_zone,to_zone,from_lat,from_lng,to_lat,to_lng,submitted_at
```

## Vertex AI Integration

### Training Data Preparation
1. Export data using `exportTripsForML`
2. Download the CSV data
3. Upload to Google Cloud Storage
4. Use Vertex AI AutoML or custom training

### Feature Engineering Considerations

#### Time-based Features
- **Rush Hours**: 7-9 AM and 5-7 PM typically have higher fares
- **Weekends**: Friday and Saturday may have different pricing patterns
- **Holidays**: Special events and holidays affect demand

#### Geographic Features
- **Zone-based**: Different zones have different base rates
- **Distance**: Primary factor in fare calculation
- **Speed**: Traffic conditions affect pricing

#### Demand Features
- **Passenger Count**: Multiple passengers may affect pricing
- **Time of Day**: Peak vs off-peak hours
- **Day of Week**: Business vs leisure patterns

## Model Deployment

### Prediction Endpoint
Once trained, the Vertex AI model can be called with:

```javascript
const predictionFeatures = {
  distance: 10,
  duration: 20,
  passenger_count: 2,
  time_of_day: 8,
  day_of_week: 1,
  month: 1,
  day_of_month: 15,
  from_zone: 'University',
  to_zone: 'Toreil',
  speed_kmh: 30
};
```

### Integration with Current System
Update the `estimateFare` function in `index.js` to call your Vertex AI model instead of the current simple average.

## Data Quality Considerations

### Validation Rules
- Distance: 0-100 km
- Duration: 0-300 minutes (5 hours max)
- Speed: 5-120 km/h
- Fare per km: 0.5-50 EGP
- Geographic bounds: Mansoura area only

### Missing Data Handling
- Duration: Can be null (speed will be null)
- Passenger count: Defaults to 1
- Coordinates: Zone will be 'Unknown' if missing

## Future Enhancements

1. **Dynamic Zone Mapping**: Expand zone definitions based on data
2. **Weather Integration**: Add weather data as a feature
3. **Traffic Data**: Real-time traffic conditions
4. **Seasonal Patterns**: Monthly and seasonal fare variations
5. **Event Detection**: Special events affecting demand

## Testing

Run the test script to verify feature extraction:
```bash
node test-ml-features.js
```

This will show you how the ML features are extracted from sample trip data. 