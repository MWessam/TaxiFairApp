# Enhanced Trip Validation and Rate Limiting Guide

## Overview

This guide documents the enhanced validation and rate limiting features implemented in the Firebase Functions for the TaxiFairMock application. The system now includes comprehensive trip validation, user-based rate limiting, and admin role management.

## New Features

### 1. Updated Rate Limiting
- **Hourly Limit**: 5 trips per hour per user (down from 20)
- **Daily Limit**: 20 trips per day per user (down from 100)
- **User-based**: Rate limiting now uses `user_id` instead of `device_id`
- **Admin Bypass**: Admin users bypass all rate limiting restrictions

### 2. Duplicate Trip Detection
- Prevents submission of trips with same date, time, from/to locations
- 30-minute time window for duplicate detection
- Checks against user's own trip history

### 3. Trip Time Validation
- Calculates latest trip end time per user
- Prevents new trips that start before the latest trip ends
- Includes caching for performance optimization
- 1-hour cache validity for latest trip end times

### 4. Same Zone Destination Protection
- Prevents trips from same zone to same destination within 30 minutes
- Only applies when from_zone equals to_zone
- Per-user restriction

### 5. Admin Role System
- Admin users bypass all validation restrictions
- Role-based access control for user management
- Secure role assignment and retrieval

## Firestore Collections

### New Collections

#### `users`
Stores user roles and permissions:
```javascript
{
  role: 'user' | 'admin',
  updated_by: 'user_id',
  updated_at: timestamp
}
```

#### `trip_cache`
Caches latest trip end times for performance:
```javascript
{
  latest_end_time: 'ISO string' | null,
  timestamp: timestamp
}
```

#### `rate_limits` (Updated)
Now uses user-based keys:
```javascript
{
  hourSlot: number,
  hourCount: number,
  daySlot: number,
  dayCount: number,
  expiresAt: timestamp
}
```

### Updated Collections

#### `trips` (Enhanced)
New fields added:
```javascript
{
  // ... existing fields ...
  user_id: 'string',           // Required user identifier
  is_admin_submission: boolean, // Whether submitted by admin
  // ... existing fields ...
}
```

## API Functions

### 1. submitTrip (Enhanced)
**Endpoint**: `submitTrip`

**New Validation Flow**:
1. Extract user ID from request
2. Check admin role (bypasses restrictions if admin)
3. Apply rate limiting (non-admin users only)
4. Validate trip data with Zod schema
5. Extract ML features
6. Apply validation rules (non-admin users only):
   - Duplicate trip detection
   - Same zone destination check
   - Trip time feasibility validation
7. Save trip to Firestore
8. Invalidate user's trip cache

**Response**:
```javascript
{
  success: boolean,
  status: 'accepted' | 'below_min_fare' | 'above_max_fare',
  trip_id: 'string',
  message: 'string',
  ml_features: object,
  is_admin: boolean
}
```

### 2. analyzeSimilarTrips (Enhanced)
**Endpoint**: `analyzeSimilarTrips`

**New Features**:
- User-based rate limiting
- Admin bypass for rate limiting
- Enhanced error handling

### 3. setUserRole (New)
**Endpoint**: `setUserRole`

**Purpose**: Assign admin role to users

**Parameters**:
```javascript
{
  targetUserId: 'string',
  role: 'user' | 'admin'
}
```

**Response**:
```javascript
{
  success: boolean,
  message: 'string'
}
```

### 4. getUserRole (New)
**Endpoint**: `getUserRole`

**Purpose**: Retrieve user's current role

**Parameters**:
```javascript
{
  userId: 'string' // Optional, defaults to current user
}
```

**Response**:
```javascript
{
  success: boolean,
  role: 'user' | 'admin',
  isAdmin: boolean
}
```

## Client-Side Integration

### Updated firestoreHelpers.js

The client-side helper functions have been updated to support the new features:

```javascript
// Existing functions now automatically pass user_id
export async function saveTrip(tripData) {
  // Automatically includes user_id from current user
}

export async function analyzeSimilarTrips(tripData) {
  // Automatically includes user_id from current user
}

// New admin management functions
export async function setUserRole(targetUserId, role) {
  // Set user role (admin only)
}

export async function getUserRole(userId = null) {
  // Get user role
}
```

## Validation Rules Summary

