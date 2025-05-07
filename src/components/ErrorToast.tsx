import Alert from '@/assets/triangle-alert.svg';
import Image from 'next/image';
import { useEffect, useState } from 'react';

type ErrorToastProps = {
  message: string;
  description?: string;
  duration?: number;
  onClose?: () => void;
  isVisible?: boolean;
};

export default function ErrorToast({
  message,
  description = '',
  duration = 5000,
  onClose,
  isVisible = true,
}: ErrorToastProps) {
  const [visible, setVisible] = useState(isVisible);

  useEffect(() => {
    setVisible(isVisible);
  }, [isVisible]);

  useEffect(() => {
    if (visible && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration]);

  const handleClose = () => {
    setVisible(false);
    if (onClose) {
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-5 fixed top-4 right-4 z-50 duration-300">
      <div className="flex w-full max-w-xs items-center rounded-lg bg-red-50 p-4 text-red-800 shadow">
        <div className="inline-flex flex-shrink-0 items-center justify-center">
          <Image src={Alert} alt="leftBtn" width={25} />
        </div>
        <div className="mr-6 ml-3 text-sm">
          <span className="font-medium">{message}</span>
          {description && <div className="mt-1 text-xs opacity-80">{description}</div>}
        </div>
        <button
          type="button"
          className="-mx-1.5 -my-1.5 ml-auto inline-flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
          onClick={handleClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}
