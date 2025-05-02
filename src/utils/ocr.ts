import { OCRResponse } from '@/types/ocr';

export const callOCRAPI = async (imageData: string): Promise<OCRResponse> => {
  try {
    // console.log('OCR API 호출 시작');
    const base64Data = imageData.split(',')[1];
    if (!base64Data) {
      throw new Error('유효하지 않은 이미지 데이터입니다.');
    }

    const response = await fetch('/api/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData: base64Data,
      }),
    });

    if (!response.ok) {
      throw new Error('OCR API 호출 실패');
    }

    const result = await response.json() as OCRResponse;
    return result;
  } catch (error) {
    console.error('OCR API 에러:', error);
    throw error;
  }
};

export const extractBusNumber = (ocrResult: OCRResponse): string | null => {
  try {
    const fields = ocrResult.images[0].fields;
    if (!fields || !fields.length) return null;

    const busNumberPatterns = [
      /^\d{1,4}[-\s]?\d{1,4}$/, // 일반 버스 (1, 1234-5678)
      /^[가-힣]\d{1,4}$/,       // 마을버스 (강남1)
      /^[A-Z]\d{1,4}$/,         // 공항버스 (A1)
      /^[가-힣]\d{1,4}[-\s]?\d{1,4}$/ // 지선버스 (강남1-1234)
    ];
    
    for (const field of fields) { 
      const text = field.inferText.replace(/\s/g, '');
      for (const pattern of busNumberPatterns) {
        if (pattern.test(text)) {
          return text;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('버스 번호 추출 중 에러:', error);
    return null;
  }
};
