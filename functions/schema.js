const { z } = require('zod');

// Geographic coordinate schema (lat/lng roughly covering Egypt bounds)
const coordSchema = z.object({
  lat: z.number().min(22, { message: 'Latitude must be ≥22' }).max(32, { message: 'Latitude must be ≤32' }),
  lng: z.number().min(25, { message: 'Longitude must be ≥25' }).max(37, { message: 'Longitude must be ≤37' }),
  name: z.string().optional(),
  zone: z.string().optional() // Zone name like 'University', 'Toreil', etc.
});

// Main trip submission schema
const tripSchema = z.object({
  fare: z.number({ required_error: 'Fare is required' })
          .positive('Fare must be greater than 0')
          .max(1000, 'Fare seems too high (max 1000 EGP)'),
  distance: z.number({ required_error: 'Distance is required' })
            .positive('Distance must be greater than 0')
            .max(100, 'Distance seems too high (max 100 km)'),
  duration: z.number().positive('Duration must be greater than 0').max(300, 'Duration seems too long (max 5 hours)').optional(),
  passenger_count: z.number().int().min(1).max(10).optional(),
  from: coordSchema.optional(),
  to: coordSchema.optional(),
  start_time: z.string().optional(), // ISO string; additional checks in code
  governorate: z.string().optional(),
  
  // ML Model specific fields (will be derived from above data)
  time_of_day: z.number().int().min(0).max(23).optional(), // 0-23 hour
  day_of_week: z.number().int().min(0).max(6).optional(), // 0=Sunday, 6=Saturday
  date: z.string().optional(), // YYYY-MM-DD format
  month: z.number().int().min(1).max(12).optional(), // 1-12
  day_of_month: z.number().int().min(1).max(31).optional(), // 1-31
  speed_kmh: z.number().positive().max(120).optional(), // Derived from distance/duration
  from_zone: z.string().optional(), // Zone name for ML
  to_zone: z.string().optional() // Zone name for ML
});

module.exports = { tripSchema }; 