import { apiClient } from '../apiClient';
import { getUserId } from '../userUtils';
import { OCRProcessRequest, OCRProcessResponse } from './types';

export const processOCRResult = async (data: OCRProcessRequest): Promise<OCRProcessResponse> => {
  const userId = getUserId();

  if (!userId) {
    console.error('사용자 ID를 찾을 수 없습니다.');
    return {
      isSuccess: false,
      code: 400,
      message: '사용자 ID를 찾을 수 없습니다.',
      result: {
        busNumber: '',
        isMatching: false,
      },
    };
  }

  try {
    const response = await apiClient
      .post('ocr/process', {
        json: {
          ...data,
          userId,
        },
      })
      .json<OCRProcessResponse>();

    return response;
  } catch (error) {
    console.error('OCR 결과 처리 중 오류 발생:', error);
    return {
      isSuccess: false,
      code: 500,
      message: '서버 통신 중 오류가 발생했습니다.',
      result: {
        busNumber: '',
        isMatching: false,
      },
    };
  }
};
