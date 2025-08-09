// Web stub for backgroundTracking - no background tracking on web
export async function initializeBackgroundTracking() {
  console.log('BackgroundTracking (web): No background tracking on web');
  return false;
}

export async function startBackgroundTracking(startLocation) {
  console.log('BackgroundTracking (web): No background tracking on web');
  return false;
}

export async function stopBackgroundTracking() {
  console.log('BackgroundTracking (web): No background tracking on web');
  return false;
}

export function setupNotificationHandler() {
  console.log('BackgroundTracking (web): No notifications on web');
}

export async function getPendingFareResults() {
  console.log('BackgroundTracking (web): No pending results on web');
  return null;
}

export async function isTrackingActive() {
  return false;
}

export async function getCurrentTrackingData() {
  return null;
}

export async function clearTrackingData() {
  console.log('BackgroundTracking (web): No tracking data to clear on web');
}
