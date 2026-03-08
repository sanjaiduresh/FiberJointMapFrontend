import { useState, useCallback } from 'react';

interface GeolocationResult {
  lat: number | null;
  lng: number | null;
  error: string | null;
  loading: boolean;
  getLocation: () => void;
}

export function useGeolocation(): GeolocationResult {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied. Please allow GPS access in your browser settings.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable. Make sure GPS is enabled on your device.');
            break;
          case err.TIMEOUT:
            setError('Location request timed out. Please try again.');
            break;
          default:
            setError('Failed to get your location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  return { lat, lng, error, loading, getLocation };
}
