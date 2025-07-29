# Vertex AI Integration Setup Guide

This guide explains how to set up and use Google Vertex AI with your Firebase Functions for taxi fare prediction.

## Prerequisites

1. **Google Cloud Project** with Vertex AI API enabled
2. **Service Account** with Vertex AI permissions
3. **Trained ML Model** deployed on Vertex AI
4. **Firebase Functions** with proper authentication

## Step 1: Enable Required APIs

```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Enable Cloud Functions API
gcloud services enable cloudfunctions.googleapis.com
```

## Step 2: Create Service Account

```bash
# Create service account
gcloud iam service-accounts create taxi-ml-service \
    --display-name="Taxi ML Service Account"

# Grant Vertex AI permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:taxi-ml-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

# Grant Cloud Functions permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:taxi-ml-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudfunctions.invoker"
```

## Step 3: Create and Download Service Account Key

```bash
# Create service account key
gcloud iam service-accounts keys create taxi-ml-key.json \
    --iam-account=taxi-ml-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## Step 4: Set Environment Variables

Add these to your Firebase Functions environment:

```bash
# Set environment variables
firebase functions:config:set \
    google.project_id="YOUR_PROJECT_ID" \
    vertex.location="us-central1" \
    vertex.model_id="YOUR_MODEL_ID" \
    vertex.endpoint_id="YOUR_ENDPOINT_ID"

# Or set them in Firebase Console:
# Functions > Configuration > Environment Variables
```

## Step 5: Train Your ML Model

### Option A: Using Vertex AI AutoML

1. **Prepare Data**: Export your trip data using `exportTripsForML`
2. **Upload to Cloud Storage**: Upload CSV to GCS bucket
3. **Create Dataset**: Use Vertex AI Console to create dataset
4. **Train Model**: Use AutoML Tabular for regression
5. **Deploy Model**: Deploy to endpoint

### Option B: Using Custom Training

1. **Create Training Job**: Use Vertex AI Custom Training
2. **Write Training Code**: Python script for model training
3. **Deploy Model**: Deploy to endpoint

## Step 6: Update Configuration

Update `vertex-ai-client.js` with your specific configuration:

```javascript
// Update these values in vertex-ai-client.js
this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id';
this.location = 'us-central1'; // Your preferred region
this.modelId = process.env.VERTEX_AI_MODEL_ID || 'your-model-id';
this.endpointId = process.env.VERTEX_AI_ENDPOINT_ID || 'your-endpoint-id';
```

## Step 7: Test the Integration

### Test Connection
```javascript
// Call the test function
const result = await firebase.functions().httpsCallable('testVertexAI')();
console.log(result.data);
```

### Test Prediction
```javascript
// Test with sample data
const testData = {
  distance: 10,
  duration: 20,
  passenger_count: 2,
  time_of_day: 8,
  day_of_week: 1,
  speed_kmh: 30,
  fare_per_km: 5,
  from_zone: 'University',
  to_zone: 'Toreil'
};

const prediction = await vertexAIClient.predictFare(testData);
console.log('Predicted fare:', prediction);
```

## Step 8: Activate ML Predictions

When ready to use ML predictions, update `estimateFare` function in `index.js`:

```javascript
// Uncomment the ML prediction code in estimateFare function
// Remove the "return 0;" line
// Uncomment the Vertex AI prediction code
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_CLOUD_PROJECT` | Your GCP project ID | `my-taxi-project` |
| `VERTEX_AI_LOCATION` | Vertex AI region | `us-central1` |
| `VERTEX_AI_MODEL_ID` | Your trained model ID | `taxi-fare-model-123` |
| `VERTEX_AI_ENDPOINT_ID` | Deployed endpoint ID | `taxi-fare-endpoint-456` |

## Model Features Mapping

Your Vertex AI model should expect these features:

### Numeric Features
- `distance` (float) - Distance in kilometers
- `duration` (float) - Duration in minutes
- `passenger_count` (int) - Number of passengers
- `time_of_day` (int) - Hour of day (0-23)
- `day_of_week` (int) - Day of week (0-6)
- `month` (int) - Month of year (1-12)
- `day_of_month` (int) - Day of month (1-31)
- `speed_kmh` (float) - Average speed

### Categorical Features
- `from_zone` (string) - Starting zone
- `to_zone` (string) - Destination zone

### Target Variable
- `fare` (float) - The fare to predict

## Troubleshooting

### Common Issues

1. **Authentication Error**
   ```
   Error: Failed to initialize Vertex AI client
   ```
   - Check service account permissions
   - Verify service account key is properly set

2. **Model Not Found**
   ```
   Error: Model not found
   ```
   - Verify model ID and endpoint ID
   - Check if model is deployed and active

3. **Feature Mismatch**
   ```
   Error: Invalid feature format
   ```
   - Ensure feature names match your trained model
   - Check data types (numeric vs categorical)

### Debug Mode

Enable debug logging by setting:
```bash
firebase functions:config:set debug.ml_predictions=true
```

## Cost Optimization

1. **Batch Predictions**: Group multiple predictions together
2. **Caching**: Cache predictions for similar trips
3. **Model Optimization**: Use smaller models for faster inference
4. **Monitoring**: Set up alerts for high usage

## Security Best Practices

1. **Service Account**: Use least privilege principle
2. **Environment Variables**: Never commit secrets to code
3. **Input Validation**: Validate all input data
4. **Rate Limiting**: Implement rate limiting for predictions
5. **Monitoring**: Monitor for unusual prediction patterns

## Next Steps

1. **Data Collection**: Collect more trip data for better model training
2. **Model Retraining**: Retrain model periodically with new data
3. **A/B Testing**: Compare ML predictions with current methods
4. **Feature Engineering**: Add more features based on model performance
5. **Model Monitoring**: Set up model performance monitoring 