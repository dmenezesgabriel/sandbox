import React, { useState, useRef, useCallback } from 'react';
import { Camera, Settings } from 'lucide-react';
import { PreviewPanel } from './PreviewPanel';
import { ControlPanel } from './ControlPanel';
import { useScreenRecording } from '../hooks/useScreenRecording';

export const RecordingStudio: React.FC = () => {
  const {
    isRecording,
    isPaused,
    recordedBlob,
    screenStream,
    webcamStream,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadRecording,
    saveRecording
  } = useScreenRecording();

  const [webcamPosition, setWebcamPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right');
  const [webcamSize, setWebcamSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [gradientOverlay, setGradientOverlay] = useState<'none' | 'subtle' | 'vibrant'>('subtle');
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preview Panel */}
        <div className="lg:col-span-2">
          <PreviewPanel
            screenStream={screenStream}
            webcamStream={webcamStream}
            webcamPosition={webcamPosition}
            webcamSize={webcamSize}
            gradientOverlay={gradientOverlay}
            isRecording={isRecording}
          />
        </div>

        {/* Control Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Controls</h2>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showSettings 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          
          <ControlPanel
            isRecording={isRecording}
            isPaused={isPaused}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onPauseRecording={pauseRecording}
            onResumeRecording={resumeRecording}
            onDownload={downloadRecording}
            onSave={saveRecording}
            hasRecording={!!recordedBlob}
          />

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-gray-900 font-medium mb-4">Recording Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webcam Position
                  </label>
                  <select
                    value={webcamPosition}
                    onChange={(e) => setWebcamPosition(e.target.value as any)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webcam Size
                  </label>
                  <select
                    value={webcamSize}
                    onChange={(e) => setWebcamSize(e.target.value as any)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video Gradient Overlay
                  </label>
                  <select
                    value={gradientOverlay}
                    onChange={(e) => setGradientOverlay(e.target.value as any)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="none">None</option>
                    <option value="subtle">Subtle</option>
                    <option value="vibrant">Vibrant</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
};