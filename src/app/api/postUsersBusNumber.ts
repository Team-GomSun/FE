import { apiClient } from './apiClient';

export interface BusNumberRequest {
  busNumber: string;
}

export interface BusNumberResponse {
  result: {
    userId: number;
  };
}

export const postUsersBusNumber = async (data: BusNumberRequest): Promise<BusNumberResponse> => {
  try {
    const response = await apiClient
      .post('users/bus-number', {
        json: data,
      })
      .json<BusNumberResponse>();

    return response;
  } catch (error) {
    console.error('버스 번호 등록 중 오류 발생:', error);
    throw new Error('버스 번호 등록에 실패했습니다.');
  }
};
