import { useState, useRef, useCallback } from 'react';
import { saveVideo } from '../utils/indexedDB';

interface SavedVideo {
  id: string;
  name: string;
  blob: Blob;
  createdAt: Date;
}

export const useScreenRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      // Get screen capture
      const screenCaptureStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      // Get webcam stream
      const webcamCaptureStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      setScreenStream(screenCaptureStream);
      setWebcamStream(webcamCaptureStream);

      // Combine streams for recording
      const combinedStream = new MediaStream();
      
      // Add video track from screen
      const screenVideoTrack = screenCaptureStream.getVideoTracks()[0];
      if (screenVideoTrack) {
        combinedStream.addTrack(screenVideoTrack);
      }

      // Add audio tracks from both streams
      const screenAudioTrack = screenCaptureStream.getAudioTracks()[0];
      const webcamAudioTrack = webcamCaptureStream.getAudioTracks()[0];
      
      if (screenAudioTrack) {
        combinedStream.addTrack(screenAudioTrack);
      }
      if (webcamAudioTrack) {
        combinedStream.addTrack(webcamAudioTrack);
      }

      // For simplicity, we'll record the screen stream
      // In a production app, you'd want to composite both streams
      const mediaRecorder = new MediaRecorder(screenCaptureStream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        setIsRecording(false);
        setIsPaused(false);
        
        // Clean up streams
        screenCaptureStream.getTracks().forEach(track => track.stop());
        webcamCaptureStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
        setWebcamStream(null);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please ensure you grant screen and camera permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }, [isRecording, isPaused]);

  const downloadRecording = useCallback(() => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screen-recording-${new Date().toISOString().slice(0, 19)}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [recordedBlob]);

  const saveRecording = useCallback(() => {
    if (recordedBlob) {
      const videoName = prompt('Enter a name for your recording:') || `Recording ${new Date().toLocaleDateString()}`;
      
      const savedVideo: SavedVideo = {
        id: Date.now().toString(),
        name: videoName,
        blob: recordedBlob,
        createdAt: new Date()
      };

      saveVideo(savedVideo)
        .then(() => {
          alert('Recording saved to library!');
        })
        .catch((error) => {
          console.error('Error saving video:', error);
          alert('Failed to save recording. Please try again.');
        });
    }
  }, [recordedBlob]);
  return {
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
  };
};