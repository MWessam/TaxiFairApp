import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import adService from '../services/adService';

const PremiumUpgradeModal = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    
    try {
      // Here you would integrate with your payment system
      // For now, we'll simulate a successful purchase
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Set premium status
      await adService.setPremiumStatus(true);
      
      Alert.alert(
        'تم الترقية بنجاح!',
        'تم إزالة جميع الإعلانات من التطبيق.',
        [{ text: 'حسناً', onPress: onClose }]
      );
    } catch (error) {
      Alert.alert(
        'خطأ',
        'حدث خطأ أثناء الترقية. يرجى المحاولة مرة أخرى.',
        [{ text: 'حسناً' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>ترقية إلى النسخة المميزة</Text>
          
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>المميزات:</Text>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitText}>• إزالة جميع الإعلانات</Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitText}>• تجربة مستخدم أفضل</Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitText}>• دعم التطبيق</Text>
            </View>
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.price}>$2.99</Text>
            <Text style={styles.priceDescription}>دفعة واحدة</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.upgradeButton]}
              onPress={handleUpgrade}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.colors.background} />
              ) : (
                <Text style={styles.upgradeButtonText}>ترقية الآن</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>لاحقاً</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 24,
    margin: 20,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  benefitsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    flex: 1,
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  priceDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButton: {
    backgroundColor: theme.colors.primary,
  },
  upgradeButtonText: {
    color: theme.colors.background,
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontSize: 16,
  },
});

export default PremiumUpgradeModal; 