### For Regular Users
1. **Rate Limiting**: 5 trips/hour, 20 trips/day
2. **Duplicate Prevention**: No similar trips within 30 minutes
3. **Time Conflicts**: No overlapping trips
4. **Same Zone**: No repeated same-zone trips within 30 minutes
5. **Data Validation**: All existing Zod schema validations

### For Admin Users
- **Bypass All Restrictions**: No rate limiting or validation rules
- **Full Access**: Can submit unlimited trips
- **Role Management**: Can assign admin roles to other users

## Error Messages

### Rate Limiting Errors
- `Rate limit exceeded: 5 trips per hour. Please wait before submitting more trips.`
- `Rate limit exceeded: 20 trips per day. Please try again tomorrow.`

### Validation Errors
- `Duplicate trip detected. A similar trip was submitted recently.`
- `Recent trip from same zone to same destination detected. Please wait 30 minutes.`
- `Trip conflicts with existing trip. Latest trip ends at [time]`

### Authentication Errors
- `User ID is required for trip submission`
- `Authentication required`
- `Only admins can modify user roles`

## Performance Optimizations

### Caching Strategy
- **Trip End Time Cache**: 1-hour validity for latest trip end times
- **Automatic Invalidation**: Cache cleared when new trip submitted
- **Fallback Handling**: Graceful degradation if cache fails

### Database Queries
- **Indexed Fields**: `user_id`, `date`, `from_zone`, `to_zone`, `start_time`
- **Efficient Filtering**: Zone-based queries for duplicate detection
- **Limited Results**: Query limits to prevent performance issues

## Security Considerations

### Role-Based Access
- Admin roles stored securely in Firestore
- Role verification on every function call
- Audit trail for role changes

### Data Privacy
- User-specific validation rules
- No cross-user data access
- Secure role management

### Rate Limiting Security
- User-based tracking prevents abuse
- Transaction-based updates prevent race conditions
- Automatic cleanup with TTL

## Migration Guide

### For Existing Data
1. **Add user_id**: Update existing trips with appropriate user IDs
2. **Create indexes**: Ensure Firestore indexes for new query patterns
3. **Set up admin users**: Create initial admin users in the `users` collection

### For Client Applications
1. **Update calls**: Ensure all trip submissions include user authentication
2. **Handle new errors**: Add error handling for new validation messages
3. **Admin features**: Implement admin role management if needed

## Monitoring and Debugging

### Logging
- All validation failures are logged with context
- Admin actions are tracked with audit trail
- Performance metrics for cache hits/misses

### Debug Mode
- Set `DEBUG_LOGS=true` environment variable for detailed logging
- Comprehensive error messages for troubleshooting
- Validation step-by-step logging

## Best Practices

### For Developers
1. Always include user authentication in trip submissions
2. Handle all validation error cases gracefully
3. Implement proper error messaging for users
4. Use admin roles sparingly and securely

### For Administrators
1. Monitor rate limiting patterns for abuse detection
2. Review admin role assignments regularly
3. Check validation logs for unusual patterns
4. Maintain proper user role hierarchy

## Troubleshooting

### Common Issues

**Rate Limit Errors**
- Check if user is hitting hourly/daily limits
- Verify user authentication is working
- Consider admin role for testing

**Duplicate Trip Errors**
- Verify trip data is unique
- Check time windows for similar trips
- Ensure proper zone detection

**Time Conflict Errors**
- Check existing trip schedules
- Verify duration calculations
- Clear cache if needed

**Admin Role Issues**
- Verify user exists in `users` collection
- Check role assignment permissions
- Ensure proper authentication

### Debug Commands

```javascript
// Check user role
const roleResult = await getUserRole(userId);
console.log('User role:', roleResult);

// Check rate limit status
// (Internal function, not exposed to client)

// Clear user cache
// (Internal function, not exposed to client)
```

## Future Enhancements

### Planned Features
1. **Advanced Analytics**: Trip pattern analysis for admins
2. **Flexible Rate Limits**: Configurable limits per user type
3. **Geographic Restrictions**: Location-based validation rules
4. **Time-based Rules**: Dynamic validation based on time periods
5. **Bulk Operations**: Admin tools for bulk trip management

### Performance Improvements
1. **Enhanced Caching**: Redis integration for better performance
2. **Query Optimization**: Advanced indexing strategies
3. **Background Processing**: Async validation for complex rules
4. **Real-time Updates**: WebSocket integration for live updates 