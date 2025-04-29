'use client';

import dynamic from 'next/dynamic';

const BusSearchFunnel = dynamic(() => import('./BusSearchFunnel'), {
  ssr: false,
});

export default function BusSearchPage() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center">
      <div className="w-full max-w-md">
        <BusSearchFunnel />
      </div>
    </div>
  );
}
