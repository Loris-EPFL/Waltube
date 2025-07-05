'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface MP4Video {
  vaultId: string;
  vaultName: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

export default function MP4StreamPage() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get('video');
  
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<MP4Video | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Connect to Tusky
  const connectToTusky = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/tusky?action=connect', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to connect to Tusky');
      }
      
      setIsConnected(true);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Load video metadata
  const loadVideo = async () => {
    if (!videoId || !isConnected) return;
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/tusky?action=mp4videos');
      
      if (!response.ok) {
        throw new Error('Failed to load videos');
      }
      
      const videos: MP4Video[] = await response.json();
      const targetVideo = videos.find(v => v.vaultId === videoId);
      
      if (!targetVideo) {
        throw new Error('Video not found');
      }
      
      setVideo(targetVideo);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Stream video
  const streamVideo = async () => {
    if (!video) return;
    
    try {
      setIsLoading(true);
      const streamUrl = `/api/tusky?action=stream&fileId=${video.fileId}`;
      setVideoUrl(streamUrl);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Video event handlers
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };
  const handleProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBuffered(bufferedEnd);
    }
  };

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = parseFloat(e.target.value);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Effects
  useEffect(() => {
    connectToTusky();
  }, []);

  useEffect(() => {
    if (isConnected) {
      loadVideo();
    }
  }, [isConnected, videoId]);

  useEffect(() => {
    if (video && !videoUrl) {
      streamVideo();
    }
  }, [video]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">🎬 MP4 Video Streaming</h1>
          <p className="text-gray-600">
            Stream entire MP4 videos directly from Tusky using progressive download.
          </p>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className="flex items-center space-x-4">
            <div className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className={isConnected ? 'text-green-700' : 'text-red-700'}>
              {isConnected ? 'Connected to Tusky' : 'Disconnected'}
            </span>
            {isLoading && (
              <div className="text-blue-600">Loading...</div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Video Info */}
        {video && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Video Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Name:</span> {video.vaultName}
              </div>
              <div>
                <span className="font-medium">File:</span> {video.fileName}
              </div>
              <div>
                <span className="font-medium">Size:</span> {(video.fileSize / 1024 / 1024).toFixed(2)} MB
              </div>
              <div>
                <span className="font-medium">Created:</span> {new Date(video.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        {/* Video Player */}
        {videoUrl && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Video Player</h2>
            
            <div className="relative bg-black rounded-lg overflow-hidden mb-4">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-auto"
                onPlay={handlePlay}
                onPause={handlePause}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onProgress={handleProgress}
                controls={false}
              />
            </div>

            {/* Custom Controls */}
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                {/* Buffer Progress */}
                <div 
                  className="absolute top-0 h-2 bg-gray-400 rounded-lg pointer-events-none"
                  style={{ width: `${duration > 0 ? (buffered / duration) * 100 : 0}%` }}
                ></div>
                {/* Play Progress */}
                <div 
                  className="absolute top-0 h-2 bg-blue-600 rounded-lg pointer-events-none"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                ></div>
              </div>

              {/* Time Display */}
              <div className="flex justify-between text-sm text-gray-600">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Control Buttons */}
              <div className="flex justify-center space-x-4">
                <button
                  onClick={togglePlayback}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                </button>
              </div>

              {/* Streaming Stats */}
              <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 pt-4 border-t">
                <div>
                  <span className="font-medium">Status:</span> {isPlaying ? 'Playing' : 'Paused'}
                </div>
                <div>
                  <span className="font-medium">Buffered:</span> {formatTime(buffered)}
                </div>
                <div>
                  <span className="font-medium">Progress:</span> {duration > 0 ? Math.round((currentTime / duration) * 100) : 0}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="text-center space-x-4">
          <Link
            href="/storage"
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Storage
          </Link>
          <Link
            href="/stream"
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            🎬 Try HLS Streaming
          </Link>
        </div>
      </div>
    </div>
  );
}