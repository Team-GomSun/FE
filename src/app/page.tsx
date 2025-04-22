'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-white">
      <div className="text-center">
        <h1 className="mb-6 text-3xl font-bold">버스 번호 인식 시스템</h1>
        <button
          onClick={() => router.push('/Camera')}
          className="rounded-lg bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600"
        >
          카메라로 이동하기
        </button>
      </div>
    </div>
  );
}
