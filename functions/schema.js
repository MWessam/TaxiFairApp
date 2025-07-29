const { z } = require('zod');

// Geographic coordinate schema (lat/lng roughly covering Egypt bounds)
const coordSchema = z.object({
  lat: z.number().min(22, { message: 'Latitude must be ≥22' }).max(32, { message: 'Latitude must be ≤32' }),
  lng: z.number().min(25, { message: 'Longitude must be ≥25' }).max(37, { message: 'Longitude must be ≤37' })
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
  governorate: z.string().optional()
});

module.exports = { tripSchema }; 