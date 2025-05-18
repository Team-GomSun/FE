'use client';

import {
  isListening,
  isSpeechRecognitionSupported,
  startSpeechRecognition,
  stopSpeechRecognition,
} from '@/hooks/speechRecognitionUtils';
import Image from 'next/image';
import { useState } from 'react';

type BusType = '간선' | '지선' | '마을' | '';

interface DetectedBusInfo {
  type: BusType;
  number: string;
  rawText: string;
  isValid: boolean;
  errorMessage?: string;
}

const BUS_TYPE_CONFIG = {
  간선: {
    min: 100,
    max: 999,
  },
  지선: {
    min: 2000,
    max: 3999,
  },
  마을: {
    min: 1,
    max: 999,
  },
} as const;

const detectBusType = (number: string): BusType => {
  const numericPart = parseInt(number.replace(/[A-Za-z]/g, ''));
  if (isNaN(numericPart)) return '';

  if (numericPart >= 2000 && numericPart <= 3999) return '지선';
  if (numericPart >= 100 && numericPart <= 999) return '간선';
  if (numericPart >= 1 && numericPart <= 999) return '마을';

  return '';
};

const validateBusNumber = (
  type: BusType,
  number: string,
): { isValid: boolean; errorMessage?: string } => {
  if (!type)
    return {
      isValid: false,
      errorMessage: '올바른 버스 번호를 말씀해주세요.',
    };

  const config = BUS_TYPE_CONFIG[type];
  const numericPart = parseInt(number.replace(/[A-Za-z]/g, ''));

  if (isNaN(numericPart)) {
    return {
      isValid: false,
      errorMessage: '올바른 버스 번호를 말씀해주세요.',
    };
  }

  if (numericPart < config.min || numericPart > config.max) {
    return {
      isValid: false,
      errorMessage: `${type}버스는 ${config.min}~${config.max}번 사이만 존재합니다.`,
    };
  }

  return { isValid: true };
};

const extractBusInfo = (text: string): DetectedBusInfo => {
  // 지역명이 포함된 마을버스 번호 패턴 (예: 동작01, 강남01)
  const villageBusPattern =
    /(동작|강남|강북|강서|강동|송파|마포|서초|용산|중구|성북|광진|노원|도봉|중랑|성동|동대문|서대문|은평|종로|구로|금천|영등포|관악|동작|양천|강남|서초|송파|강동)[0-9]+/;

  // 일반 버스 번호 패턴 (예: 750A, 2412)
  const normalBusPattern = /[0-9]+[A-Za-z]?/;

  let detectedNumber = '';
  let detectedType: BusType = '';

  // 먼저 마을버스 패턴 확인
  const villageMatch = text.match(villageBusPattern);
  if (villageMatch) {
    // 마을버스의 경우 지역명을 포함한 전체 번호를 사용
    detectedNumber = villageMatch[0].replace(/\s+/g, ''); // 공백 제거
    detectedType = '마을';
  } else {
    // 일반 버스 번호 패턴 확인
    const numberMatch = text.match(normalBusPattern);
    if (numberMatch) {
      detectedNumber = numberMatch[0].toUpperCase();
      detectedType = detectBusType(detectedNumber);
    }
  }

  if (!detectedNumber) {
    return {
      type: '',
      number: '',
      rawText: text,
      isValid: false,
      errorMessage: '버스 번호를 인식하지 못했습니다.',
    };
  }

  const validation = validateBusNumber(detectedType, detectedNumber);

  return {
    type: detectedType,
    number: detectedNumber,
    rawText: text,
    ...validation,
  };
};

type VoiceInputProps = {
  onBusNumberDetected: (busNumber: string) => void;
  onBack: () => void;
};

