import { apiClient } from './apiClient';
import { getUserId } from './userUtils';

export interface BusInfo {
  busNumber: string;
}

export interface BusArrivalResponse {
  isSuccess: boolean;
  code: number;
  message: string;
  result: BusInfo[];
}

export interface BusArrivalResult {
  buses: BusInfo[];
  hasNearbyStops: boolean;
  isRegisteredBusArriving?: boolean;
}

export const getBusArrival = async (): Promise<BusArrivalResult> => {
  const userId = getUserId();
  if (!userId) {
    console.error('사용자 ID를 찾을 수 없습니다.');
    return { buses: [], hasNearbyStops: false };
  }

  try {
    const response = await apiClient
      .get(`bus/arrivals?userId=${userId}`)
      .json<BusArrivalResponse>();

    if (response.isSuccess) {
      if (response.code === 20002) {
        return {
          buses: response.result || [],
          hasNearbyStops: true,
          isRegisteredBusArriving: true,
        };
      } else {
        return {
          buses: response.result || [],
          hasNearbyStops: true,
          isRegisteredBusArriving: false,
        };
      }
    } else if (response.code === 40403) {
      throw new Error('위치 정보 준비 중...');
    } else {
      console.error(`버스 도착 정보 조회 실패: ${response.message}`);
      return { buses: [], hasNearbyStops: false };
    }
  } catch (error) {
    console.error('버스 도착 정보 조회 중 오류 발생:', error);
    throw error;
  }
};
