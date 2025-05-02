import { apiClient } from './apiClient';

export interface LocationData {
  userId: number;
  latitude: number;
  longitude: number;
}

export interface LocationResponse {
  isSuccess: boolean;
  code: number;
  message: string;
}

export const postUserLocation = async (data: LocationData): Promise<LocationResponse> => {
  try {
    const response = await apiClient
      .post('users/location', {
        json: data,
      })
      .json<LocationResponse>();

    return response;
  } catch (error) {
    console.error('위치 정보 전송 중 오류 발생:', error);
    return {
      isSuccess: false,
      code: 500,
      message: '서버 통신 중 오류가 발생했습니다.',
    };
  }
};
