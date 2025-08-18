import React, { useState, useEffect } from 'react';
import { Video, Play, Download, Trash2, Calendar, Clock, FileVideo } from 'lucide-react';
import { getAllVideos, deleteVideo as deleteVideoFromDB } from '../utils/indexedDB';

interface SavedVideo {
  id: string;
  name: string;
  blob: Blob;
  createdAt: Date;
  duration?: number;
  thumbnail?: string;
}

export const VideoLibrary: React.FC = () => {
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<SavedVideo | null>(null);

  useEffect(() => {
    // Load saved videos from IndexedDB
    getAllVideos()
      .then((videos) => {
        setSavedVideos(videos);
      })
      .catch((error) => {
        console.error('Error loading saved videos:', error);
      });
  }, []);

  const deleteVideo = (id: string) => {
    deleteVideoFromDB(id)
      .then(() => {
        const updatedVideos = savedVideos.filter(video => video.id !== id);
        setSavedVideos(updatedVideos);
        
        if (selectedVideo?.id === id) {
          setSelectedVideo(null);
        }
      })
      .catch((error) => {
        console.error('Error deleting video:', error);
        alert('Failed to delete video. Please try again.');
      });
  };

  const downloadVideo = (video: SavedVideo) => {
    const url = URL.createObjectURL(video.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${video.name}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (blob: Blob) => {
    const bytes = blob.size;
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Video List */}
      <div className="lg:col-span-2">
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Video className="w-5 h-5" />
              <span>Video Library</span>
              <span className="text-sm font-normal text-gray-500">
                ({savedVideos.length} videos)
              </span>
            </h2>
          </div>

          <div className="p-4">
            {savedVideos.length === 0 ? (
              <div className="text-center py-12">
                <FileVideo className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No recordings yet</h3>
                <p className="text-gray-500">
                  Start recording to see your videos here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedVideos.map((video) => (
                  <div
                    key={video.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedVideo?.id === video.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedVideo(video)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">
                          {video.name}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(video.createdAt)}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <FileVideo className="w-4 h-4" />
                            <span>{formatFileSize(video.blob)}</span>
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadVideo(video);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this video?')) {
                              deleteVideo(video.id);
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Preview */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
        
        {selectedVideo ? (
          <div className="space-y-4">
            <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <video
                src={URL.createObjectURL(selectedVideo.blob)}
                controls
                className="w-full h-full"
              />
            </div>
            
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900">{selectedVideo.name}</h4>
                <p className="text-sm text-gray-500">
                  Created {formatDate(selectedVideo.createdAt)}
                </p>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => downloadVideo(selectedVideo)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this video?')) {
                      deleteVideo(selectedVideo.id);
                    }
                  }}
                  className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Play className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Select a video to preview</p>
          </div>
        )}
      </div>
    </div>
  );
};