export interface OCRField {
    valueType: string;
    inferText: string;
    inferConfidence: number;
    type: string;
    lineBreak: boolean;
    boundingPoly: {
      vertices: Array<{
        x: number;
        y: number;
      }>;
    };
  }
  
  export interface OCRImage {
    uid: string;
    name: string;
    inferResult: string;
    message: string;
    validationResult: {
      result: string;
    };
    convertedImageInfo: {
      width: number;
      height: number;
      pageIndex: number;
      longImage: boolean;
    };
    fields: OCRField[];
  }
  
  export interface OCRResponse {
    version: string;
    requestId: string;
    timestamp: number;
    images: OCRImage[];
  }