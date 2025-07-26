import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { saveTrip, analyzeSimilarTrips } from '../../firestoreHelpers';

export default function FareResults() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [paidFare, setPaidFare] = useState(params.paidFare || '');
  const [showResults, setShowResults] = useState(!!params.paidFare);
  const [inputValue, setInputValue] = useState(params.paidFare || '');
  const [saving, setSaving] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  useEffect(() => {
    if (!params.paidFare) {
      setPaidFare('');
      setShowResults(false);
      setInputValue('');
    } else {
      setPaidFare(params.paidFare);
      setShowResults(true);
      setInputValue(params.paidFare);
    }
  }, [params.paidFare, params.from, params.to, params.estimate]);

  // Load analysis data when component mounts
  useEffect(() => {
    loadAnalysisData();
  }, []);

  const loadAnalysisData = async () => {
    if (!params.tripData) return;
    
    setLoadingAnalysis(true);
    try {
      const tripData = JSON.parse(params.tripData);
      const analysis = await analyzeSimilarTrips(tripData);
      setAnalysisData(analysis);
    } catch (error) {
      console.error('Error loading analysis:', error);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handlePaidFareSubmit = async () => {
    if (!inputValue) return;
    setPaidFare(inputValue);
    setShowResults(true);
    
    // If we have trip data and we're in estimate mode, save the trip
    if (params.tripData) {
      setSaving(true);
      try {
        const tripData = JSON.parse(params.tripData);
        // Update the trip data with the paid fare
        tripData.fare = Number(inputValue);
        
        const success = await saveTrip(tripData);
        if (success) {
          Alert.alert('تم حفظ الرحلة بنجاح');
        } else {
          Alert.alert('حدث خطأ أثناء حفظ الرحلة');
        }
      } catch (error) {
        console.error('Error saving trip:', error);
        Alert.alert('حدث خطأ أثناء حفظ الرحلة');
      } finally {
        setSaving(false);
      }
    }
  };

  // Get analysis data or fallback to mock data
  const getAnalysisData = () => {
    if (!analysisData || !analysisData.success) {
      return {
        hasData: false,
        fareDistribution: [10, 20, 30, 40, 30, 20, 10],
        timeOfDay: {
          morning: { avg: 35, count: 15 },
          afternoon: { avg: 32, count: 20 },
          evening: { avg: 38, count: 18 },
          night: { avg: 30, count: 12 }
        },
        dayOfWeek: {
          sunday: { avg: 36, count: 8 },
          monday: { avg: 38, count: 12 },
          tuesday: { avg: 35, count: 10 },
          wednesday: { avg: 34, count: 9 },
          thursday: { avg: 37, count: 11 },
          friday: { avg: 40, count: 15 },
          saturday: { avg: 42, count: 18 }
        },
        averageFare: 36,
        fareRange: { min: 25, max: 50 }
      };
    }

    const data = analysisData.data;
    
    // Check if we have any similar trips
    const hasData = data.similarTripsCount > 0;
    
    if (!hasData) {
      return {
        hasData: false,
        fareDistribution: [],
        timeOfDay: { morning: { avg: 0, count: 0 }, afternoon: { avg: 0, count: 0 }, evening: { avg: 0, count: 0 }, night: { avg: 0, count: 0 } },
        dayOfWeek: { sunday: { avg: 0, count: 0 }, monday: { avg: 0, count: 0 }, tuesday: { avg: 0, count: 0 }, wednesday: { avg: 0, count: 0 }, thursday: { avg: 0, count: 0 }, friday: { avg: 0, count: 0 }, saturday: { avg: 0, count: 0 } },
        averageFare: 0,
        fareRange: { min: 0, max: 0 }
      };
    }
    
    // Create fare distribution data
    const fareDistribution = data.fareDistribution.length > 0 
      ? data.fareDistribution.map(item => item.count * 2) // Scale for visualization
      : [10, 20, 30, 40, 30, 20, 10];

    // Time of day data
    const timeOfDay = data.timeBasedAverage || {
      morning: { avg: 35, count: 15 },
      afternoon: { avg: 32, count: 20 },
      evening: { avg: 38, count: 18 },
      night: { avg: 30, count: 12 }
    };

    // Day of week data
    const dayOfWeek = data.dayBasedAverage || {
      sunday: { avg: 36, count: 8 },
      monday: { avg: 38, count: 12 },
      tuesday: { avg: 35, count: 10 },
      wednesday: { avg: 34, count: 9 },
      thursday: { avg: 37, count: 11 },
      friday: { avg: 40, count: 15 },
      saturday: { avg: 42, count: 18 }
    };

    return {
      hasData: true,
      fareDistribution,
      timeOfDay,
      dayOfWeek,
      averageFare: data.averageFare || 36,
      fareRange: data.fareRange || { min: 25, max: 50 }
    };
  };

  const analysis = getAnalysisData();

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>نتيجة الأجرة</Text>
        {!showResults && (
          <View style={styles.paidInputBox}>
            <Text style={styles.paidInputLabel}>كم دفعت؟</Text>
            <TextInput
              style={styles.paidInput}
              placeholder="الأجرة المدفوعة (جنيه)"
              keyboardType="numeric"
              value={inputValue}
              onChangeText={setInputValue}
            />
            <TouchableOpacity 
              style={styles.paidInputButton} 
              onPress={handlePaidFareSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.paidInputButtonText}>تأكيد</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>الأجرة المتوقعة</Text>
          <Text style={styles.estimateValue}>{params.estimate || 38} جنيه</Text>
          {showResults && paidFare && (
            <>
              <Text style={styles.summaryLabel}>ما دفعته فعلياً</Text>
              <Text style={styles.paidValue}>{paidFare} جنيه</Text>
            </>
          )}
        </View>

        {loadingAnalysis && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#d32f2f" />
            <Text style={styles.loadingText}>جاري تحليل الرحلات المشابهة...</Text>
          </View>
        )}

        {analysisData && analysisData.success && analysisData.data.similarTripsCount > 0 && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>معلومات إضافية</Text>
            <Text style={styles.infoText}>
              تم العثور على {analysisData.data.similarTripsCount} رحلة مشابهة
            </Text>
            <Text style={styles.infoText}>
              نطاق الأجرة: {analysisData.data.fareRange.min} - {analysisData.data.fareRange.max} جنيه
            </Text>
          </View>
        )}

        {analysisData && analysisData.success && analysisData.data.similarTripsCount === 0 && (
          <View style={styles.noDataBox}>
            <Text style={styles.noDataTitle}>لا توجد بيانات كافية</Text>
            <Text style={styles.noDataText}>
              أنت أول من يسجل رحلة لهذا المسار في منطقتك
            </Text>
            <Text style={styles.noDataText}>
              ساعد الآخرين بمعرفة الأجرة المدفوعة!
            </Text>
          </View>
        )}
        {/* Fare Distribution Graph - Only show if we have data */}
        {analysis.hasData && analysis.fareDistribution.length > 0 && (
          <View style={styles.analysisBox}>
            <Text style={styles.analysisTitle}>توزيع الأجرة</Text>
            <Text style={styles.analysisSubtitle}>
              نطاق السعر: {analysis.fareRange.min} - {analysis.fareRange.max} جنيه
            </Text>
            <View style={styles.fareDistributionContainer}>
              {analysis.fareDistribution.map((height, index) => {
                const fareValue = analysis.fareRange.min + (index * (analysis.fareRange.max - analysis.fareRange.min) / analysis.fareDistribution.length);
                const isYourFare = paidFare && fareValue <= Number(paidFare) && fareValue + ((analysis.fareRange.max - analysis.fareRange.min) / analysis.fareDistribution.length) > Number(paidFare);
                return (
                  <View key={index} style={styles.distributionBarContainer}>
                    <View 
                      style={[
                        styles.distributionBar, 
                        { 
                          height: 20 + height,
                          backgroundColor: isYourFare ? '#1976d2' : '#d32f2f'
                        }
                      ]} 
                    />
                    <Text style={styles.distributionLabel}>{Math.round(fareValue)}</Text>
                  </View>
                );
              })}
            </View>
            {paidFare && (
              <Text style={styles.yourFareLabel}>
                أجرة رحلتك: {paidFare} جنيه
              </Text>
            )}
          </View>
        )}

        {/* Time of Day Comparison - Only show if we have meaningful data */}
        {analysis.hasData && Object.values(analysis.timeOfDay).some(d => d.count > 0) && (
          <View style={styles.analysisBox}>
            <Text style={styles.analysisTitle}>الأجرة حسب الوقت</Text>
            <Text style={styles.analysisSubtitle}>أفضل وقت للسفر</Text>
            <View style={styles.timeComparisonContainer}>
              {Object.entries(analysis.timeOfDay).map(([time, data]) => {
                const timeLabels = {
                  morning: 'صباحاً',
                  afternoon: 'ظهراً',
                  evening: 'مساءً',
                  night: 'ليلاً'
                };
                const maxAvg = Math.max(...Object.values(analysis.timeOfDay).map(d => d.avg));
                const barHeight = maxAvg > 0 ? (data.avg / maxAvg) * 60 : 0;
                const isBestTime = data.avg === Math.min(...Object.values(analysis.timeOfDay).map(d => d.avg));
                
                return (
                  <View key={time} style={styles.timeBarContainer}>
                    <Text style={styles.timeLabel}>{timeLabels[time]}</Text>
                    <View style={styles.timeBarWrapper}>
                      <View 
                        style={[
                          styles.timeBar, 
                          { 
                            height: barHeight,
                            backgroundColor: isBestTime ? '#4caf50' : '#d32f2f'
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.timeValue}>{data.avg} جنيه</Text>
                    <Text style={styles.timeCount}>({data.count} رحلة)</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Day of Week Comparison - Only show if we have meaningful data */}
        {analysis.hasData && Object.values(analysis.dayOfWeek).some(d => d.count > 0) && (
          <View style={styles.analysisBox}>
            <Text style={styles.analysisTitle}>الأجرة حسب اليوم</Text>
            <Text style={styles.analysisSubtitle}>أفضل يوم للسفر</Text>
            <View style={styles.dayComparisonContainer}>
              {Object.entries(analysis.dayOfWeek).map(([day, data]) => {
                const dayLabels = {
                  sunday: 'الأحد',
                  monday: 'الاثنين',
                  tuesday: 'الثلاثاء',
                  wednesday: 'الأربعاء',
                  thursday: 'الخميس',
                  friday: 'الجمعة',
                  saturday: 'السبت'
                };
                const maxAvg = Math.max(...Object.values(analysis.dayOfWeek).map(d => d.avg));
                const barHeight = maxAvg > 0 ? (data.avg / maxAvg) * 60 : 0;
                const isBestDay = data.avg === Math.min(...Object.values(analysis.dayOfWeek).map(d => d.avg));
                
                return (
                  <View key={day} style={styles.dayBarContainer}>
                    <Text style={styles.dayLabel}>{dayLabels[day]}</Text>
                    <View style={styles.dayBarWrapper}>
                      <View 
                        style={[
                          styles.dayBar, 
                          { 
                            height: barHeight,
                            backgroundColor: isBestDay ? '#4caf50' : '#d32f2f'
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.dayValue}>{data.avg} جنيه</Text>
                    <Text style={styles.dayCount}>({data.count} رحلة)</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 24,
    textAlign: 'center',
  },
  paidInputBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  paidInputLabel: {
    fontSize: 16,
    color: '#222',
    marginBottom: 8,
  },
  paidInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    width: 120,
    textAlign: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  paidInputButton: {
    backgroundColor: '#d32f2f',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  paidInputButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#888',
    marginBottom: 4,
  },
  estimateValue: {
    fontSize: 32,
    color: '#d32f2f',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  paidValue: {
    fontSize: 28,
    color: '#1976d2',
    fontWeight: 'bold',
    marginTop: 4,
  },
  analysisBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
    textAlign: 'center',
  },
  analysisSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  // Fare Distribution Graph Styles
  fareDistributionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  distributionBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  distributionBar: {
    width: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  distributionLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  yourFareLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
    textAlign: 'center',
    marginTop: 8,
  },
  // Time of Day Comparison Styles
  timeComparisonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  timeBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  timeBarWrapper: {
    height: 60,
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  timeBar: {
    width: 20,
    borderRadius: 10,
    minHeight: 8,
  },
  timeValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
  },
  timeCount: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
  },
  // Day of Week Comparison Styles
  dayComparisonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  dayBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  dayLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  dayBarWrapper: {
    height: 60,
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  dayBar: {
    width: 16,
    borderRadius: 8,
    minHeight: 8,
  },
  dayValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
  },
  dayCount: {
    fontSize: 8,
    color: '#888',
    textAlign: 'center',
  },
  loadingBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  noDataBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    alignItems: 'center',
  },
  noDataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 4,
    textAlign: 'center',
  },
}); 