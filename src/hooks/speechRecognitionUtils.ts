'use client';

// 전역 변수로 음성 인식 관리
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let recognition: any = null;
export let isListening = false;

// 브라우저 호환성 확인 및 음성 인식 초기화
if (typeof window !== 'undefined') {
  const SpeechRecognition =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = false;
  }
}

/**
 * 음성인식 지원 여부 확인
 */
export const isSpeechRecognitionSupported = (): boolean => {
  return recognition !== null;
};

/**
 * 한국어 음성에서 숫자 추출 함수
 */
export const extractNumbersFromKorean = (text: string): string => {
  // 숫자 변환 맵핑
  const koreanNumbers: Record<string, string> = {
    영: '0',
    공: '0',
    빵: '0',
    하나: '1',
    일: '1',
    원: '1',
    둘: '2',
    이: '2',
    투: '2',
    셋: '3',
    삼: '3',
    쓰리: '3',
    넷: '4',
    사: '4',
    포: '4',
    다섯: '5',
    오: '5',
    파이브: '5',
    여섯: '6',
    육: '6',
    식스: '6',
    일곱: '7',
    칠: '7',
    세븐: '7',
    여덟: '8',
    팔: '8',
    에잇: '8',
    아홉: '9',
    구: '9',
    나인: '9',
  };

  // 직접적인 숫자 추출 (예: "123", "백이십삼")
  const directNumbers = text.match(/\d+/g);
  if (directNumbers && directNumbers.length > 0) {
    return directNumbers.join('');
  }

  // 한국어 숫자 단어 변환
  let result = text;
  for (const [korean, digit] of Object.entries(koreanNumbers)) {
    if (text.includes(korean)) {
      // 단순 대체가 아닌 정규식 사용해 정확히 치환
      result = result.replace(new RegExp(korean, 'g'), digit);
    }
  }

  // 변환 후 숫자만 추출
  const extractedNumbers = result.match(/\d+/g);
  if (extractedNumbers && extractedNumbers.length > 0) {
    return extractedNumbers.join('');
  }

  return '';
};

/**
 * 음성 인식 시작 함수
 */
export const startSpeechRecognition = ({
  onResult,
  onEnd,
  onError,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onResult: (event: any) => void;
  onEnd?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError?: (event: any) => void;
}): boolean => {
  if (!recognition) {
    return false;
  }

  recognition.onresult = onResult;

  recognition.onend = () => {
    isListening = false;
    console.log('음성 인식 종료');
    if (onEnd) onEnd();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onerror = (event: any) => {
    isListening = false;
    console.error('음성 인식 오류:', event.error);
    if (onError) onError(event);
  };

  // 음성 인식 시작
  try {
    recognition.start();
    isListening = true;
    console.log('음성 인식 시작');
    return true;
  } catch (e) {
    console.error('음성 인식 시작 오류:', e);
    return false;
  }
};

/**
 * 음성 인식 중지 함수
 */
export const stopSpeechRecognition = (suppressError = false): void => {
  if (!recognition || !isListening) return;

  // aborted 오류 방지
  if (suppressError) {
    const originalOnError = recognition.onerror;
    recognition.onerror = null;

    try {
      recognition.stop();
    } catch (e) {
      console.log(e, '음성 인식 중지 중 오류 발생 (무시됨)');
    }

    // 원래 핸들러 복원 (다음 시작을 위해)
    setTimeout(() => {
      if (recognition) recognition.onerror = originalOnError;
    }, 100);
  } else {
    // 일반적인 중지
    try {
      recognition.stop();
    } catch (e) {
      console.error('음성 인식 중지 오류:', e);
    }
  }

  isListening = false;
};
