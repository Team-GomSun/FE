'use client';

import ErrorToast from '@/components/ErrorToast';
import locationTracker from '@/hooks/locationTracker';
import { OCRResponse } from '@/types/ocr';
import LABELS from '@app-datasets/coco/classes.json';
import { useQuery } from '@tanstack/react-query';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { BusArrivalResult, getBusArrival } from '../api/getBusArrival';
import { getBusNumber } from '../api/userUtils';

export default function Camera() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const captureInterval = useRef<NodeJS.Timeout | null>(null);
  const [showCanvas, setShowCanvas] = useState(true);
  const [isNightMode, setIsNightMode] = useState(true);
  const [showNoStopToast, setShowNoStopToast] = useState(false);

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

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const initializeApp = async () => {
      if (!locationTracker.isTracking()) {
        console.log('위치 추적 시작...');
        locationTracker.startTracking();
      }
    };

    initializeApp();

    return () => {
      if (captureInterval.current) {
        clearInterval(captureInterval.current);
      }
    };
  }, []);

  const { data: locationStatus } = useQuery({
    queryKey: ['locationStatus'],
    queryFn: async () => {
      try {
        if (locationTracker.hasNearbyBusStops()) {
          await getBusArrival();
          return true;
        }
        return false;
      } catch (error) {
        console.log('위치 정보 준비 중...', error);
        throw error;
      }
    },
    refetchInterval: (data) => {
      return data ? false : 3000;
    },
    retry: (failureCount) => {
      return failureCount < 20;
    },
    retryDelay: 3000,
    enabled: true,
  });

  const { data: busArrivalData } = useQuery<BusArrivalResult>({
    queryKey: ['busArrivals'],
    queryFn: getBusArrival,
    refetchInterval: 30000,
    enabled: true,
    retry: (failureCount) => {
      return failureCount < 10;
    },
    retryDelay: 1000,
    staleTime: 0,
    gcTime: 0,
  });

  const expectedBuses = busArrivalData?.buses || [];
  const hasNearbyStops = busArrivalData?.hasNearbyStops ?? false;
  const isRegisteredBusArriving = busArrivalData?.isRegisteredBusArriving ?? false;

  console.log('🔄 Query 상태:', {
    locationStatus,
    hasNearbyBusStops: locationTracker.hasNearbyBusStops(),
    busArrivalData,
    expectedBuses,
    hasNearbyStops,
    isRegisteredBusArriving,
  });

  //ai 모델 로딩 함수
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

  // MobileNet SSD 모델 로딩
  const [ssdModel, setSsdModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [ssdLoading, setSsdLoading] = useState(0);
  const ssdModelRef = useRef<cocoSsd.ObjectDetection | null>(null); // ref 추가

  // MobileNet SSD 모델 로딩
  useEffect(() => {
    let isMounted = true;

    const loadSsdModel = async () => {
      try {
        console.log('Starting MobileNet SSD model load...');
        setSsdLoading(0.1);

        const model = await cocoSsd.load({
          base: 'mobilenet_v2',
        });
        setSsdLoading(0.5);

        if (isMounted) {
          setSsdModel(model);
          ssdModelRef.current = model; // ref에도 모델 저장
          setSsdLoading(1);
          console.log('MobileNet SSD model ready');
        }
      } catch (error) {
        console.error('Error loading MobileNet SSD model:', error);
        if (isMounted) {
          setSsdModel(null);
          ssdModelRef.current = null; // ref도 초기화
          setSsdLoading(0);
        }
      }
    };

    loadSsdModel();

    return () => {
      isMounted = false;
      // cleanup
      if (ssdModelRef.current) {
        ssdModelRef.current = null;
      }
    };
  }, []);

  // 여기에서 이미지를 처리하면 될 것 같아요
  const sendImageToServer = async (imageData: string) => {
    if (imageData) {
      // 메모리 정리
      tf.engine().startScope();
      try {
        if (isNightMode) {
          await doPredictFrame(imageData); // yolov5n 모델 사용
        } else {
          await doPredictFrame2(imageData); // mobilenet ssd 모델 사용
        }
      } finally {
        // 메모리 정리
        tf.disposeVariables();
        tf.engine().endScope();
      }
    }
  };

  const doPredictFrame = async (imageData: string) => {
    const modelToUse = modelRef.current || model;

    if (!modelToUse) {
      console.log('Model not loaded');
      return;
    }

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
      const inputShape = modelToUse.inputs[0]?.shape;
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
      console.log('Running YOLOv5 prediction...');
      const res = await modelToUse.executeAsync(input);
      if (!Array.isArray(res)) {
        console.log('Model output is not an array');
        return;
      }

      const [boxes, scores, classes] = res as [tf.Tensor, tf.Tensor, tf.Tensor];
      const boxesData = Array.from(boxes.dataSync());
      const scoresData = Array.from(scores.dataSync());
      const classesData = Array.from(classes.dataSync());

      // build the predictions data
      await renderPrediction(boxesData, scoresData, classesData);

      // clear memory
      tf.dispose([boxes, scores, classes, input]);
    } catch (error) {
      console.error('Error in YOLOv5 prediction:', error);
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

    const processBusPromises: Promise<void>[] = [];
    let busProcessed = 0; // 버스 처리 개수

    for (let i = 0; i < scoresData.length; ++i) {
      const klass = LABELS[classesData[i]];
      const score = (scoresData[i] * 100).toFixed(1);

      // Only process if the score is above 40%
      if (parseFloat(score) < 30) continue;

      let [x1, y1, x2, y2] = boxesData.slice(i * 4, (i + 1) * 4);
      x1 *= canvasRef.current.width;
      x2 *= canvasRef.current.width;
      y1 *= canvasRef.current.height;
      y2 *= canvasRef.current.height;
      const width = x2 - x1;
      const height = y2 - y1;

      if (klass === 'bus') {
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

        // Create a new canvas for the cropped image
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = width;
        cropCanvas.height = height;
        const cropCtx = cropCanvas.getContext('2d');
        if (!cropCtx) return;

        if (busProcessed >= 4) continue; // 4개까지만 처리
        busProcessed++;

        // Get the current frame from webcam
        const currentFrame = webcamRef.current.getScreenshot();
        if (!currentFrame) return;

        // Create an image from the current frame
        const frameImg = new Image();
        frameImg.src = currentFrame;

        // Wait for the image to load
        const promise = new Promise<void>((resolve) => {
          frameImg.onload = () => {
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = width;
            cropCanvas.height = height;
            const cropCtx = cropCanvas.getContext('2d');
            if (!cropCtx) return resolve();

            // Convert to data URL
            cropCtx.drawImage(frameImg, x1, y1, width, height, 0, 0, width, height);

            // Convert to data URL
            const croppedImage = cropCanvas.toDataURL('image/jpeg');

            // 이미지 저장 및 OCR 처리
            saveAndProcessBusImage(croppedImage);
          };
        });

        processBusPromises.push(promise);
      }
    }

    await Promise.all(processBusPromises);
  };

  const doPredictFrame2 = async (imageData: string) => {
    const ssdModelToUse = ssdModelRef.current || ssdModel;

    if (!ssdModelToUse) {
      console.log('SSD Model not loaded');
      return;
    }

    try {
      // Create a temporary image element to load the screenshot
      const img = new Image();
      img.src = imageData;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Set canvas size to match image
      if (canvasRef.current) {
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
      }

      // MobileNet SSD 모델 사용
      console.log('Running SSD prediction...');
      const predictions = await ssdModelToUse.detect(img);

      // SSD 예측 결과를 처리
      const boxesData: number[] = [];
      const scoresData: number[] = [];
      const classesData: number[] = [];

      predictions.forEach((prediction) => {
        const [x, y, width, height] = prediction.bbox;
        const normalizedX1 = x / img.width;
        const normalizedY1 = y / img.height;
        const normalizedX2 = (x + width) / img.width;
        const normalizedY2 = (y + height) / img.height;

        boxesData.push(normalizedX1, normalizedY1, normalizedX2, normalizedY2);
        scoresData.push(prediction.score);
        const classId = prediction.class === 'bus' ? 5 : -1;
        classesData.push(classId);
      });

      // 변환된 데이터로 예측 결과 렌더링
      await renderPrediction2(boxesData, scoresData, classesData, img);
    } catch (error) {
      console.error('Error in SSD prediction:', error);
    }
  };

  const renderPrediction2 = async (
    boxesData: number[],
    scoresData: number[],
    classesData: number[],
    sourceImg: HTMLImageElement, // 추가: 원본 이미지 참조
  ) => {
    if (!canvasRef.current) {
      console.log('Canvas ref not available');
      return;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) {
      console.log('Canvas context not available');
      return;
    }

    // clean canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const font = '16px sans-serif';
    ctx.font = font;
    ctx.textBaseline = 'top';

    const processBusPromises: Promise<void>[] = [];
    let busProcessed = 0;

    for (let i = 0; i < scoresData.length; ++i) {
      const klass = LABELS[classesData[i]];
      const score = (scoresData[i] * 100).toFixed(1);

      // Only process if the score is above 40%
      if (parseFloat(score) < 40) continue;

      // 정규화된 좌표를 실제 캔버스 좌표로 변환
      let [x1, y1, x2, y2] = boxesData.slice(i * 4, (i + 1) * 4);
      x1 *= canvasRef.current.width;
      x2 *= canvasRef.current.width;
      y1 *= canvasRef.current.height;
      y2 *= canvasRef.current.height;

      const width = x2 - x1;
      const height = y2 - y1;

      if (klass === 'bus' && busProcessed < 4) {
        // draw the bounding box
        ctx.strokeStyle = '#C53030';
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, width, height);

        const label = klass + ' - ' + score + '%';
        const textWidth = ctx.measureText(label).width;
        const textHeight = parseInt(font, 10);

        // draw the label background
        ctx.fillStyle = '#C53030';
        ctx.fillRect(x1 - 1, y1 - (textHeight + 4), textWidth + 6, textHeight + 4);

        // draw the label text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, x1 + 2, y1 - (textHeight + 2));

        // If bus is detected, crop and save the image
        busProcessed++;

        const promise = new Promise<void>((resolve) => {
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = width;
          cropCanvas.height = height;
          const cropCtx = cropCanvas.getContext('2d');
          if (!cropCtx) return resolve();

          // sourceImg를 사용하여 크롭
          cropCtx.drawImage(sourceImg, x1, y1, width, height, 0, 0, width, height);
          const croppedImage = cropCanvas.toDataURL('image/jpeg');

          // OCR 처리
          saveAndProcessBusImage(croppedImage);

          resolve();
        });

        processBusPromises.push(promise);
      }
    }

    await Promise.all(processBusPromises);
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

  // 진짜 3박자 매칭 함수 - OCR + API배열 + 입력한버스번호
  const checkBusMatch = (detectedBusNumber: string) => {
    console.log('=== 3박자 버스 매칭 체크 시작 ===');
    console.log(`OCR 감지된 버스: "${detectedBusNumber}"`);

    // 조건 1: 사용자가 입력해둔 버스 번호가 있어야 함
    const userInputBusNumber = getBusNumber();
    console.log(`사용자 입력 버스 번호: "${userInputBusNumber}"`);

    if (!userInputBusNumber) {
      console.log('❌ 사용자가 입력한 버스 번호가 없습니다');
      return false;
    }

    // 조건 2: isRegisteredBusArriving이 true여야 함 (등록한 버스가 실제 도착 예정)
    console.log(`등록 버스 도착 예정 상태: ${isRegisteredBusArriving}`);

    if (!isRegisteredBusArriving) {
      console.log('❌ 등록한 버스가 현재 도착 예정이 아닙니다');
      return false;
    }

    // 조건 3: API에서 받은 도착 예정 버스 배열에 해당 버스가 있어야 함
    console.log(`API 도착 예정 버스 목록:`, expectedBuses);

    if (!expectedBuses || expectedBuses.length === 0) {
      console.log('❌ API 도착 예정 버스 목록이 비어있습니다');
      return false;
    }

    const detectedStr = String(detectedBusNumber).trim();
    const userInputStr = String(userInputBusNumber).trim();

    // 조건 4: OCR 결과 === 사용자 입력 버스 번호
    console.log(`OCR "${detectedStr}" vs 사용자입력 "${userInputStr}"`);

    if (detectedStr !== userInputStr) {
      console.log(`❌ OCR 결과(${detectedStr})와 사용자 입력(${userInputStr})이 다릅니다`);
      return false;
    }

    // 조건 5: API 배열에도 해당 버스가 있어야 함
    const isInApiList = expectedBuses.some((bus) => String(bus.busNumber).trim() === detectedStr);

    console.log(`API 배열에 ${detectedStr} 존재 여부: ${isInApiList}`);

    if (!isInApiList) {
      console.log(`❌ API 배열에 ${detectedStr}번 버스가 없습니다`);
      console.log(`API 배열 버스들: [${expectedBuses.map((b) => b.busNumber).join(', ')}]`);
      return false;
    }

    console.log(`🎉🎉🎉 3박자 모두 일치! 완벽한 매칭!`);
    console.log(`✅ OCR 감지: "${detectedStr}"`);
    console.log(`✅ 사용자 입력: "${userInputStr}"`);
    console.log(`✅ API 배열에 존재: ${isInApiList}`);
    console.log(`✅ 등록 버스 도착 예정: ${isRegisteredBusArriving}`);
    console.log('=== 3박자 매칭 완료 ===');
    return true;
  };

  // 수정된 버스 이미지 저장 및 OCR 처리
  const saveAndProcessBusImage = async (croppedImage: string) => {
    try {
      console.log('🖼️ 이미지 처리 시작');
      const ocrResult = await callOCRAPI(croppedImage);

      if (ocrResult) {
        const busNumber = extractBusNumber(ocrResult);
        if (busNumber) {
          console.log('🎯 버스 번호 인식 성공:', busNumber);
          setDetectedBus(busNumber);

          console.log('🏠 hasNearbyStops 체크:', hasNearbyStops);
          console.log('🚌 expectedBuses:', expectedBuses);
          console.log('✅ isRegisteredBusArriving:', isRegisteredBusArriving);
          console.log('📊 전체 busArrivalData:', busArrivalData);

          // 근처에 정류장이 있는 경우에만 매칭 체크
          if (hasNearbyStops) {
            console.log('✅ 정류장이 있음 - 매칭 함수 호출');
            // 3박자 모두 체크하는 함수 호출
            const isMatching = checkBusMatch(busNumber);
            console.log(`🔍 매칭 결과: ${isMatching}`);
            setIsDetectedBusArriving(isMatching);

            if (isMatching) {
              console.log('🎉 알림 표시!');
              setShowNotification(true);
              setTimeout(() => setShowNotification(false), 5000);
            }
          } else {
            // 근처에 정류장이 없으면 매칭하지 않음
            console.log('❌ 근처에 정류장이 없어 매칭하지 않습니다');
            setIsDetectedBusArriving(false);
          }
        } else {
          console.log('❌ 버스 번호를 찾을 수 없음', ocrResult.images[0].fields);
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

  // 버스 번호 추출 함수
  const extractBusNumber = (ocrResult: OCRResponse): string | null => {
    try {
      const fields = ocrResult.images[0].fields;
      if (!fields || !fields.length) return null;
      console.log('fields 전체 내용: ', fields);
      //버스 번호 패턴
      const busNumberPatterns = [
        /^\d{1,4}[-\s]?\d{1,4}$/, // 일반 버스 (1, 1234-5678)
        /^[가-힣]{1,4}\d{1,4}$/, // 마을버스 (강남1)
        /^[A-Z]\d{1,4}$/, // 공항버스 (A1)
        /^[가-힣]\d{1,4}[-\s]?\d{1,4}$/, // 지선버스 (강남1-1234) 더 있으면 추후 추가
      ];

      for (const field of fields) {
        const text = field.inferText.replace(/[\s·•-]/g, '');
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

  const capture = useCallback(() => {
    if (!busArrivalData || !busArrivalData.hasNearbyStops) {
      console.log('busArrivalData가 준비되지 않음, OCR 실행 보류');
      return;
    }
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      sendImageToServer(imageSrc);
    }
  }, [isNightMode, busArrivalData]);

  const continuousCapture = useCallback(() => {
    if (captureInterval.current) {
      clearInterval(captureInterval.current);
    }

    captureInterval.current = setInterval(() => {
      capture();
    }, 1000);
  }, [capture, isNightMode]);

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
  }, [hasPermission, continuousCapture, isNightMode]);

  useEffect(() => {
    if (hasNearbyStops === false) {
      setShowNoStopToast(true);
    }
  }, [hasNearbyStops]);

  // 모델 로딩 상태에 따른 UI 처리
  if (loading < 1 || ssdLoading < 1) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-lg font-medium">모델 로딩 중...</p>

          {/* YOLOv5 모델 로딩 상태 */}
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-blue-600">YOLOv5 모델</p>
            <div className="w-64 rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${loading * 100}%` }}
              />
            </div>
            <p className="mt-1 text-sm text-blue-600">{Math.round(loading * 100)}%</p>
          </div>

          {/* MobileNet SSD 모델 로딩 상태 */}
          <div>
            <p className="mb-2 text-sm font-medium text-green-600">MobileNet SSD 모델</p>
            <div className="w-64 rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-green-500 transition-all duration-300"
                style={{ width: `${ssdLoading * 100}%` }}
              />
            </div>
            <p className="mt-1 text-sm text-green-600">{Math.round(ssdLoading * 100)}%</p>
          </div>
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
    <>
      {showNoStopToast && (
        <ErrorToast
          message="주변에 정류장이 없습니다"
          description="근처에 버스 정류장이 없습니다"
          onClose={() => setShowNoStopToast(false)}
          isVisible={showNoStopToast}
        />
      )}
      <div className="flex h-screen flex-col bg-white">
        <div className="relative aspect-[3/4] max-h-[60vh] w-full overflow-hidden">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              facingMode: 'environment',
              aspectRatio: 4 / 3,
            }}
            className="h-full w-full object-cover"
            screenshotQuality={1}
          />

          {/* 캔버스 표시 조건부 렌더링 */}
          {showCanvas && (
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 h-full w-full"
              style={{ zIndex: 1 }}
            />
          )}
          <div className="absolute top-4 right-4 left-4 flex justify-between" style={{ zIndex: 3 }}>
            <button
              onClick={() => setShowCanvas(!showCanvas)}
              className="bg-opacity-50 hover:bg-opacity-70 rounded-lg bg-black px-3 py-2 text-white transition-all"
            >
              {showCanvas ? '감지 숨기기' : '감지 표시'}
            </button>
            <button
              onClick={() => setIsNightMode(!isNightMode)}
              className="bg-opacity-50 hover:bg-opacity-70 rounded-lg bg-black px-3 py-2 text-white transition-all"
            >
              {isNightMode ? '☀️' : '🌙'}
            </button>
          </div>

          {/* 버스 번호 변경 버튼 */}
          <button
            onClick={() => router.push('/BusSearch')}
            className="absolute right-2 bottom-2 rounded-full bg-[#ffd700] px-3 py-1.5 text-sm font-medium text-[#353535] shadow transition-all hover:bg-yellow-400"
            style={{ zIndex: 3 }}
          >
            버스번호 등록
          </button>

          {/* 수정된 Bus Arrival Notification */}
          {showNotification && (
            <div
              className="absolute top-4 right-0 left-0 mx-auto w-4/5 rounded-lg bg-[#fff9db] p-4 text-center text-[#353535] shadow-lg"
              style={{ zIndex: 50 }}
            >
              <p className="text-lg font-bold">등록한 버스가 도착했습니다!</p>
              <p>{detectedBus}번 버스가 곧 도착합니다</p>
            </div>
          )}
        </div>

        <div className="mt-4 p-4">
          {detectedBus && (
            <div
              className={`mb-4 rounded-full p-4 text-center ${
                isDetectedBusArriving ? 'bg-[#ffd700]' : 'bg-gray-100'
              }`}
            >
              <p className="text-7xl font-bold text-[#353535]">{detectedBus}</p>
            </div>
          )}

          {/* Expected bus arrivals */}
          <div className="mt-2 mb-4">
            <p className="mb-2 font-medium">도착 예정 버스</p>
            {hasNearbyStops ? (
              expectedBuses.length > 0 ? (
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {expectedBuses.map((bus, index) => (
                      <span
                        key={index}
                        className="rounded-full bg-[#ffd700] px-3 py-1 text-sm font-semibold text-[#353535]"
                      >
                        {bus.busNumber}
                      </span>
                    ))}
                  </div>
                  {isRegisteredBusArriving ? (
                    <p className="text-sm font-medium text-green-600">
                      ✅ 등록한 버스가 도착 예정입니다!
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">등록한 버스는 현재 도착 예정이 아닙니다</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">도착 예정 버스가 없습니다</p>
              )
            ) : (
              <p className="text-orange-500">근처에 버스 정류장이 없습니다</p>
            )}
          </div>

          {/* 디버깅용 정보 표시 (개발 중에만 사용) */}
          {/* <div className="mt-4 rounded bg-gray-100 p-2 text-xs text-gray-600">
            <p>📱 OCR 감지 버스: {detectedBus || '없음'}</p>
            <p>👤 사용자 입력 버스: {getBusNumber() || '없음'}</p>
            <p>🚌 API 도착예정 버스: {expectedBuses.map((b) => b.busNumber).join(', ') || '없음'}</p>
            <p>🏠 근처 정류장: {hasNearbyStops ? '있음' : '없음'}</p>
            <p>✅ 등록 버스 도착 예정: {isRegisteredBusArriving ? '예' : '아니오'}</p>
            <p>🎯 최종 매칭: {isDetectedBusArriving ? '성공' : '실패'}</p>
          </div> */}
        </div>
      </div>
    </>
  );
}
