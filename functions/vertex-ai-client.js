const { PredictionServiceClient } = require('@google-cloud/aiplatform').v1;

// Vertex AI client configuration
class VertexAIClient {
  constructor() {
    this.client = null;
    this.endpoint = null;
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id';
    this.location = 'us-central1'; // Change to your preferred region
    this.modelId = process.env.VERTEX_AI_MODEL_ID || 'your-model-id';
    this.endpointId = process.env.VERTEX_AI_ENDPOINT_ID || 'your-endpoint-id';
  }

  // Initialize the client
  async initialize() {
    try {
      this.client = new PredictionServiceClient({
        apiEndpoint: `${this.location}-aiplatform.googleapis.com`,
      });
      
      this.endpoint = this.client.endpointPath(
        this.projectId,
        this.location,
        this.endpointId
      );
      
      console.log('Vertex AI client initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Vertex AI client:', error);
      return false;
    }
  }

  // Prepare features for Vertex AI prediction
  prepareFeatures(tripData) {
    // Map your features to Vertex AI format
    // Adjust the feature names based on your trained model
    return {
      distance: tripData.distance,
      duration: tripData.duration || 0,
      passenger_count: tripData.passenger_count || 1,
      time_of_day: tripData.time_of_day || 12,
      day_of_week: tripData.day_of_week || 1,
      month: tripData.month || 1,
      day_of_month: tripData.day_of_month || 1,
      speed_kmh: tripData.speed_kmh || 0,
      // Categorical features (zones)
      from_zone: tripData.from_zone || 'Unknown',
      to_zone: tripData.to_zone || 'Unknown'
    };
  }

  // Make prediction using Vertex AI
  async predictFare(tripData) {
    try {
      if (!this.client) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize Vertex AI client');
        }
      }

      const features = this.prepareFeatures(tripData);
      
      // Convert features to Vertex AI format
      const instance = {
        // Numeric features
        distance: features.distance,
        duration: features.duration,
        passenger_count: features.passenger_count,
        time_of_day: features.time_of_day,
        day_of_week: features.day_of_week,
        month: features.month,
        day_of_month: features.day_of_month,
        speed_kmh: features.speed_kmh,
        // Categorical features
        from_zone: features.from_zone,
        to_zone: features.to_zone
      };

      const request = {
        endpoint: this.endpoint,
        instances: [instance],
      };

      console.log('Making Vertex AI prediction with features:', features);
      
      const [response] = await this.client.predict(request);
      
      if (response.predictions && response.predictions.length > 0) {
        const prediction = response.predictions[0];
        console.log('Vertex AI prediction response:', prediction);
        
        // Extract the predicted fare value
        // The exact structure depends on your model output
        let predictedFare = 0;
        
        if (prediction.value) {
          // For regression models
          predictedFare = prediction.value;
        } else if (prediction.scores) {
          // For classification models (if you have fare ranges)
          predictedFare = prediction.scores[0]; // Adjust based on your model
        } else if (typeof prediction === 'number') {
          // Direct numeric prediction
          predictedFare = prediction;
        }
        
        return Math.max(0, predictedFare); // Ensure non-negative fare
      }
      
      throw new Error('No prediction received from Vertex AI');
      
    } catch (error) {
      console.error('Error making Vertex AI prediction:', error);
      throw error;
    }
  }

  // Test the connection
  async testConnection() {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        return { success: false, error: 'Failed to initialize client' };
      }
      
      // Test with dummy data
      const testData = {
        distance: 10,
        duration: 20,
        passenger_count: 2,
        time_of_day: 8,
        day_of_week: 1,
        month: 1,
        day_of_month: 15,
        speed_kmh: 30,
        from_zone: 'University',
        to_zone: 'Toreil'
      };
      
      const prediction = await this.predictFare(testData);
      
      return {
        success: true,
        prediction: prediction,
        message: 'Vertex AI connection test successful'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = { VertexAIClient }; 