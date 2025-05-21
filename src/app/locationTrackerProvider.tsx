'use client';
import { hasUserId } from '@/app/api/userUtils';
import ErrorToast from '@/components/ErrorToast';
import locationTracker from '@/hooks/locationTracker';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

function LocationTrackerClientComponent({ children }: { children: React.ReactNode }) {
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);

  useEffect(() => {
    if (hasUserId()) {
      console.log('사용자 ID가 있습니다. 위치 추적을 시작합니다.');

      // 오류 콜백 설정 - 주변에 버스 정류장이 없을 때 호출됨
      locationTracker.setNoNearbyBusStopsCallback((message) => {
        setErrorMessage(message);
        setShowErrorToast(true);
      });

      // 기본적으로 WebSocket 방식 사용
      locationTracker.enableWebSocket(true);

      // 위치 추적 시작
      locationTracker.startTracking();

      console.log('위치 추적 방식:', locationTracker.isUsingWebSocket() ? 'WebSocket' : 'REST API');

      /* 이전 REST API 전용 버전 (참고용)
      // REST API만 사용하는 기존 방식
      locationTracker.startTracking(); 
      */
    } else {
      console.log('사용자 ID가 없습니다. 버스 번호 등록이 필요합니다.');
    }

    return () => {
      // 컴포넌트 언마운트 시 WebSocket 연결 종료
      if (locationTracker.isUsingWebSocket()) {
        locationTracker.enableWebSocket(false);
      }

      /* 이전 REST API 전용 버전 (참고용)
      // 애플리케이션이 완전히 닫힐 때 추적 중지 할 건지... 켜도 다시 남아있게 할 건지 고민
      // locationTracker.stopTracking();
      */
    };
  }, []);

  // 오류 토스트 닫기 핸들러
  const handleCloseErrorToast = () => {
    setShowErrorToast(false);
  };

  return (
    <>
      {children}
      {showErrorToast && (
        <ErrorToast
          message="주변에 정류장이 없습니다"
          description={errorMessage}
          onClose={handleCloseErrorToast}
          isVisible={showErrorToast}
        />
      )}
    </>
  );
}

// CSR 전용 컴포넌트로 동적 임포트
const LocationTrackerClient = dynamic(() => Promise.resolve(LocationTrackerClientComponent), {
  ssr: false,
});

// 외부로 노출되는 메인 컴포넌트
export default function LocationTrackerProvider({ children }: { children: React.ReactNode }) {
  return <LocationTrackerClient>{children}</LocationTrackerClient>;
}
