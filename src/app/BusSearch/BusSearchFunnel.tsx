'use client';

import { useFunnel } from '@use-funnel/browser';
import Image from 'next/image';
import { useState } from 'react';
import { VoiceInputSection } from './VoiceInputSection';

type BusSearchFunnelSteps = {
  selectInputMethod: Record<string, never>;
  numberInput: Record<string, never>;
  voiceInput: Record<string, never>;
  confirmation: { busNumber: string };
};

export default function BusSearchFunnel() {
  const [busNumber, setBusNumber] = useState<string>('');

  const funnel = useFunnel<BusSearchFunnelSteps>({
    id: 'bus-search-funnel',
    initial: {
      step: 'selectInputMethod',
      context: {} as Record<string, never>,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderSelectInputMethod = ({ history }: { history: any }) => (
    <div className="flex w-full max-w-md flex-col items-center space-y-7 p-6">
      <div className="relative mb-4 h-50 w-50">
        <Image src="/icons/bus.png" alt="Bus Icon" fill className="object-contain" priority />
      </div>

      <h2 className="mb-14 text-center text-3xl font-bold text-[#353535]">
        타야하는 버스 번호를 <br />
        알려주세요
      </h2>

      <button
        onClick={() => history.push('numberInput', {} as Record<string, never>)}
        className="w-full rounded-full bg-[#ffde74] py-3 text-center text-2xl font-bold text-[#353535]"
      >
        입력하기
      </button>

      <button
        onClick={() => history.push('voiceInput', {} as Record<string, never>)}
        className="w-full rounded-full bg-[#ffde74] py-3 text-center text-2xl font-bold text-[#353535]"
      >
        음성으로 입력하기
      </button>
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderNumberInput = ({ history }: { history: any }) => (
    <div className="flex w-full max-w-md flex-col items-center space-y-7 p-6">
      <div className="relative mb-4 h-50 w-50">
        <Image src="/icons/bus.png" alt="Bus Icon" fill className="object-contain" priority />
      </div>

      <h2 className="mb-14 text-center text-3xl font-bold text-[#353535]">
        타야하는 버스 번호를 <br />
        알려주세요
      </h2>

      <input
        type="text"
        value={busNumber}
        onChange={(e) => setBusNumber(e.target.value)}
        className="w-full rounded-lg border-2 border-gray-200 px-5 py-3 text-center text-3xl font-semibold text-[#353535] caret-[#ffde74] placeholder:text-gray-400 focus:ring-2 focus:ring-[#ffde74] focus:outline-none"
        placeholder="ex) 742"
      />

      <div className="flex-grow"></div>

      <button
        onClick={() => {
          if (busNumber.trim() !== '') {
            history.push('confirmation', () => ({ busNumber }));
          }
        }}
        className="w-full rounded-full bg-[#ffde74] py-3 text-center text-2xl font-bold text-[#353535]"
      >
        다음
      </button>
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderVoiceInput = ({ history }: { history: any }) => (
    <VoiceInputSection
      onBusNumberDetected={(detectedNumber) => {
        history.push('confirmation', () => ({ busNumber: detectedNumber }));
      }}
      onBack={() => {
        history.push('selectInputMethod', {} as Record<string, never>);
      }}
    />
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderConfirmation = ({ context, history }: { context: any; history: any }) => (
    <div className="flex w-full max-w-md flex-col items-center space-y-7 p-6">
      <div className="relative mb-4 h-50 w-50">
        <Image src="/icons/bus.png" alt="Bus Icon" fill className="object-contain" />
      </div>

      <h2 className="mb-10 text-center text-3xl font-bold text-[#353535]">
        버스 번호를 확인해주세요
      </h2>

      <div className="w-full rounded-lg border-2 border-none bg-[#ffde74] py-5 text-center">
        <p className="text-3xl font-semibold text-[#353535]">{context.busNumber}</p>
      </div>

      <p className="text-center text-xl text-[#353535]">이 버스가 맞나요?</p>

      <div className="flex w-full space-x-4">
        <button
          onClick={() => history.back()}
          className="flex-1 rounded-lg bg-gray-200 py-3 text-center text-xl font-medium text-[#353535] transition-colors hover:bg-gray-300"
        >
          아니오
        </button>
        <button
          onClick={() => {
            alert(`${context.busNumber} 버스를 선택하셨습니다.`);
          }}
          className="flex-1 rounded-lg bg-[#ffde74] py-3 text-center text-xl font-bold text-[#353535] transition-colors hover:bg-yellow-300"
        >
          예
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <funnel.Render
        selectInputMethod={renderSelectInputMethod}
        numberInput={renderNumberInput}
        voiceInput={renderVoiceInput}
        confirmation={renderConfirmation}
      />
    </div>
  );
}
