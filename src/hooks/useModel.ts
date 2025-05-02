import { useState, useRef, useCallback, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';

interface ModelState {
  model: tf.GraphModel | null;
  modelRef: React.MutableRefObject<tf.GraphModel | null>;
  loading: number;
  isAnalyzing: boolean;
  updateModel: (newModel: tf.GraphModel | null) => void;
  setAnalyzing: (isAnalyzing: boolean) => void;
}

export const useModel = (modelName: { name: string; child: string[] }): ModelState => {
  const [model, setModel] = useState<tf.GraphModel | null>(null);
  const modelRef = useRef<tf.GraphModel | null>(null);
  const [loading, setLoading] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const updateModel = useCallback((newModel: tf.GraphModel | null) => {
    modelRef.current = newModel;
    setModel(newModel);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let loadedModel: tf.GraphModel | null = null;

    const loadModel = async () => {
      try {
        console.log('Starting model load...');
        const modelPath = `/model/${modelName.name}/${modelName.child[1]}/model.json`;
        console.log('Model path:', modelPath);

        if (modelRef.current) {
          console.log('Disposing previous model...');
          modelRef.current.dispose();
        }

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

          tf.dispose(res);
          tf.dispose(dummy);

          console.log('Updating model state...');
          updateModel(loadedModel);
          setLoading(1);
          console.log('Model ready');
        }
      } catch (error) {
        console.error('Error loading model:', error);
        if (isMounted) {
          updateModel(null);
          setLoading(0);
        }
      }
    };

    loadModel();

    return () => {
      isMounted = false;
      if (loadedModel) {
        console.log('Cleaning up model...');
        loadedModel.dispose();
      }
    };
  }, [modelName, updateModel]);

  return {
    model,
    modelRef,
    loading,
    isAnalyzing,
    updateModel,
    setAnalyzing: setIsAnalyzing,
  };
};
