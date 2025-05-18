'use client';

import locationTracker from '@/hooks/locationTracker';
import { OCRResponse } from '@/types/ocr';
import LABELS from '@app-datasets/coco/classes.json';
import { useQuery } from '@tanstack/react-query';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { createWorker } from 'tesseract.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { BusInfo, getBusArrival } from '../api/getBusArrival';
import { processOCRResult } from '../api/ocr/process';
import { OCRProcessorType, OCRResult } from '../api/ocr/types';

export default function Camera() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const captureInterval = useRef<NodeJS.Timeout | null>(null);

  const requestCameraPermission = () => {
    setHasPermission(null);

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(() => setHasPermission(true))
      .catch(() => setHasPermission(false));
  };

  //ai 상태 관리 및 참조 변수
  const modelRef = useRef<tf.GraphModel | null>(null); // useRef로 참조하게 수정
  const [model, setModel] = useState<tf.GraphModel | null>(null);
  const ZOO_MODEL = [{ name: 'yolov5', child: ['yolov5n', 'yolov5s'] }];
  const [modelName] = useState(ZOO_MODEL[0]);
  const [loading, setLoading] = useState(0);
  const [detectedBus, setDetectedBus] = useState<string | null>(null);
  const [isDetectedBusArriving, setIsDetectedBusArriving] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  // Tesseract 워커 관련 상태
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const [workerLoading, setWorkerLoading] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: locationStatus } = useQuery({
    queryKey: ['locationStatus'],
    queryFn: async () => {
      if (!locationTracker.isTracking()) {
        locationTracker.startTracking();
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      try {
        if (locationTracker.hasNearbyBusStops()) {
          await getBusArrival();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    refetchInterval: (data) => (data ? false : 2000),
    enabled: true,
  });

  const { data: expectedBuses = [] } = useQuery<BusInfo[]>({
    queryKey: ['busArrivals'],
    queryFn: getBusArrival,
    refetchInterval: 30000, // 30초
    enabled: locationStatus === true && locationTracker.hasNearbyBusStops(),
  });

  //ai 객체인식 모델 로딩 함수 [YOLOv5 사용]
  useEffect(() => {
    let isMounted = true;
    let loadedModel: tf.GraphModel | null = null;

    const loadModel = async () => {
      try {
        console.log('Starting model load...');
        // Use relative path for model
        const modelPath = `/model/${modelName.name}/${modelName.child[1]}/model.json`;
        console.log('Model path:', modelPath);

        // Check if model files exist
        try {
          const response = await fetch(modelPath);
          if (!response.ok) {
            throw new Error(`Model file not found: ${response.status}`);
          }
          console.log('Model file exists, starting to load...');
        } catch (error) {
          console.error('Model file check failed:', error);
          throw error;
        }

        // Dispose previous model if exists
        if (modelRef.current) {
          // 수정: model 대신 modelRef.current 사용
          console.log('Disposing previous model...');
          modelRef.current.dispose();
        }

        // Set loading state to indicate start
        if (isMounted) {
          setLoading(0.1);
        }

        loadedModel = await tf.loadGraphModel(modelPath, {
          onProgress: (fractions) => {
            console.log('Loading progress:', fractions);
            if (isMounted) {
              setLoading(fractions);
            }
          },
        });

        if (!loadedModel) {
          throw new Error('Model loading failed');
        }

        if (isMounted) {
          console.log('Model loaded, warming up...');
          const shape = loadedModel.inputs[0]?.shape || [1, 640, 640, 3];
          console.log('Model input shape:', shape);

          const dummy = tf.ones(shape);
          console.log('Running warmup inference...');
          const res = await loadedModel.executeAsync(dummy);

          // clear memory
          tf.dispose(res);
          tf.dispose(dummy);

          // save to both ref and state
          modelRef.current = loadedModel; // 모델을 ref에 저장
          setModel(loadedModel); // 모델을 state에도 저장
          setLoading(1);
          console.log('Model ready');
        }
      } catch (error) {
        console.error('Error loading model:', error);
        if (isMounted) {
          modelRef.current = null; // 에러 시 ref도 초기화
          setModel(null);
          setLoading(0);
        }
      }
    };

    // Load model immediately
    loadModel();

    return () => {
      isMounted = false;
      if (loadedModel) {
        console.log('Cleaning up model...');
        loadedModel.dispose();
      }
    };
  }, [modelName]);

  // Tesseract 워커 로드 useEffect (OCR)
  useEffect(() => {
    let isMounted = true;

    const loadWorker = async () => {
      try {
        console.log('Starting Tesseract worker load...');
        setWorkerLoading(0.1);

        // 워커 생성
        // const worker = await createWorker({
        //   langPath: '/model/tessdata',
        // } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

        const worker = await createWorker('eng+kor');

        if (isMounted) {
          workerRef.current = worker;
          setWorkerLoading(1);
          console.log('Tesseract worker ready');
        }
      } catch (error) {
        console.error('Error loading Tesseract worker:', error);
        if (isMounted) {
          workerRef.current = null;
          setWorkerLoading(0);
        }
      }
    };

    loadWorker();

    return () => {
      isMounted = false;
      if (workerRef.current) {
        console.log('Cleaning up Tesseract worker...');
        workerRef.current.terminate();
      }
    };
  }, []);

  // 여기에서 이미지를 처리하면 될 것 같아요
  const sendImageToServer = async (imageData: string) => {
    // console.log('이미지', imageData);
    if (imageData) {
      doPredictFrame(imageData);
    }
  };

  const doPredictFrame = async (imageData: string) => {
    // ref에서 먼저 모델을 확인하고, 없으면 state에서 확인
    const modelToUse = modelRef.current || model;

    if (!modelToUse) {
      console.log('Model not loaded');
      return;
    }

    tf.engine().startScope();
    try {
      // Create a temporary image element to load the screenshot
      const img = new Image();
      img.src = imageData;

      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Set canvas size to match image
      if (canvasRef.current) {
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
      }

      // get width and height from model's shape for resizing image
      const inputShape = modelToUse.inputs[0]?.shape; // model 대신 modelToUse 사용
      if (!inputShape) {
        console.log('No input shape found');
        return;
      }
      const [modelWidth, modelHeight] = inputShape.slice(1, 3);

      // pre-processing frame
      const input = tf.tidy(() => {
        const frameTensor = tf.browser.fromPixels(img);
        return tf.image
          .resizeBilinear(frameTensor, [modelWidth, modelHeight])
          .div(255.0)
          .expandDims(0);
      });

      // predicting...
      console.log('Running prediction...');
      const res = await modelToUse.executeAsync(input); // model 대신 modelToUse 사용
      if (!Array.isArray(res)) {
        console.log('Model output is not an array');
        return;
      }

      const [boxes, scores, classes] = res as [tf.Tensor, tf.Tensor, tf.Tensor];
      const boxesData = Array.from(boxes.dataSync());
      const scoresData = Array.from(scores.dataSync());
      const classesData = Array.from(classes.dataSync());

      // console.log('Prediction results:', {
      //   boxes: boxesData.length,
      //   scores: scoresData.length,
      //   classes: classesData.length,
      // });

      // build the predictions data
      await renderPrediction(boxesData, scoresData, classesData);

      // clear memory
      tf.dispose(res);
    } catch (error) {
      console.error('Error in prediction:', error);
    } finally {
      tf.engine().endScope();
    }
  };

  const renderPrediction = async (
    boxesData: number[],
    scoresData: number[],
    classesData: number[],
  ) => {
    if (!canvasRef.current || !webcamRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // clean canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const font = '16px sans-serif';
    ctx.font = font;
    ctx.textBaseline = 'top';

    for (let i = 0; i < scoresData.length; ++i) {
      const klass = LABELS[classesData[i]];
      const score = (scoresData[i] * 100).toFixed(1);

      // Only process if the score is above 40%
      if (parseFloat(score) < 40) continue;

      let [x1, y1, x2, y2] = boxesData.slice(i * 4, (i + 1) * 4);
      x1 *= canvasRef.current.width;
      x2 *= canvasRef.current.width;
      y1 *= canvasRef.current.height;
      y2 *= canvasRef.current.height;
      const width = x2 - x1;
      const height = y2 - y1;

      // draw the bounding box
      ctx.strokeStyle = '#C53030';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, width, height);

      const label = klass + ' - ' + score + '%';
      const textWidth = ctx.measureText(label).width;
      const textHeight = parseInt(font, 10); // base 10

      // draw the label background
      ctx.fillStyle = '#C53030';
      ctx.fillRect(x1 - 1, y1 - (textHeight + 4), textWidth + 6, textHeight + 4);

      // draw the label text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, x1 + 2, y1 - (textHeight + 2));

      // If bus is detected, crop and save the image
      if (klass === 'bus') {
        // Create a new canvas for the cropped image
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = width;
        cropCanvas.height = height;
        const cropCtx = cropCanvas.getContext('2d');
        if (!cropCtx) return;

        // Get the current frame from webcam
        const currentFrame = webcamRef.current.getScreenshot();
        if (!currentFrame) return;

        // Create an image from the current frame
        const frameImg = new Image();
        frameImg.src = currentFrame;

        // Wait for the image to load
        await new Promise((resolve) => {
          frameImg.onload = resolve;
        });

        // Crop the image
        cropCtx.drawImage(frameImg, x1, y1, width, height, 0, 0, width, height);

        // Convert to data URL
        const croppedImage = cropCanvas.toDataURL('image/jpeg');

        // 이미지 저장 및 OCR 처리
        // saveAndProcessBusImage(croppedImage);
        // OCR 처리 방식 선택 (예: Tesseract 콘솔 출력)
        // await processBusImage(croppedImage, OCRProcessorType.CLOVA_CONSOLE);
        // await processBusImage(croppedImage, OCRProcessorType.TESSERACT_SERVER);
        // await processBusImage(croppedImage, OCRProcessorType.CLOVA_SERVER);
        await processBusImage(croppedImage, OCRProcessorType.TESSERACT_CONSOLE);
      }
    }
  };

  // OCR API 호출 함수
  const callOCRAPI = async (imageData: string): Promise<OCRResponse> => {
    try {
      // console.log('OCR API 호출 시작');
      const base64Data = imageData.split(',')[1];
      if (!base64Data) {
        console.error('이미지 데이터 변환 실패');
        throw new Error('유효하지 않은 이미지 데이터입니다.');
      }

      // console.log('API 요청 전송');
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: base64Data,
        }),
      });

      // console.log('API 응답 수신:', response.status);

      // 응답 상태 확인
      if (!response.ok) {
        let errorMessage = 'API 호출 실패';
        try {
          const errorData = await response.json();
          console.error('API 에러 응답:', errorData);
          errorMessage = errorData.message || response.statusText;
        } catch (e) {
          console.error('에러 응답 파싱 실패:', e);
          errorMessage = response.statusText;
        }
        throw new Error(errorMessage);
      }

      // 성공 응답을 JSON으로 파싱
      let result;
      try {
        result = (await response.json()) as OCRResponse;
        // console.log('OCR 결과 수신:', result);
      } catch (e) {
        console.error('응답 파싱 에러:', e);
        throw new Error('API 응답을 파싱할 수 없습니다.');
      }

      // OCR 결과 검증
      if (!result.images || !result.images[0] || !result.images[0].fields) {
        console.error('잘못된 OCR 결과 형식:', result);
        throw new Error('OCR 결과 형식이 올바르지 않습니다.');
      }

      return result;
    } catch (error) {
      console.error('OCR API 에러:', error);
      if (error instanceof Error) {
        console.error('에러 상세:', {
          message: error.message,
          stack: error.stack,
        });
      }
      throw error;
    }
  };

  const checkBusMatch = (busNumber: string) => {
    if (!busNumber || !expectedBuses || expectedBuses.length === 0) {
      return false;
    }

    for (let i = 0; i < expectedBuses.length; i++) {
      const bus = expectedBuses[i];

      if (!bus || !bus.busNumber) continue;

      if (String(bus.busNumber) === String(busNumber)) {
        return true;
      }
    }

    return false;
  };

  // 1. CLOVA OCR + 클라이언트 처리
  const saveAndProcessBusImage = async (croppedImage: string) => {
    try {
      // console.log('이미지 처리 시작');

      // console.log('OCR API 호출');
      const ocrResult = await callOCRAPI(croppedImage);

      if (ocrResult) {
        // console.log('OCR 결과 처리');
        const busNumber = extractBusNumber(ocrResult);
        if (busNumber) {
          console.log('버스 번호 인식 성공:', busNumber);
          setDetectedBus(busNumber);

          const isMatching = checkBusMatch(busNumber);
          setIsDetectedBusArriving(isMatching);

          if (isMatching) {
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 5000);
          }
        } else {
          console.log('버스 번호를 찾을 수 없음', ocrResult.images[0].fields);
        }
      }
    } catch (error) {
      console.error('이미지 처리 중 에러:', error);
      if (error instanceof Error) {
        console.error('에러 상세:', {
          message: error.message,
          stack: error.stack,
        });
      }
    }
  };

  // 2. Tesseract OCR + 클라이언트 처리
  const processWithTesseractConsole = async (croppedImage: string): Promise<OCRResult> => {
    try {
      if (!workerRef.current) {
        throw new Error('Tesseract worker not loaded');
      }

      const result = await workerRef.current.recognize(croppedImage);
      console.log('Tesseract OCR 결과:', result.data.text);

      const busNumber = extractBusNumberFromText(result.data.text);
      const isMatching = busNumber ? checkBusMatch(busNumber) : false;

      return {
        busNumber,
        isMatching,
        rawResult: result,
      };
    } catch (error) {
      console.error('Tesseract 콘솔 처리 중 에러:', error);
      return { busNumber: null, isMatching: false };
    }
  };

  // 3. CLOVA OCR + 서버 전송
  const processWithClovaAndServer = async (croppedImage: string): Promise<OCRResult> => {
    try {
      const ocrResult = await callOCRAPI(croppedImage);

      const response = await processOCRResult({
        ocrResult,
      });

      return {
        busNumber: response.result.busNumber,
        isMatching: response.result.isMatching,
        rawResult: ocrResult,
      };
    } catch (error) {
      console.error('CLOVA OCR + 서버 처리 중 에러:', error);
      return { busNumber: null, isMatching: false };
    }
  };

  // 4. Tesseract + 서버 전송
  const processWithTesseractAndServer = async (croppedImage: string): Promise<OCRResult> => {
    try {
      if (!workerRef.current) {
        throw new Error('Tesseract worker not loaded');
      }

      const result = await workerRef.current.recognize(croppedImage);

      const response = await processOCRResult({
        ocrText: result.data.text,
      });

      return {
        busNumber: response.result.busNumber,
        isMatching: response.result.isMatching,
        rawResult: result,
      };
    } catch (error) {
      console.error('Tesseract + 서버 처리 중 에러:', error);
      return { busNumber: null, isMatching: false };
    }
  };

  // 버스 번호 추출 함수
  const extractBusNumber = (ocrResult: OCRResponse): string | null => {
    try {
      const fields = ocrResult.images[0].fields;
      if (!fields || !fields.length) return null;
      console.log('fields 전체 내용: ', fields);
      //버스 번호 패턴
      const busNumberPatterns = [
        /^\d{1,4}[-\s]?\d{1,4}$/, // 일반 버스 (1, 1234-5678)
        /^[가-힣]\d{1,4}$/, // 마을버스 (강남1)
        /^[A-Z]\d{1,4}$/, // 공항버스 (A1)
        /^[가-힣]\d{1,4}[-\s]?\d{1,4}$/, // 지선버스 (강남1-1234) 더 있으면 추후 추가
      ];

      for (const field of fields) {
        const text = field.inferText.replace(/\s/g, '');
        for (const pattern of busNumberPatterns) {
          if (pattern.test(text)) {
            return text;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('버스 번호 추출 중 에러:', error);
      return null;
    }
  };

  // 버스 번호 추출 헬퍼 함수 (텍스트용)
  const extractBusNumberFromText = (text: string): string | null => {
    const busNumberPatterns = [
      /^\d{1,4}[-\s]?\d{1,4}$/,
      /^[가-힣]\d{1,4}$/,
      /^[A-Z]\d{1,4}$/,
      /^[가-힣]\d{1,4}[-\s]?\d{1,4}$/,
    ];

    const words = text.split(/\s+/);
    for (const word of words) {
      for (const pattern of busNumberPatterns) {
        if (pattern.test(word)) {
          return word;
        }
      }
    }
    return null;
  };

  // OCR 처리 함수 선택기
  // 1. CLOVA OCR + 클라이언트 처리
  // 2. Tesseract + 클라이언트 처리
  // 3. Tesseract + 서버 처리
  // 4. CLOVA OCR + 서버 처리
  const processBusImage = async (
    croppedImage: string,
    processorType: OCRProcessorType = OCRProcessorType.CLOVA_CONSOLE,
  ): Promise<void> => {
    try {
      let result: OCRResult;

      switch (processorType) {
        case OCRProcessorType.CLOVA_SERVER:
          result = await processWithClovaAndServer(croppedImage);
          break;
        case OCRProcessorType.TESSERACT_CONSOLE:
          result = await processWithTesseractConsole(croppedImage);
          break;
        case OCRProcessorType.TESSERACT_SERVER:
          result = await processWithTesseractAndServer(croppedImage);
          break;
        case OCRProcessorType.CLOVA_CONSOLE:
          // 기존 saveAndProcessBusImage 함수 사용
          await saveAndProcessBusImage(croppedImage);
          return;
        default:
          throw new Error('지원하지 않는 OCR 처리 방식입니다.');
      }

      if (result.busNumber) {
        setDetectedBus(result.busNumber);
        setIsDetectedBusArriving(result.isMatching);

        if (result.isMatching) {
          setShowNotification(true);
          setTimeout(() => setShowNotification(false), 5000);
        }
      }
    } catch (error) {
      console.error('OCR 처리 중 에러:', error);
    }
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      sendImageToServer(imageSrc);
    }
  }, []);

  const continuousCapture = useCallback(() => {
    if (captureInterval.current) {
      clearInterval(captureInterval.current);
    }

    captureInterval.current = setInterval(() => {
      capture();
    }, 1000);
  }, [capture]);

  useEffect(() => {
    requestCameraPermission();
    return () => {
      if (captureInterval.current) {
        clearInterval(captureInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hasPermission === true) {
      continuousCapture();
    }
  }, [hasPermission, continuousCapture]);

  // 모델 로딩 상태에 따른 UI 처리
  if (loading < 1 || workerLoading < 1) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-lg font-medium">모델 로딩 중...</p>
          <div className="w-64 rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${loading * 100}%` }}
            />
            <div
              className="h-2 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${workerLoading * 100}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-600">{Math.round(loading * 100)}%</p>
          <p className="mt-2 text-sm text-gray-600">{Math.round(workerLoading * 100)}%</p>
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
      <div className="relative aspect-[3/4] max-h-[60vh] w-full overflow-hidden">
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

        {/* Bus Arrival Notification */}
        {showNotification && (
          <div
            className="absolute top-4 right-0 left-0 mx-auto w-4/5 rounded-lg bg-green-500 p-4 text-center text-white shadow-lg"
            style={{ zIndex: 2 }}
          >
            <p className="text-lg font-bold">도착 예정 버스 발견!</p>
            <p>{detectedBus} 번 버스가 곧 도착합니다</p>
          </div>
        )}
      </div>

      <div className="mt-4 p-4">
        <p className="mb-4 text-center text-2xl font-bold">
          버스를 프레임 안에 <br />
          위치시키세요
        </p>

        {detectedBus && (
          <div
            className={`mb-4 rounded-full p-4 text-center ${
              isDetectedBusArriving ? 'bg-[#ffde74]' : 'bg-gray-100'
            }`}
          >
            <p className="text-7xl font-bold text-[#353535]">{detectedBus}</p>
          </div>
        )}

        {/* Expected bus arrivals */}
        <div className="mt-2 mb-4">
          <p className="mb-2 font-medium">도착 예정 버스</p>
          {expectedBuses.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {expectedBuses.map((bus, index) => (
                <span
                  key={index}
                  className="rounded-full bg-[#FFE285] px-3 py-1 text-sm font-semibold text-[353535]"
                >
                  {bus.busNumber}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">도착 예정 버스가 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
}
