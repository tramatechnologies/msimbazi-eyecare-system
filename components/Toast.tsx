/**
 * Toast notification component
 * Provides user feedback for actions
 */

import React, { useState, useEffect, useRef } from 'react';
import { UI_TIMING } from '../constants';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  type, 
  duration = UI_TIMING.TOAST_DURATION,
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setIsVisible(false);
    }, duration);
    
    const timer2 = setTimeout(() => {
      onClose();
    }, duration + 300); // Wait for fade-out animation
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }
    };
  }, [duration, onClose]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
    dismissTimeoutRef.current = setTimeout(() => {
      dismissTimeoutRef.current = null;
      onClose();
    }, UI_TIMING.TOAST_FADE_OUT);
  };

  const typeStyles = {
    success: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-yellow-500 text-white',
    info: 'bg-brand-primary text-white',
  };

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle',
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl ${typeStyles[type]} transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <i className={`fas ${icons[type]} text-xl`}></i>
      <p className="font-bold text-sm">{message}</p>
      <button
        onClick={handleDismiss}
        className="ml-2 hover:opacity-70 transition-opacity"
      >
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: ToastType }>;
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ 
  toasts, 
  onRemove 
}) => {
  return (
    <>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ bottom: `${4 + index * 80}px` }}
          className="fixed right-4 z-50"
        >
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </>
  );
};

// Hook for managing toasts
export const useToast = () => {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([]);

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return {
    toasts,
    showToast,
    removeToast,
    success: (message: string) => showToast(message, 'success'),
    error: (message: string) => showToast(message, 'error'),
    warning: (message: string) => showToast(message, 'warning'),
    info: (message: string) => showToast(message, 'info'),
  };
};
