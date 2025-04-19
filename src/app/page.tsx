'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import LABELS from "@app-datasets/coco/classes.json";
import CryptoJS from 'crypto-js';


export default function Home() {
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
  const [model, setModel] = useState<tf.GraphModel | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [busImages, setBusImages] = useState<string[]>([]);
  const [showImages, setShowImages] = useState(false);
  const ZOO_MODEL = [{ name: "yolov5", child: ["yolov5n", "yolov5s"] }];
  const [modelName] = useState(ZOO_MODEL[0]);
  const [loading, setLoading] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        if (model) {
          console.log('Disposing previous model...');
          model.dispose();
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

          // save to state
          setModel(loadedModel);
          setLoading(1);
          console.log('Model ready');
        }
      } catch (error) {
        console.error('Error loading model:', error);
        if (isMounted) {
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

  // 여기에서 이미지를 처리하면 될 것 같아요
  const sendImageToServer = async (imageData: string) => {
    console.log('이미지', imageData);
    if (imageData) {
      doPredictFrame(imageData);
    }
  };

  const doPredictFrame = async (imageData: string) => {
    if (!model) {
      console.log('Model not loaded');
      return;
    }
    setIsAnalyzing(true);

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
      const inputShape = model.inputs[0]?.shape;
      if (!inputShape) {
        console.log('No input shape found');
        return;
      }
      const [modelWidth, modelHeight] = inputShape.slice(1, 3);

      // pre-processing frame
      const input = tf.tidy(() => {
        const frameTensor = tf.browser.fromPixels(img);
        return tf.image.resizeBilinear(frameTensor, [modelWidth, modelHeight]).div(255.0).expandDims(0);
      });

      // predicting...
      console.log('Running prediction...');
      const res = await model.executeAsync(input);
      if (!Array.isArray(res)) {
        console.log('Model output is not an array');
        return;
      }

      const [boxes, scores, classes] = res as [tf.Tensor, tf.Tensor, tf.Tensor];
      const boxesData = Array.from(boxes.dataSync());
      const scoresData = Array.from(scores.dataSync());
      const classesData = Array.from(classes.dataSync());
  
      console.log('Prediction results:', {
        boxes: boxesData.length,
        scores: scoresData.length,
        classes: classesData.length
      });

      // build the predictions data
      await renderPrediction(boxesData, scoresData, classesData);
  
      // clear memory
      tf.dispose(res);
    } catch (error) {
      console.error('Error in prediction:', error);
    } finally {
      tf.engine().endScope();
      setIsAnalyzing(false);
    }
  };

  const renderPrediction = async (boxesData: number[], scoresData: number[], classesData: number[]) => {
    if (!canvasRef.current || !webcamRef.current) return;
    
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // clean canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const font = "16px sans-serif";
    ctx.font = font;
    ctx.textBaseline = "top";

    for (let i = 0; i < scoresData.length; ++i) {
      const klass = LABELS[classesData[i]];
      const score = (scoresData[i] * 100).toFixed(1);

      let [x1, y1, x2, y2] = boxesData.slice(i * 4, (i + 1) * 4);
      x1 *= canvasRef.current.width;
      x2 *= canvasRef.current.width;
      y1 *= canvasRef.current.height;
      y2 *= canvasRef.current.height;
      const width = x2 - x1;
      const height = y2 - y1;

      // draw the bounding box
      ctx.strokeStyle = "#C53030";
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, width, height);

      const label = klass + " - " + score + "%";
      const textWidth = ctx.measureText(label).width;
      const textHeight = parseInt(font, 10); // base 10

      // draw the label background
      ctx.fillStyle = "#C53030";
      ctx.fillRect(x1 - 1, y1 - (textHeight + 4), textWidth + 6, textHeight + 4);

      // draw the label text
      ctx.fillStyle = "#FFFFFF";
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
        cropCtx.drawImage(
          frameImg,
          x1, y1, width, height,
          0, 0, width, height
        );

        // Convert to data URL
        const croppedImage = cropCanvas.toDataURL('image/jpeg');

        // 이미지 저장 및 OCR 처리
        saveAndProcessBusImage(croppedImage);
      }
    }
  };

  // OCR API 호출 함수
  const callOCRAPI = async (imageData: string) => {
    try {
      const timestamp = Date.now().toString();
      const accessKey = process.env.NEXT_PUBLIC_NAVER_ACCESS_KEY || '';
      const secretKey = process.env.NEXT_PUBLIC_NAVER_SECRET_KEY || '';
      const apiurl = process.env.NEXT_PUBLIC_APIGW_INVOKE_URL || '';
      // const url = '/v1/vision/ocr';
      const method = 'POST';

      // 시그니처 생성
      const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
      hmac.update(method);
      hmac.update(' ');
      // hmac.update(url);
      hmac.update('\n');
      hmac.update(timestamp);
      hmac.update('\n');
      hmac.update(accessKey);

      // API 호출
      const response = await fetch(apiurl, {
        method: 'POST',
        headers: {
          'X-OCR-SECRET': secretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: [
            {
              format: 'jpg',
              data: imageData.split(',')[1], // base64 데이터 부분만 추출
              name: 'bus_number'
            }
          ],
          lang: 'ko',
          requestId: 'string',
          timestamp: timestamp,
          version: 'V1'
        })
      });

      if (!response.ok) {
        throw new Error('OCR API 호출 실패');
      }

      const result = await response.json();
      console.log('OCR 결과:', result);
      return result;
    } catch (error) {
      console.error('OCR API 에러:', error);
      return null;
    }
  };

  // 버스 이미지 저장 및 OCR 처리
  const saveAndProcessBusImage = async (croppedImage: string) => {
    // 이미지 저장
    setBusImages(prev => {
      const newImages = [croppedImage, ...prev];
      return newImages.slice(0, 5);
    });

    // OCR API 호출
    const ocrResult = await callOCRAPI(croppedImage);
    if (ocrResult) {
      // OCR 결과 처리
      console.log('버스 번호 인식 결과:', ocrResult);
      // 여기에 OCR 결과를 상태로 저장하거나 다른 처리를 추가할 수 있습니다
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
    }, 3000);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">저장된 버스 이미지</h2>
              <button
                onClick={() => setShowImages(false)}
                className="rounded-lg bg-gray-200 px-4 py-2 hover:bg-gray-300"
              >
                닫기
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {busImages.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={image}
                    alt={`Bus ${index + 1}`}
                    className="w-full rounded-lg"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 text-white">
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
