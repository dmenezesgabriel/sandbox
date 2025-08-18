import React, { useState } from 'react';
import { RecordingStudio } from './RecordingStudio';
import { VideoLibrary } from './VideoLibrary';
import { Monitor, Video, Settings } from 'lucide-react';

export const RecordingApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'record' | 'library'>('record');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Monitor className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Screen Recorder Pro
              </h1>
              <p className="text-sm text-gray-500">
                Professional recording for coding tutorials
              </p>
            </div>
          </div>
          
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab('record')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'record'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Monitor className="w-4 h-4 inline mr-2" />
              Record
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'library'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Video className="w-4 h-4 inline mr-2" />
              Library
            </button>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="p-6">
        {activeTab === 'record' ? <RecordingStudio /> : <VideoLibrary />}
      </main>
    </div>
  );
};