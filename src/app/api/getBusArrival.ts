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

export const getBusArrival = async (): Promise<BusInfo[]> => {
  const userId = getUserId();

  if (!userId) {
    console.error('사용자 ID를 찾을 수 없습니다.');
    return [];
  }

  try {
    const response = await apiClient.get(`bus/arrival?userId=${userId}`).json<BusArrivalResponse>();

    if (response.isSuccess && response.code === 200) {
      return response.result || [];
    } else {
      console.error(`버스 도착 정보 조회 실패: ${response.message}`);
      return [];
    }
  } catch (error) {
    console.error('버스 도착 정보 조회 중 오류 발생:', error);
    return [];
  }
};
