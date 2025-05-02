'use client';

import '@tensorflow/tfjs-backend-webgl';
import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { useModel } from '@/hooks/useModel';
import { usePrediction } from '@/hooks/usePrediction';
import { callOCRAPI, extractBusNumber } from '@/utils/ocr';

export default function Home() {
  // 상태 관리
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [busNumbers, setBusNumbers] = useState<string[]>([]);
  const [busImages, setBusImages] = useState<string[]>([]);
  const [showImages, setShowImages] = useState(false);

  // refs
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureInterval = useRef<NodeJS.Timeout | null>(null);

  // 모델 설정
  const ZOO_MODEL = [{ name: 'yolov5', child: ['yolov5n', 'yolov5s'] }];
  const [modelName] = useState(ZOO_MODEL[0]);

  // 버스 이미지 저장 및 OCR 처리
  const saveAndProcessBusImage = useCallback(async (croppedImage: string) => {
    try {
      // console.log('이미지 처리 시작');
      setBusImages((prev) => {
        const newImages = [croppedImage, ...prev];
        return newImages.slice(0, 5);
      });

      console.log('OCR API 호출');
      const ocrResult = await callOCRAPI(croppedImage);

      if (ocrResult) {
        // console.log('OCR 결과 처리');
        const busNumber = extractBusNumber(ocrResult);
        if (busNumber) {
          console.log('버스 번호 인식 성공:', busNumber);
          setBusNumbers((prev) => [busNumber, ...prev]);
        } else {
          console.log('버스 번호를 찾을 수 없음', ocrResult);
        }
      }
    } catch (error) {
      console.error('이미지 처리 중 에러:', error);
    }
  }, []);

  // 모델 및 예측 훅 사용
  const { modelRef, loading, isAnalyzing, setAnalyzing } = useModel(modelName);

  const { doPredictFrame } = usePrediction({
    modelRef,
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
    webcamRef: webcamRef as React.RefObject<Webcam>,
    setAnalyzing,
    onBusDetected: saveAndProcessBusImage,
  });

  // 버스 번호 다운로드 함수
  const downloadBusNumbers = useCallback(() => {
    const text = busNumbers.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bus_numbers.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [busNumbers]);

  const requestCameraPermission = useCallback(() => {
    setHasPermission(null);
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(() => setHasPermission(true))
      .catch(() => setHasPermission(false));
  }, []);

  const sendImageToServer = useCallback(
    async (imageData: string) => {
      // console.log('이미지', imageData);
      if (imageData) {
        doPredictFrame(imageData);
      }
    },
    [doPredictFrame],
  );

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      sendImageToServer(imageSrc);
    }
  }, [sendImageToServer]);

  const continuousCapture = useCallback(() => {
    if (captureInterval.current) {
      clearInterval(captureInterval.current);
    }
    captureInterval.current = setInterval(capture, 1000);
  }, [capture]);

  useEffect(() => {
    requestCameraPermission();
    return () => {
      if (captureInterval.current) {
        clearInterval(captureInterval.current);
      }
    };
  }, [requestCameraPermission]);

  useEffect(() => {
    if (hasPermission === true) {
      continuousCapture();
    }
  }, [hasPermission, continuousCapture]);

  // 모델 로딩 상태에 따른 UI 처리
  if (loading < 1) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-lg font-medium">모델 로딩 중...</p>
          <div className="w-64 rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${loading * 100}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-600">{Math.round(loading * 100)}%</p>
        </div>
      </div>
    );
  }

  if (hasPermission === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        카메라 권한을 요청 중입니다...
      </div>
    );
  }

  if (hasPermission === false) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
        <p className="mb-4 text-red-500">카메라 접근 권한이 거부되었습니다.</p>

        <button
          onClick={requestCameraPermission}
          className="rounded-lg bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600"
        >
          카메라 권한 다시 요청하기
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            aspectRatio: 4 / 3,
          }}
          className="h-full w-full object-cover"
          screenshotQuality={1}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 h-full w-full"
          style={{ zIndex: 1 }}
        />
      </div>

      <div className="mt-4 pb-2 text-center">
        <p className="text-lg font-medium">버스를 프레임 안에 위치시키세요</p>
        {loading < 1 ? (
          <div className="mt-2">
            <p className="text-sm text-gray-600">모델 로딩 중... {Math.round(loading * 100)}%</p>
          </div>
        ) : isAnalyzing ? (
          <div className="mt-2">
            <p className="text-sm text-gray-600">분석 중...</p>
          </div>
        ) : null}

        <button
          onClick={() => setShowImages(true)}
          className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        >
          저장된 버스 이미지 보기 ({busImages.length})
        </button>
      </div>

      {showImages && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="w-full max-w-2xl rounded-lg bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">저장된 버스 이미지</h2>
              <div className="flex gap-2">
                <button
                  onClick={downloadBusNumbers}
                  className="rounded-lg bg-green-500 px-4 py-2 text-white hover:bg-green-600"
                >
                  버스 번호 다운로드
                </button>
                <button
                  onClick={() => setShowImages(false)}
                  className="rounded-lg bg-gray-200 px-4 py-2 hover:bg-gray-300"
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {busImages.map((image, index) => (
                <div key={index} className="relative">
                  <img src={image} alt={`Bus ${index + 1}`} className="w-full rounded-lg" />
                  <div className="bg-opacity-50 absolute right-0 bottom-0 left-0 bg-black p-2 text-white">
                    버스 {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
