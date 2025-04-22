import CryptoJS from 'crypto-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageData } = body;

    const timestamp = Date.now().toString();
    const accessKey = process.env.NEXT_PUBLIC_NAVER_ACCESS_KEY || '';
    const secretKey = process.env.NEXT_PUBLIC_NAVER_SECRET_KEY || '';
    const apiurl = process.env.NEXT_PUBLIC_APIGW_INVOKE_URL || '';
    const method = 'POST';

    // 시그니처 생성
    const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
    hmac.update(method);
    hmac.update(' ');
    hmac.update('\n');
    hmac.update(timestamp);
    hmac.update('\n');
    hmac.update(accessKey);

    // API 호출
    const response = await fetch(apiurl, {
      method: 'POST',
      headers: {
        'X-OCR-SECRET': secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: [
          {
            format: 'jpg',
            data: imageData.split(',')[1], // base64 데이터 부분만 추출
            name: 'bus_number',
          },
        ],
        lang: 'ko',
        requestId: 'string',
        timestamp: timestamp,
        version: 'V1',
      }),
    });

    if (!response.ok) {
      throw new Error('OCR API 호출 실패');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('OCR API 에러:', error);
    return NextResponse.json({ error: 'OCR 처리 실패' }, { status: 500 });
  }
}
