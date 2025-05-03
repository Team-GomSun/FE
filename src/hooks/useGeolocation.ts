import { useEffect, useState } from 'react';

interface GeolocationState {
  loading: boolean;
  error: string | null;
  location: {
    latitude: number | null;
    longitude: number | null;
    timestamp: number | null;
  };
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watchPosition?: boolean;
}

export const useGeolocation = (options: UseGeolocationOptions = {}) => {
  const {
    enableHighAccuracy = true,
    timeout = 5000,
    maximumAge = 0,
    watchPosition = false,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    loading: true,
    error: null,
    location: {
      latitude: null,
      longitude: null,
      timestamp: null,
    },
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: '브라우저가 Geolocation을 지원하지 않습니다.',
      }));
      return;
    }

    const geoOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge,
    };

    const handleSuccess = (position: GeolocationPosition) => {
      setState({
        loading: false,
        error: null,
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp,
        },
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: `위치 정보를 가져오는데 실패했습니다: ${error.message}`,
      }));
    };

    let watchId: number | null = null;

    if (watchPosition) {
      watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);
    } else {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
    }

    return () => {
      if (watchPosition && watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [enableHighAccuracy, maximumAge, timeout, watchPosition]);

  return state;
};
