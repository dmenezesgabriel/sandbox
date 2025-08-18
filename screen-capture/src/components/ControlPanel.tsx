import React from 'react';
import { Play, Square, Pause, Download, Save, Monitor, Camera, AlertCircle } from 'lucide-react';

interface ControlPanelProps {
  isRecording: boolean;
  isPaused: boolean;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onDownload: () => void;
  onSave: () => void;
  hasRecording: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isRecording,
  isPaused,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onDownload,
  onSave,
  hasRecording
}) => {
  return (
    <div className="space-y-4">
      {/* Recording Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="space-y-3">
          {!isRecording ? (
            <button
              onClick={onStartRecording}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Play className="w-5 h-5" />
              <span>Start Recording</span>
            </button>
          ) : (
            <div className="space-y-3">
              <button
                onClick={onStopRecording}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <Square className="w-5 h-5" />
                <span>Stop Recording</span>
              </button>

              {isPaused ? (
                <button
                  onClick={onResumeRecording}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Play className="w-5 h-5" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={onPauseRecording}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Pause className="w-5 h-5" />
                  <span>Pause</span>
                </button>
              )}
            </div>
          )}

          {hasRecording && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onSave}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button
                onClick={onDownload}
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Panel */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-gray-900 font-medium mb-3">Status</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 flex items-center space-x-2">
              <Monitor className="w-4 h-4" />
              <span>Screen Capture</span>
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              isRecording 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {isRecording ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 flex items-center space-x-2">
              <Camera className="w-4 h-4" />
              <span>Webcam</span>
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              isRecording 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {isRecording ? 'Active' : 'Inactive'}
            </span>
          </div>

          {isPaused && (
            <div className="flex items-center space-x-2 text-yellow-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Recording is paused</span>
            </div>
          )}
        </div>
      </div>

      {/* Tips Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-900 font-medium mb-3">Pro Tips</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Use full-screen apps for better recording quality</li>
          <li>• Position your webcam for optimal lighting</li>
          <li>• Apply gradient overlays for professional look</li>
          <li>• Save recordings to library for easy access</li>
        </ul>
      </div>
    </div>
  );
};