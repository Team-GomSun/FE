import { useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import Webcam from 'react-webcam';
import LABELS from '@app-datasets/coco/classes.json';

interface PredictionProps {
  modelRef: React.MutableRefObject<tf.GraphModel | null>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  webcamRef: React.RefObject<Webcam>;
  setAnalyzing: (isAnalyzing: boolean) => void;
  onBusDetected: (
    croppedImage: string,
    detections: { x: number; y: number; width: number; height: number; confidence: number }[],
  ) => void;
}

export const usePrediction = ({
  modelRef,
  canvasRef,
  webcamRef,
  setAnalyzing,
  onBusDetected,
}: PredictionProps) => {
  const doPredictFrame = useCallback(
    async (imageData: string) => {
      console.log('doPredictFrame 호출');
      // console.log('modelRef.current:', modelRef.current);
      if (!canvasRef.current) return;
      const modelToUse = modelRef.current;
      if (!modelToUse) {
        console.log('Model not loaded');
        return;
      }
      setAnalyzing(true);

      tf.engine().startScope();
      try {
        const img = new Image();
        img.src = imageData;
        await new Promise((resolve) => (img.onload = resolve));

        if (canvasRef.current) {
          canvasRef.current.width = img.width;
          canvasRef.current.height = img.height;
        }

        const inputShape = modelToUse.inputs[0]?.shape;
        if (!inputShape) {
          console.log('No input shape found');
          return;
        }
        const [modelWidth, modelHeight] = inputShape.slice(1, 3);

        const input = tf.tidy(() => {
          const frameTensor = tf.browser.fromPixels(img);
          return tf.image
            .resizeBilinear(frameTensor, [modelWidth, modelHeight])
            .div(255.0)
            .expandDims(0);
        });

        const res = await modelToUse.executeAsync(input);
        if (!Array.isArray(res)) {
          console.log('Model output is not an array');
          return;
        }

        const [boxes, scores, classes] = res;
        const boxesData = Array.from(boxes.dataSync());
        const scoresData = Array.from(scores.dataSync());
        const classesData = Array.from(classes.dataSync());

        await renderPrediction(boxesData, scoresData, classesData);

        tf.dispose([input, ...res]);
      } catch (error) {
        console.error('Error in prediction:', error);
      } finally {
        tf.engine().endScope();
        setAnalyzing(false);
      }
    },
    [modelRef, canvasRef, webcamRef, setAnalyzing, onBusDetected],
  );

  const renderPrediction = useCallback(
    async (boxesData: number[], scoresData: number[], classesData: number[]) => {
      if (!canvasRef.current || !webcamRef.current) return;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      // clean canvas
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      const font = '16px sans-serif';
      ctx.font = font;
      ctx.textBaseline = 'top';

      // Get the current frame from webcam (only once)
      const currentFrame = webcamRef.current.getScreenshot();
      if (!currentFrame) return;

      // Create an image from the current frame
      const frameImg = new Image();
      frameImg.src = currentFrame;

      // Wait for the image to load
      await new Promise((resolve) => {
        frameImg.onload = resolve;
      });

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

          // Crop the image
          cropCtx.drawImage(frameImg, x1, y1, width, height, 0, 0, width, height);

          // Convert to data URL
          const croppedImage = cropCanvas.toDataURL('image/jpeg');

          // Pass the cropped image to saveAndProcessBusImage
          onBusDetected(croppedImage, [
            {
              x: x1,
              y: y1,
              width,
              height,
              confidence: parseFloat(score) / 100,
            },
          ]);
        }
      }
    },
    [canvasRef, webcamRef, onBusDetected],
  );

  return {
    doPredictFrame,
    renderPrediction,
  };
};
