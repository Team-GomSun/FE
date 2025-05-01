'use client';

import {
  extractNumbersFromKorean,
  isListening,
  isSpeechRecognitionSupported,
  startSpeechRecognition,
  stopSpeechRecognition,
} from '@/hooks/speechRecognitionUtils';
import Image from 'next/image';

type VoiceInputProps = {
  onBusNumberDetected: (busNumber: string) => void;
  onBack: () => void;
};

export const VoiceInputSection = ({ onBusNumberDetected, onBack }: VoiceInputProps) => {
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

    startSpeechRecognition({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onResult: (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('음성 인식 결과:', transcript);

        if (transcriptElement) transcriptElement.textContent = transcript;

        // 숫자 추출
        const numbers = extractNumbersFromKorean(transcript);

        if (resultContainer) resultContainer.style.display = 'block';

        if (numbers) {
          if (numbersElement) {
            numbersElement.textContent = `인식된 버스 번호: ${numbers}`;
          }

          setTimeout(() => {
            stopSpeechRecognition(true);
            onBusNumberDetected(numbers);
          }, 3000);
        } else if (numbersElement) {
          numbersElement.textContent = '숫자를 인식하지 못했습니다. 다시 말씀해주세요.';
        }
      },
      onEnd: () => {
        if (statusElement) statusElement.textContent = '인식 완료';
        if (pulseElement) pulseElement.style.display = 'none';
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onError: (event: any) => {
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

      <h2 className="mb-8 text-center text-3xl font-bold text-[#353535]">버스 번호를 말해주세요</h2>

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
        </div>
      </div>

      <div className="flex w-full space-x-4">
        <button
          onClick={handleBack}
          className="flex-1 rounded-lg bg-gray-200 py-3 text-center text-xl font-medium text-[#353535] transition-colors hover:bg-gray-300"
        >
          뒤로 가기
        </button>

        <button
          onClick={handleRestart}
          className="flex-1 rounded-lg bg-[#ffde74] py-3 text-center text-xl font-bold text-[#353535] transition-colors hover:bg-yellow-300"
        >
          다시 말하기
        </button>
      </div>
    </div>
  );
};
