import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { saveTrip, analyzeSimilarTrips } from '../../firestoreHelpers';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { useFavorites } from '@/constants/FavoritesContext';
import adService from '../../services/adService';

// Legal tariff constants
const OFFICIAL_TARIFF_BASE_FARE = 9;
const OFFICIAL_TARIFF_PER_KM = 2;

export default function FareResults() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();
  const { addFavorite } = useFavorites();

  const [paidFare, setPaidFare] = useState(params.paidFare || '');
  const [showResults, setShowResults] = useState(!!params.paidFare);
  const [inputValue, setInputValue] = useState(params.paidFare || '');
  const [saving, setSaving] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [validationStatus, setValidationStatus] = useState(params.status || null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [addingToFavorites, setAddingToFavorites] = useState(false);

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

  // Update validation status when params change
  useEffect(() => {
    if (params.status) {
      console.log('Status:', params.status);
      setValidationStatus(params.status);
    }
  }, [params.status]);

  // Load analysis data when component mounts
  useEffect(() => {
    loadAnalysisData();
  }, []);

  const loadAnalysisData = async () => {
    if (!params.tripData) return;
    
    setLoadingAnalysis(true);
    try {
      const tripData = JSON.parse(params.tripData);
      // have them both run in parallel
      let [analysis] = await Promise.all([
        analyzeSimilarTrips(tripData).then(data => ({...data, loading: false})),
        // estimateFare(tripData).then(data => ({...data, loading: false}))
      ]);
      
      // Check if analysis was successful and has data
      if (analysis && analysis.success && analysis.data) {
        if (analysis.data.estimatedFare) {
          console.log('Estimated fare:', analysis.data.estimatedFare);
        } else {
          console.log('No estimated fare in data');
        }
        console.log(analysis);
      } else {
        console.log('Analysis failed or returned no data:', analysis);
        // Create a fallback structure
        analysis = {
          success: false,
          data: {
            estimatedFare: 0,
            similarTripsCount: 0,
            averageFare: 0,
            fareRange: { min: 0, max: 0 }
          }
        };
      }
      setAnalysisData(analysis);
      // setEstimatedFare(estimatedFare);
    } catch (error) {
      console.error('Error loading analysis:', error);
    } finally {
      console.log('Loading analysis finished');
      console.log(analysis);
      setLoadingAnalysis(false);
    }
  };

  const handlePaidFareSubmit = async () => {
    if (!inputValue) return;
    setPaidFare(inputValue);
    
    // If we have trip data and we're in estimate mode, save the trip
    if (params.tripData) {
      setSaving(true);
      try {
        const tripData = JSON.parse(params.tripData);
        // Update the trip data with the paid fare
        tripData.fare = Number(inputValue);
        
        const response = await saveTrip(tripData);
        if (response && response.status) {
          console.log('Response:', response);
          console.log('Status:', response.status);
          setValidationStatus(response.status);
          // Only show results after we get the validation status
          setShowResults(true);
        }
      } catch (error) {
        console.error('Error saving trip:', error);
        // Show results even if there's an error
        setShowResults(true);
      } finally {
        setSaving(false);
      }
    } else {
      // If no trip data, show results immediately
      setShowResults(true);
    }
  };

  const handleAddToFavorites = async () => {
    if (!params.from || !params.to) {
      Alert.alert('خطأ', 'لا يمكن إضافة مواقع غير مكتملة للمفضلة');
      return;
    }

    setAddingToFavorites(true);
    try {
      const fromLocation = {
        name: params.from,
        lat: params.from_lat ? Number(params.from_lat) : null,
        lng: params.from_lng ? Number(params.from_lng) : null
      };

      const toLocation = {
        name: params.to,
        lat: params.to_lat ? Number(params.to_lat) : null,
        lng: params.to_lng ? Number(params.to_lng) : null
      };

      // Validate both locations have coordinates
      if (!fromLocation.lat || !fromLocation.lng || !toLocation.lat || !toLocation.lng) {
        Alert.alert('خطأ', 'بيانات المواقع غير مكتملة');
        return;
      }

      // Add from location to favorites
      const fromResult = await addFavorite(fromLocation);
      // Add to location to favorites
      const toResult = await addFavorite(toLocation);

      // Show appropriate success/error message
      let successCount = 0;
      let messages = [];

      if (fromResult.success) {
        successCount++;
        messages.push(`تم حفظ موقع "${fromLocation.name}"`);
      } else if (fromResult.error !== 'هذا الموقع موجود بالفعل في المفضلة') {
        messages.push(`خطأ في حفظ موقع البداية: ${fromResult.error}`);
      }

      if (toResult.success) {
        successCount++;
        messages.push(`تم حفظ موقع "${toLocation.name}"`);
      } else if (toResult.error !== 'هذا الموقع موجود بالفعل في المفضلة') {
        messages.push(`خطأ في حفظ موقع الوجهة: ${toResult.error}`);
      }

      if (successCount > 0) {
        Alert.alert('تم!', `تم حفظ ${successCount} موقع في المفضلة`);
      } else {
        Alert.alert('تنبيه', 'المواقع موجودة بالفعل في المفضلة');
      }
    } catch (error) {
      console.error('Error adding to favorites:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إضافة المواقع للمفضلة');
    } finally {
      setAddingToFavorites(false);
    }
  };

  // Get analysis data - no mock data fallback
  const getAnalysisData = () => {
    if (!analysisData || !analysisData.success) {
      return {
        hasData: false,
        similarTripsData: [],
        timeBasedData: [],
        weeklyData: [],
        averageFare: 0,
        estimatedFare: 0,
        fareRange: { min: 0, max: 0 }
      };
    }

    const data = analysisData.data;
    const hasData = data.similarTripsCount > 0;
    
    if (!hasData) {
      return {
        hasData: false,
        similarTripsData: [],
        timeBasedData: [],
        weeklyData: [],
        averageFare: 0,
        estimatedFare: 0,
        fareRange: { min: 0, max: 0 }
      };
    }
    
    // Transform Firebase data structure to chart format
    const transformTimeBasedData = (timeData) => {
      if (!timeData || typeof timeData !== 'object') return [];
      
      const timeMapping = {
        morning: '6-12 ص',
        afternoon: '12-6 ع', 
        evening: '6-12 م',
        night: '12-6 ص'
      };
      
      return Object.entries(timeData)
        .filter(([_, value]) => value.count > 0)
        .map(([key, value]) => ({
          time: timeMapping[key] || key,
          avgFare: Math.round(value.avg)
        }));
    };

    const transformDayBasedData = (dayData) => {
      if (!dayData || typeof dayData !== 'object') return [];
      
      const dayMapping = {
        sunday: 'الأحد',
        monday: 'الاثنين', 
        tuesday: 'الثلاثاء',
        wednesday: 'الأربعاء',
        thursday: 'الخميس',
        friday: 'الجمعة',
        saturday: 'السبت'
      };
      
      return Object.entries(dayData)
        .filter(([_, value]) => value.count > 0)
        .map(([key, value]) => ({
          day: dayMapping[key] || key,
          avgFare: Math.round(value.avg)
        }));
    };

    const transformDistanceBasedData = (distanceData) => {
      if (!distanceData || typeof distanceData !== 'object') return [];
      
      const distanceMapping = {
        short: '0-5 كم',
        medium: '5-15 كم',
        long: '15+ كم'
      };
      
      return Object.entries(distanceData)
        .filter(([_, value]) => value.count > 0)
        .map(([key, value]) => ({
          distance: distanceMapping[key] || key,
          avgFare: Math.round(value.avg),
          count: value.count
        }));
    };

    return {
      hasData: true,
      similarTripsData: transformDistanceBasedData(data.distanceBasedAverage),
      timeBasedData: transformTimeBasedData(data.timeBasedAverage),
      weeklyData: transformDayBasedData(data.dayBasedAverage),
      averageFare: data.averageFare || 45,
      estimatedFare: data.estimatedFare || 0,
      fareRange: data.fareRange || { min: 25, max: 65 }
    };
  };

  const analysis = getAnalysisData();
  const styles = createStyles(theme);

  const CustomBarChart = ({ data, dataKey, title }) => {
    if (!data || data.length === 0) return null;
    
    const maxValue = Math.max(...data.map(item => item[dataKey]));
    
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.barsContainer}>
          {data.map((item, index) => {
            const barHeight = (item[dataKey] / maxValue) * 120;
            return (
              <View key={index} style={styles.barItem}>
                <View style={styles.barWrapper}>
                  <View style={[styles.bar, { height: barHeight, backgroundColor: theme.primary }]} />
                </View>
                <Text style={styles.barLabel} numberOfLines={1}>{item.distance || item.time || item.day}</Text>
                <Text style={styles.barValue}>{item[dataKey]}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={async () => {
              // Show ad when user tries to go back from results
              await adService.showAdWhenGoingBackFromResults();
              router.push('/');
            }}
          >
            <Ionicons name="arrow-forward" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>نتائج الرحلة</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Fare Summary Card */}
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <View style={styles.fareIconContainer}>
              <Ionicons name="cash" size={48} color={theme.primary} />
              <Text style={styles.fareLabel}>السعر المقترح</Text>
              {loadingAnalysis && (
                <ActivityIndicator size="small" color={theme.primary} />
              )}
              {!loadingAnalysis && analysisData && analysisData.data && (
                analysisData.data.estimatedFare && analysisData.data.estimatedFare !== 0 ?
                <Text style={styles.estimatedFare}>
                  {analysisData.data.estimatedFare} جنيه
                </Text>
                :
                <Text style={styles.estimatedFareNotFound}>
                  لا توجد رحلات او بيانات كافية لتحليل رحلتك
                </Text>

              )}

              <Text style={styles.legalFareText}>التعريفة القانونية للمشوار هيه: {OFFICIAL_TARIFF_BASE_FARE} + {OFFICIAL_TARIFF_PER_KM} * {params.distance} = {OFFICIAL_TARIFF_BASE_FARE + OFFICIAL_TARIFF_PER_KM * params.distance} جنيه</Text>

            </View>

            {showResults && paidFare ? (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>دفعت: {paidFare} جنيه</Text>
                
                {/* Calculate legal fare and percentage difference */}
                {(() => {
                  const legalFare = OFFICIAL_TARIFF_BASE_FARE + OFFICIAL_TARIFF_PER_KM * params.distance;
                  const paidAmount = parseFloat(paidFare);
                  const difference = paidAmount - legalFare;
                  const percentageDifference = ((difference / legalFare) * 100).toFixed(1);
                  
                  return (
                    <>
                      <Text style={styles.legalFareText}>
                        التعريفة القانونية: {legalFare.toFixed(1)} جنيه
                      </Text>
                      {difference > 0 ? (
                        <Text style={styles.overpaidText}>
                          دفعت أكثر من التعريفة القانونية بـ {percentageDifference}% (+{difference.toFixed(1)} جنيه)
                        </Text>
                      ) : difference < 0 ? (
                        <Text style={styles.underpaidText}>
                          دفعت أقل من التعريفة القانونية بـ {Math.abs(percentageDifference)}% (-{Math.abs(difference).toFixed(1)} جنيه)
                        </Text>
                      ) : (
                        <Text style={styles.exactFareText}>
                          دفعت التعريفة القانونية بالضبط
                        </Text>
                      )}
                    </>
                  );
                })()}
                
                {validationStatus === 'below_min_fare' && (
                  <Text style={styles.warningText}>تحذير: دفعت أقل مما يدفعه الناس عادة</Text>
                )}
                {validationStatus === 'above_max_fare' && (
                  <Text style={styles.warningText}>تحذير: دفعت أكثر مما يدفعه الناس عادة</Text>
                )}
                <Text style={styles.successSubtext}>شكراً لمساهمتك في تحسين الخدمة</Text>
              </View>
            ) : (
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.fareInput}
                  placeholder="كم دفعت فعلياً؟"
                  keyboardType="numeric"
                  value={inputValue}
                  onChangeText={setInputValue}
                  placeholderTextColor={theme.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.submitButton, { opacity: inputValue ? 1 : 0.5 }]}
                  onPress={handlePaidFareSubmit}
                  disabled={!inputValue || saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>إرسال</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Trip Details Card */}
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>تفاصيل الرحلة</Text>
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>المسافة:</Text>
                <Text style={styles.detailValue}>{params.distance || '4.2'} كم</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>المدة:</Text>
                <Text style={styles.detailValue}>{params.duration || '18'} دقيقة</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>الوقت:</Text>
                <Text style={styles.detailValue}>{params.time || '3:45 مساءً'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>من:</Text>
                <Text style={styles.detailValue} numberOfLines={1}>{params.from || 'غير محدد'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>إلى:</Text>
                <Text style={styles.detailValue} numberOfLines={1}>{params.to || 'غير محدد'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Add to Favorites Button */}
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={handleAddToFavorites}
              disabled={addingToFavorites}
            >
              <Ionicons name="heart" size={20} color="#FFFFFF" style={styles.favoriteIcon} />
              {addingToFavorites ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.favoriteButtonText}>إضافة للمفضلة</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.favoriteHint}>احفظ هذه الرحلة للوصول السريع لاحقاً</Text>
          </View>
        </View>

        {/* Loading Analysis */}
        {loadingAnalysis && (
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.loadingText}>جاري تحليل الرحلات المشابهة...</Text>
              </View>
            </View>
          </View>
        )}

        {/* Analysis Results */}
        {!loadingAnalysis && (
          <>
            {/* Data Source Info */}
            {analysisData && analysisData.success && analysisData.data && analysisData.data.similarTripsCount > 0 && (
              <View style={styles.card}>
                <View style={styles.cardContent}>
                  <View style={styles.infoContainer}>
                    <Ionicons name="information-circle" size={24} color={theme.primary} />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoTitle}>معلومات إضافية</Text>
                      <Text style={styles.infoText}>
                        تم العثور على {analysisData.data.similarTripsCount} رحلة مشابهة
                      </Text>
                      <Text style={styles.infoText}>
                        نطاق الأجرة: {analysisData.data.fareRange?.min || 25} - {analysisData.data.fareRange?.max || 65} جنيه
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Similar Trips Chart */}
            <View style={styles.card}>
              <View style={styles.cardContent}>
                <View style={styles.chartHeader}>
                  <Ionicons name="trending-up" size={20} color={theme.primary} />
                  <Text style={styles.chartHeaderText}>متوسط الأسعار للرحلات المشابهة</Text>
                </View>
                <CustomBarChart
                  data={analysis.similarTripsData.slice(0, 4)}
                  dataKey="avgFare"
                  title=""
                />
              </View>
            </View>

            {/* Time-based Chart */}
            <View style={styles.card}>
              <View style={styles.cardContent}>
                <View style={styles.chartHeader}>
                  <Ionicons name="time" size={20} color={theme.primary} />
                  <Text style={styles.chartHeaderText}>الأسعار حسب الوقت</Text>
                </View>
                <CustomBarChart
                  data={analysis.timeBasedData.slice(0, 6)}
                  dataKey="avgFare"
                  title=""
                />
              </View>
            </View>

            {/* Weekly Chart */}
            <View style={styles.card}>
              <View style={styles.cardContent}>
                <View style={styles.chartHeader}>
                  <Ionicons name="calendar" size={20} color={theme.primary} />
                  <Text style={styles.chartHeaderText}>الأسعار حسب اليوم</Text>
                </View>
                <CustomBarChart
                  data={analysis.weeklyData}
                  dataKey="avgFare"
                  title=""
                />
              </View>
            </View>

            {/* No Real Data Message - only when we have no real analysis data */}
            {(!analysisData || !analysisData.success || analysisData.data.similarTripsCount === 0) && (
              <View style={styles.card}>
                <View style={styles.cardContent}>
                  <View style={styles.noDataContainer}>
                    <Ionicons name="information-circle" size={48} color={theme.textSecondary} />
                    <Text style={styles.noDataSubText}>
                      ساعد في تحسين دقة البيانات بمشاركة رحلاتك!
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {/* Back to Home Button */}
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <TouchableOpacity
              style={styles.homeButton}
              onPress={() => router.push('/')}
            >
              <Text style={styles.homeButtonText}>العودة للرئيسية</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContent: {
    padding: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 16,
  },
  fareIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  fareLabel: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 8,
    marginBottom: 8,
  },
  estimatedFare: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.primary,
  },
  estimatedFareNotFound: {
    fontSize: 16,
    color: theme.primary,
    marginTop: 8,
    marginBottom: 8,
  },
  successContainer: {
    backgroundColor: '#F0F9F0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  successText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  successSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#FFC107', // yellow
    marginTop: 4,
  },
  legalFareText: {
    fontSize: 14,
    color: theme.text,
    marginTop: 4,
    fontWeight: '500',
  },
  overpaidText: {
    fontSize: 14,
    color: '#D32F2F', // red
    marginTop: 4,
    fontWeight: '500',
  },
  underpaidText: {
    fontSize: 14,
    color: '#388E3C', // green
    marginTop: 4,
    fontWeight: '500',
  },
  exactFareText: {
    fontSize: 14,
    color: '#1976D2', // blue
    marginTop: 4,
    fontWeight: '500',
  },
  debugText: {
    fontSize: 12,
    color: '#FF0000', // red for debugging
    marginTop: 4,
    fontStyle: 'italic',
  },
  inputContainer: {
    gap: 12,
  },
  fareInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    textAlign: 'center',
    color: theme.text,
  },
  submitButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailsContainer: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
    marginLeft: 16,
  },
  favoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E91E63',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  favoriteIcon: {
    marginLeft: 8,
  },
  favoriteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  favoriteHint: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginLeft: 8,
  },
  chartContainer: {
    marginTop: 8,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  barWrapper: {
    height: 120,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  bar: {
    width: 24,
    borderRadius: 4,
    minHeight: 8,
  },
  barLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  barValue: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.text,
    textAlign: 'center',
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noDataTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 12,
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  noDataSubText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  homeButton: {
    borderWidth: 2,
    borderColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  homeButtonText: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 32,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 2,
  },
}); 