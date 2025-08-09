import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function TrackRideWeb() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to home page since track ride is not available on web
    router.replace('/');
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.message}>
        Track Ride feature is not available on web. Redirecting to home...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
