// OCR 처리 요청 타입 (CLOVA AI OCR API 사용)
export interface OCRProcessRequest {
  ocrResult?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  ocrText?: string;
}
// OCR 처리 응답 타입 (CLOVA AI OCR API 사용)
export interface OCRProcessResponse {
  isSuccess: boolean;
  code: number;
  message: string;
  result: {
    busNumber: string;
    isMatching: boolean;
  };
}
// OCR 처리 방식 enum
export enum OCRProcessorType {
  CLOVA_CONSOLE = 'CLOVA_CONSOLE',
  TESSERACT_CONSOLE = 'TESSERACT_CONSOLE',
  TESSERACT_SERVER = 'TESSERACT_SERVER',
  CLOVA_SERVER = 'CLOVA_SERVER',
}
// OCR 결과 타입 (서버 응답 타입)
export interface OCRResult {
  busNumber: string | null;
  isMatching: boolean;
  rawResult?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// API 응답 타입 (서버 응답 타입)
export interface OCRServerResponse {
  success: boolean;
  busNumber?: string;
  isMatching?: boolean;
  error?: string;
}
