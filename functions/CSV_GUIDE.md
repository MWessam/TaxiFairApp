# 📊 CSV Training Data Guide

## **File: `training_data_template.csv`**

This CSV file contains all the features needed to train your Vertex AI model for taxi fare prediction in Mansoura, Egypt.

## **📋 Column Descriptions:**

### **Target Variable:**
- **`fare`** - The actual fare paid (in EGP) - This is what we want to predict!

### **Input Features:**
- **`distance`** - Trip distance in kilometers (float)
- **`duration`** - Trip duration in minutes (float)
- **`passenger_count`** - Number of passengers (integer, 1-10)

### **Time Features:**
- **`time_of_day`** - Hour of day (0-23, where 0 = midnight)
- **`day_of_week`** - Day of week (0-6, where 0 = Sunday, 6 = Saturday)
- **`date`** - Date in YYYY-MM-DD format
- **`month`** - Month number (1-12)
- **`day_of_month`** - Day of month (1-31)

### **Derived Features:**
- **`speed_kmh`** - Average speed in km/h (calculated as distance/duration * 60)

### **Zone Features:**
- **`from_zone`** - Starting zone name (use exact zone names below)
- **`to_zone`** - Destination zone name (use exact zone names below)

## **🗺️ Available Zones (Mansoura):**

Use these exact zone names in your CSV:

1. `qanat_al_suez` - Qanat Al Suez
2. `mohafza` - Mohafza
3. `toreil` - Toreil
4. `olongeel` - Olongeel
5. `gedila` - Gedila
6. `mashaya_tayeba` - Mashaya Tayeba
7. `mashayah_al_sherera` - Mashayah Al Sherera
8. `hay_el_gamaa` - Hay El Gamaa
9. `abdelsalam_aref` - Abdelsalam Aref
10. `geish_street` - Geish Street

## **📝 How to Fill Out:**

### **1. Collect Real Trip Data:**
- Ask taxi drivers for their trip records
- Use your app to collect real trips
- Record actual fares, distances, and times

### **2. Calculate Derived Features:**
- **`speed_kmh`** = (`distance` / `duration`) × 60
- **`time_of_day`** = Hour from `start_time` (0-23)
- **`day_of_week`** = Day number (0=Sunday, 6=Saturday)
- **`month`** = Month number from date
- **`day_of_month`** = Day number from date

### **3. Determine Zones:**
- Use the zone lookup table or your app's zone detection
- Make sure zone names match exactly (lowercase, underscores)

## **📊 Example Data Collection:**

```
Real Trip Example:
- Fare: 45 EGP
- Distance: 8.3 km
- Duration: 20 minutes
- Passengers: 2
- Start Time: 2024-01-15 14:30:00
- From: Qanat Al Suez area
- To: Mohafza area

CSV Row:
45,8.3,20,2,14,2,2024-01-15,1,15,24.9,qanat_al_suez,mohafza
```

## **🎯 Tips for Good Data:**

1. **Collect diverse data:**
   - Different times of day
   - Different days of week
   - Different distances
   - Different passenger counts

2. **Include edge cases:**
   - Very short trips (1-2 km)
   - Very long trips (15+ km)
   - Peak hours vs off-peak
   - Weekend vs weekday

3. **Aim for 1000+ trips** for good model training

4. **Validate your data:**
   - Check for reasonable fares (10-200 EGP)
   - Check for reasonable speeds (10-50 km/h)
   - Check for reasonable distances (1-30 km)

## **📈 Data Quality Checklist:**

- [ ] No missing values
- [ ] Realistic fare ranges (10-200 EGP)
- [ ] Realistic distance ranges (1-30 km)
- [ ] Realistic duration ranges (5-120 minutes)
- [ ] Valid zone names
- [ ] Correct date formats
- [ ] Logical speed calculations

## **🚀 Next Steps:**

1. Fill out the CSV with real trip data
2. Save as `training_data.csv`
3. Upload to Google Cloud Storage
4. Use for Vertex AI model training

**Need help with data collection or have questions? Check the main README!** 