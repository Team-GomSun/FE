import { apiClient } from './apiClient';
import { getUserId } from './userUtils';

export interface LocationData {
  userId?: number;
  latitude: number;
  longitude: number;
}

export interface LocationResponse {
  isSuccess: boolean;
  code: number;
  message: string;
}

export const postUserLocation = async (data: LocationData): Promise<LocationResponse> => {
  const userId = getUserId();

  if (!userId) {
    console.error('사용자 ID를 찾을 수 없습니다.');
    return {
      isSuccess: false,
      code: 400,
      message: '사용자 ID를 찾을 수 없습니다. 버스 번호를 다시 등록해주세요.',
    };
  }

  try {
    const response = await apiClient
      .post('users/location', {
        json: {
          ...data,
          userId,
        },
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
