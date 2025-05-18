'use client';
import fifthImg from '@/assets/fifth.png';
import firstImg from '@/assets/first.png';
import fourthImg from '@/assets/fourth.png';
import secondImg from '@/assets/second.png';
import thridImg from '@/assets/thrid.png';
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface OnboardingSlidesProps {
  onDone?: () => void;
}

const slides = [
  {
    img: firstImg,
    alt: '버스 번호를 입력하는 손',
    text: '버스 번호를 입력하세요\n (예: 273)',
  },
  {
    img: secondImg,
    alt: '정류장 근처에 서 있는 사람',
    text: '정류장 근처로 이동하세요',
  },
  {
    img: thridImg,
    alt: '핸드폰을 수직으로 들고 있는 손',
    text: '핸드폰을 수직으로\n 들어주세요',
  },
  {
    img: fourthImg,
    alt: '버스 쪽으로 핸드폰을 향하는 모습',
    text: '오는 버스 쪽으로\n 핸드폰을 가져다대세요',
  },
  {
    img: fifthImg,
    alt: '진동이 오는 핸드폰과 버스에 탑승하는 사람',
    text: '진동이 오면\n 해당 버스를 탑승하세요',
  },
];

function useTTS(text: string) {
  useEffect(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const timer = setTimeout(() => {
      const utter = new window.SpeechSynthesisUtterance(text);
      utter.lang = 'ko-KR';
      window.speechSynthesis.speak(utter);
    }, 300);
    return () => {
      clearTimeout(timer);
      window.speechSynthesis.cancel();
    };
  }, [text]);
}

export default function OnboardingSlides({ onDone }: OnboardingSlidesProps) {
  const [idx, setIdx] = useState(0);
  useTTS(slides[idx].text);

  const handleNext = () => {
    if (idx === slides.length - 1) {
      if (onDone) onDone();
    } else {
      setIdx((i) => Math.min(i + 1, slides.length - 1));
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="flex w-full max-w-md flex-col items-center">
        <Image
          src={slides[idx].img}
          alt={slides[idx].alt}
          width={256}
          height={256}
          className="mb-8 h-64 w-64 object-contain"
          aria-hidden={false}
        />
        <div
          className="font-pretendard mb-8 text-center text-2xl font-bold text-[#353535] md:text-3xl"
          aria-live="polite"
          style={{ whiteSpace: 'pre-line' }}
        >
          {slides[idx].text}
        </div>
        <div className="mt-4 flex w-full flex-row justify-between gap-4">
          <button
            className="focus:ring-primary flex-1 rounded-lg bg-gray-200 py-3 text-lg font-bold text-[#353535] focus:ring-2 focus:outline-none disabled:opacity-50"
            onClick={() => setIdx((i) => Math.max(i - 1, 0))}
            disabled={idx === 0}
            aria-label="이전 단계"
          >
            이전
          </button>
          <button
            className="focus:ring-primary flex-1 rounded-lg bg-yellow-300 py-3 text-lg font-bold text-[#353535] focus:ring-2 focus:outline-none disabled:opacity-50"
            onClick={handleNext}
            aria-label="다음 단계"
          >
            {idx === slides.length - 1 ? '시작하기' : '다음'}
          </button>
        </div>
        <div className="mt-6 flex flex-row justify-center gap-2" aria-label="진행 단계 표시">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`inline-block h-3 w-3 rounded-full ${i === idx ? 'bg-yellow-400' : 'bg-gray-300'}`}
              aria-current={i === idx ? 'step' : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
