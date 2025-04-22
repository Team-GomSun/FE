import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

export async function POST(request: Request) {
  try {
    console.log('API 요청 시작');
    const { imageData } = await request.json();
    
    if (!imageData) {
      console.error('이미지 데이터 누락');
      return NextResponse.json(
        { message: '이미지 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    const secretKey = process.env.NAVER_SECRET_KEY;
    const apiurl = process.env.APIGW_INVOKE_URL;

    if (!secretKey || !apiurl) {
      console.error('API 설정 누락:', { secretKey: !!secretKey, apiurl: !!apiurl });
      return NextResponse.json(
        { message: 'API 설정이 누락되었습니다.' },
        { status: 500 }
      );
    }

    console.log('API 설정 확인 완료');

    const timestamp = Date.now().toString();
    const method = 'POST';

    // 시그니처 생성
    const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
    hmac.update(method);
    hmac.update(' ');
    hmac.update('\n');
    hmac.update(timestamp);
    hmac.update('\n');
    hmac.update(process.env.NAVER_ACCESS_KEY || '');

    const signature = hmac.finalize().toString(CryptoJS.enc.Base64);
    console.log('시그니처 생성 완료');

    // 네이버 클라우드 API 호출
    console.log('API 호출 시작');
    const response = await fetch(apiurl, {
      method: 'POST',
      headers: {
        'X-OCR-SECRET': secretKey,
        'Content-Type': 'application/json',
        'X-OCR-SIGNATURE': signature,
      },
      body: JSON.stringify({
        images: [
          {
            format: 'jpg',
            data: imageData,
            name: 'bus_number',
          },
        ],
        lang: 'ko',
        requestId: `bus_${timestamp}`,
        timestamp: timestamp,
        version: 'V2',
      }),
    });

    console.log('API 응답 상태:', response.status);

    // API 응답 처리
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API 에러 응답:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return NextResponse.json(
        { 
          message: `API 호출 실패: ${response.statusText}`,
          details: errorText
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('API 응답 성공');
    return NextResponse.json(data);
  } catch (error) {
    console.error('OCR API 에러:', error);
    return NextResponse.json(
      { 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