interface LocalSpeechRecognitionEvent {
  results: {
    [key: number]: {
      [key: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

export const VoiceInputSection = ({ onBusNumberDetected, onBack }: VoiceInputProps) => {
  const [detectedBus, setDetectedBus] = useState<DetectedBusInfo | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const startSpeech = () => {
    if (!isSpeechRecognitionSupported()) {
      const errorElement = document.getElementById('voice-error');
      if (errorElement) {
        errorElement.textContent = '이 브라우저는 음성 인식을 지원하지 않습니다.';
      }
      return;
    }

    const statusElement = document.getElementById('voice-status');
    const transcriptElement = document.getElementById('voice-transcript');
    const numbersElement = document.getElementById('voice-numbers');
    const pulseElement = document.getElementById('voice-pulse');
    const resultContainer = document.getElementById('voice-result-container');

    if (statusElement) statusElement.textContent = '듣고 있어요...';
    if (pulseElement) pulseElement.style.display = 'flex';
    if (resultContainer) resultContainer.style.display = 'none';
    setDetectedBus(null);
    setIsConfirming(false);

    startSpeechRecognition({
      onResult: (event: LocalSpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        console.log('음성 인식 결과:', transcript);

        if (transcriptElement) transcriptElement.textContent = transcript;

        const busInfo = extractBusInfo(transcript);
        console.log('추출된 버스 정보:', {
          type: busInfo.type,
          number: busInfo.number,
          isValid: busInfo.isValid,
          errorMessage: busInfo.errorMessage,
        });
        setDetectedBus(busInfo);

        if (resultContainer) resultContainer.style.display = 'block';

        if (busInfo.number) {
          if (numbersElement) {
            // 마을버스인 경우 지역명을 포함한 전체 번호 표시, 다른 버스는 번호만 표시
            const displayNumber =
              busInfo.type === '마을'
                ? transcript
                    .match(
                      /(동작|강남|강북|강서|강동|송파|마포|서초|용산|중구|성북|광진|노원|도봉|중랑|성동|동대문|서대문|은평|종로|구로|금천|영등포|관악|동작|양천|강남|서초|송파|강동)[0-9]+/,
                    )?.[0]
                    .replace(/\s+/g, '') || busInfo.number
                : busInfo.number.replace(/[A-Za-z]/g, '');
            numbersElement.textContent = `인식된 버스: ${displayNumber}`;
          }

          if (busInfo.isValid) {
            // 올바른 버스 번호가 인식되면 잠시 표시 후 자동으로 다음으로 넘어감
            setTimeout(() => {
              stopSpeechRecognition(true);
              const finalNumber = transcript.replace(/\s+/g, '');
              console.log('BusSearchFunnel로 전달되는 버스 번호:', finalNumber);
              onBusNumberDetected(finalNumber);
            }, 1500);
          } else {
            // 잘못된 번호면 다시 말하기 유도
            setIsConfirming(true);
            stopSpeechRecognition(true);
          }
        } else if (numbersElement) {
          numbersElement.textContent = '버스 번호를 인식하지 못했습니다. 다시 말씀해주세요.';
          setIsConfirming(true);
          stopSpeechRecognition(true);
        }
      },
      onEnd: () => {
        if (statusElement) statusElement.textContent = '인식 완료';
        if (pulseElement) pulseElement.style.display = 'none';
      },
      onError: (event: SpeechRecognitionErrorEvent) => {
        if (statusElement) statusElement.textContent = `음성 인식 오류: ${event.error}`;
        if (pulseElement) pulseElement.style.display = 'none';
      },
    });
  };

  const handleBack = () => {
    stopSpeechRecognition(true);
    onBack();
  };

  const handleRestart = () => {
    stopSpeechRecognition(true);
    setDetectedBus(null);
    setIsConfirming(false);

    const transcriptElement = document.getElementById('voice-transcript');
    const resultContainer = document.getElementById('voice-result-container');

    if (transcriptElement) transcriptElement.textContent = '';
    if (resultContainer) resultContainer.style.display = 'none';

    setTimeout(startSpeech, 300);
  };

  setTimeout(() => {
    if (!isListening && typeof window !== 'undefined') {
      startSpeech();
    }
  }, 300);

  return (
    <div className="flex w-full max-w-md flex-col items-center space-y-4 p-6">
      <div className="relative mb-4 h-50 w-50">
        <Image src="/icons/mic.png" alt="Microphone Icon" fill className="object-contain" />
      </div>

      <h2 className="mb-8 text-center text-3xl font-bold text-[#353535]">
        버스 번호를 말해주세요
        <br />
        <span className="text-sm font-normal text-gray-500">(예: 750A, 2412, 동작01)</span>
      </h2>

      <div className="flex w-full flex-col items-center justify-center py-4">
        <div id="voice-pulse" className="flex flex-col items-center" style={{ display: 'none' }}>
          <div className="mb-2 h-16 w-16 animate-pulse rounded-full bg-[#ffde74]"></div>
        </div>

        <p id="voice-status" className="text-lg text-gray-500">
          음성 인식 준비중...
        </p>

        <p id="voice-error" className="text-lg text-red-500"></p>

        <div
          id="voice-result-container"
          className="bg-opacity-50 mt-4 w-full rounded-lg bg-[#ffde74] p-4 text-center"
          style={{ display: 'none' }}
        >
          <p id="voice-transcript" className="text-xl font-semibold text-[#353535]"></p>
          <p id="voice-numbers" className="mt-2 text-sm text-[#353535]"></p>
          {detectedBus?.errorMessage && (
            <p className="mt-2 text-sm text-red-500">{detectedBus.errorMessage}</p>
          )}
          {isConfirming && detectedBus && !detectedBus.isValid && (
            <div className="mt-4 flex justify-center space-x-4">
              <button
                onClick={handleRestart}
                className="rounded-lg bg-[#ffde74] px-4 py-2 text-sm font-bold text-[#353535] transition-colors hover:bg-yellow-300"
              >
                다시 말하기
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex w-full space-x-4">
        <button
          onClick={handleBack}
          className="flex-1 rounded-lg bg-gray-200 py-3 text-center text-xl font-medium text-[#353535] transition-colors hover:bg-gray-300"
        >
          뒤로 가기
        </button>

        {!isConfirming && (
          <button
            onClick={handleRestart}
            className="flex-1 rounded-lg bg-[#ffde74] py-3 text-center text-xl font-bold text-[#353535] transition-colors hover:bg-yellow-300"
          >
            다시 말하기
          </button>
        )}
      </div>
    </div>
  );
};
