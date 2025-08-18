import React, { useEffect, useRef } from 'react';
import { Monitor, Camera, Circle } from 'lucide-react';

interface PreviewPanelProps {
  screenStream: MediaStream | null;
  webcamStream: MediaStream | null;
  webcamPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  webcamSize: 'small' | 'medium' | 'large';
  gradientOverlay: 'none' | 'subtle' | 'vibrant';
  isRecording: boolean;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  screenStream,
  webcamStream,
  webcamPosition,
  webcamSize,
  gradientOverlay,
  isRecording
}) => {
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  useEffect(() => {
    if (webcamVideoRef.current && webcamStream) {
      webcamVideoRef.current.srcObject = webcamStream;
    }
  }, [webcamStream]);

  const getWebcamSizeClasses = () => {
    switch (webcamSize) {
      case 'small': return 'w-32 h-24';
      case 'medium': return 'w-48 h-36';
      case 'large': return 'w-64 h-48';
      default: return 'w-48 h-36';
    }
  };

  const getWebcamPositionClasses = () => {
    switch (webcamPosition) {
      case 'bottom-right': return 'bottom-4 right-4';
      case 'bottom-left': return 'bottom-4 left-4';
      case 'top-right': return 'top-4 right-4';
      case 'top-left': return 'top-4 left-4';
      default: return 'bottom-4 right-4';
    }
  };

  const getGradientOverlayClasses = () => {
    switch (gradientOverlay) {
      case 'subtle': return 'bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10';
      case 'vibrant': return 'bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-pink-500/20';
      default: return '';
    }
  };
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Monitor className="w-5 h-5" />
          <span>Live Preview</span>
        </h2>
        
        {isRecording && (
          <div className="flex items-center space-x-2 text-red-600">
            <Circle className="w-3 h-3 fill-current animate-pulse" />
            <span className="text-sm font-medium">REC</span>
          </div>
        )}
      </div>

      <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
        {screenStream ? (
          <video
            ref={screenVideoRef}
            autoPlay
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Click "Start Recording" to begin screen capture</p>
            </div>
          </div>
        )}

        {/* Gradient Overlay */}
        {gradientOverlay !== 'none' && (
          <div className={`absolute inset-0 pointer-events-none ${getGradientOverlayClasses()}`} />
        )}

        {/* Webcam Overlay */}
        {webcamStream && (
          <div className={`absolute ${getWebcamPositionClasses()} ${getWebcamSizeClasses()}`}>
            <div className="relative">
              <video
                ref={webcamVideoRef}
                autoPlay
                muted
                className="w-full h-full object-cover rounded-lg border-2 border-white shadow-lg"
              />
              <div className="absolute top-2 left-2 bg-blue-600 rounded-full p-1">
                <Camera className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* Recording Indicator Overlay */}
        {isRecording && (
          <div className="absolute top-4 left-4 bg-red-600 rounded-lg px-3 py-1 flex items-center space-x-2">
            <Circle className="w-2 h-2 fill-white animate-pulse" />
            <span className="text-white text-sm font-medium">REC</span>
          </div>
        )}
      </div>
    </div>
  );
};