'use client';

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface ModelContextType {
  model: tf.GraphModel | null;
  loading: number;
  error: string | null;
}

const ModelContext = createContext<ModelContextType>({
  model: null,
  loading: 0,
  error: null,
});

export const useModel = () => useContext(ModelContext);

interface ModelProviderProps {
  children: ReactNode;
}

export const ModelProvider = ({ children }: ModelProviderProps) => {
  const [model, setModel] = useState<tf.GraphModel | null>(null);
  const [loading, setLoading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const ZOO_MODEL = [{ name: 'yolov5', child: ['yolov5n', 'yolov5s'] }];
    const modelName = ZOO_MODEL[0];

    const loadModel = async () => {
      try {
        console.log('Starting model load from context...');
        // 모델 경로 설정
        const modelPath = `/model/${modelName.name}/${modelName.child[1]}/model.json`;
        console.log('Model path:', modelPath);

        // 모델 파일 존재 확인
        try {
          const response = await fetch(modelPath);
          if (!response.ok) {
            throw new Error(`Model file not found: ${response.status}`);
          }
          console.log('Model file exists, starting to load...');
        } catch (error) {
          console.error('Model file check failed:', error);
          if (isMounted) {
            setError('모델 파일을 찾을 수 없습니다.');
          }
          return;
        }

        // 로딩 상태 표시 시작
        if (isMounted) {
          setLoading(0.1);
        }

        // 모델 로드
        const loadedModel = await tf.loadGraphModel(modelPath, {
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

        // 모델 워밍업
        if (isMounted) {
          console.log('Model loaded, warming up...');
          const shape = loadedModel.inputs[0]?.shape || [1, 640, 640, 3];
          console.log('Model input shape:', shape);

          const dummy = tf.ones(shape);
          console.log('Running warmup inference...');
          const res = await loadedModel.executeAsync(dummy);

          // 메모리 정리
          tf.dispose(res);
          tf.dispose(dummy);

          // 상태 저장
          setModel(loadedModel);
          setLoading(1);
          console.log('Model ready from context');
        }
      } catch (error) {
        console.error('Error loading model:', error);
        if (isMounted) {
          setModel(null);
          setLoading(0);
          setError('모델 로딩 중 오류가 발생했습니다.');
        }
      }
    };

    loadModel();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ModelContext.Provider value={{ model, loading, error }}>{children}</ModelContext.Provider>
  );
};
