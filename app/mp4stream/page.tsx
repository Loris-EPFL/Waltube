'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../components/Navbar';

// Custom styles for the range slider
const sliderStyles = `
  .slider::-webkit-slider-thumb {
    appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  
  .slider::-moz-range-thumb {
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  
  .slider::-webkit-slider-track {
    height: 8px;
    background: transparent;
    border-radius: 4px;
  }
  
  .slider::-moz-range-track {
    height: 8px;
    background: transparent;
    border-radius: 4px;
  }
`;

interface MP4Video {
  vaultId: string;
  vaultName: string;
  qualities: {
    [quality: string]: {
      fileId: string;
      fileName: string;
      fileSize: number;
    };
  };
  thumbnail: {
    fileId: string;
    fileName: string;
    fileSize: number;
  } | null;
  totalSize: number;
  qualityCount: number;
  createdAt: string;
}

export default function MP4StreamPage() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get('video');
  
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<MP4Video | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeekTimeRef = useRef<number>(0);
  
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
      
      // Auto-select the best available quality (highest resolution)
      const availableQualities = Object.keys(targetVideo.qualities);
      if (availableQualities.length > 0) {
        // Sort qualities by resolution (1080p > 720p > 480p > 360p)
        const qualityOrder = ['1080p', '720p', '480p', '360p'];
        const bestQuality = qualityOrder.find(q => availableQualities.includes(q)) || availableQualities[0];
        setSelectedQuality(bestQuality);
      }
      
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Stream video
  const streamVideo = async (quality?: string) => {
    if (!video) return;
    
    const qualityToUse = quality || selectedQuality;
    if (!qualityToUse || !video.qualities[qualityToUse]) {
      setError('Selected quality not available');
      return;
    }
    
    try {
      setIsLoading(true);
      const fileId = video.qualities[qualityToUse].fileId;
      const streamUrl = `/api/tusky?action=stream&fileId=${fileId}`;
      setVideoUrl(streamUrl);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle quality change
  const handleQualityChange = (quality: string) => {
    if (video && video.qualities[quality]) {
      const currentVideoTime = videoRef.current?.currentTime || 0;
      const wasPlaying = isPlaying;
      
      // Pause current video and reset states
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      setVideoUrl('');
      setCurrentTime(0);
      setBuffered(0);
      
      // Update quality and stream new video
      setSelectedQuality(quality);
      
      // Small delay to ensure state is reset
      setTimeout(() => {
        streamVideo(quality);
        
        // Restore playback position and state after new video loads
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = currentVideoTime;
            if (wasPlaying) {
              videoRef.current.play();
            }
          }
        }, 200);
      }, 50);
    }
  };

  // Video event handlers
  const handlePlay = () => {
    console.log('Video play event');
    setIsPlaying(true);
  };
  const handlePause = () => {
    console.log('Video pause event');
    setIsPlaying(false);
  };
  const handleTimeUpdate = () => {
    if (videoRef.current && !isSeeking) {
      const currentVideoTime = videoRef.current.currentTime;
      // Only update if the time has actually changed significantly
      if (Math.abs(currentVideoTime - currentTime) > 0.1) {
        setCurrentTime(currentVideoTime);
      }
    }
  };
  const handleLoadedMetadata = () => {
    console.log('Video metadata loaded, duration:', videoRef.current?.duration);
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      // Restore last seek position if video was reloaded
      if (lastSeekTimeRef.current > 0) {
        console.log('Restoring seek position to:', lastSeekTimeRef.current);
        videoRef.current.currentTime = lastSeekTimeRef.current;
        setCurrentTime(lastSeekTimeRef.current);
      }
    }
  };
  const handleProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBuffered(bufferedEnd);
    }
  };
  const handleLoadStart = () => {
    console.log('Video load start - this might reset position');
  };
  const handleSeeked = () => {
    console.log('Video seeked to:', videoRef.current?.currentTime);
  };
  const handleSeeking = () => {
    const seekTime = videoRef.current?.currentTime;
    console.log('Video seeking to:', seekTime);
    // Just log the seeking event, don't interfere
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

  const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Update visual state and store intended position
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    lastSeekTimeRef.current = newTime;
    console.log('Seek input to:', newTime);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    // This is called on onChange - only set video time once
    if (videoRef.current && !isSeeking) {
      const newTime = parseFloat(e.target.value);
      console.log('Setting video time to:', newTime);
      videoRef.current.currentTime = newTime;
      lastSeekTimeRef.current = newTime;
    }
  };

  const handleSeekStart = () => {
    console.log('Seek start');
    setIsSeeking(true);
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
    }
  };

  const handleSeekEnd = () => {
    console.log('Seek end');
    // Simply reset seeking state without forcing position
    setIsSeeking(false);
    if (videoRef.current) {
      console.log('Final seek position:', videoRef.current.currentTime);
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      if (newVolume === 0) {
        setIsMuted(true);
      } else {
        setIsMuted(false);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const handleVideoClick = () => {
    togglePlayback();
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
    if (video && selectedQuality && !videoUrl) {
      streamVideo();
    }
  }, [video, selectedQuality]); // Depend on video and selectedQuality

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <style dangerouslySetInnerHTML={{ __html: sliderStyles }} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">🎬 MP4 Video Streaming</h1>
          <p className="text-gray-600">
            Stream entire MP4 videos directly from Tusky using progressive download.
          </p>
        </div>

        {/* Connection Status */}
        <div className="w-full bg-base-200 rounded-lg shadow-xl p-6 mb-6">
          <div className="w-full">
            <h2 className="text-2xl font-bold mb-4">Connection Status</h2>
            <div className="flex items-center space-x-4">
              <div className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
                {isConnected ? 'Connected to Tusky' : 'Disconnected'}
              </span>
              {isLoading && (
                <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="w-full bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center space-x-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-red-800"><strong>Error:</strong> {error}</span>
          </div>
        )}

        {/* Video Info */}
        {video && (
          <div className="w-full bg-base-200 rounded-lg shadow-xl p-6 mb-6">
            <div className="w-full">
              <h2 className="text-2xl font-bold mb-4">Video Information</h2>
              
              <div className="flex items-start space-x-6 mb-6">
                {/* Thumbnail */}
                {video.thumbnail && (
                  <div className="flex-shrink-0">
                    <img
                      src={`/api/tusky?action=stream&fileId=${video.thumbnail.fileId}`}
                      alt={`${video.vaultName} thumbnail`}
                      className="w-32 h-auto rounded-lg border border-gray-300 shadow-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                {/* Video Details */}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold  mb-3">{video.vaultName}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-600 mb-1">Total Size</div>
                      <div className="text-lg font-semibold text-gray-900">{(video.totalSize / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-600 mb-1">Qualities Available</div>
                      <div className="text-lg font-semibold text-gray-900">{video.qualityCount}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-600 mb-1">Current Quality</div>
                      <div className="text-lg font-semibold text-gray-900">{selectedQuality || 'None'}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-600 mb-1">Created</div>
                      <div className="text-lg font-semibold text-gray-900">{new Date(video.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              </div>
              

            </div>
          </div>
        )}

        {/* Video Player */}
        {videoUrl && (
          <div className="w-full bg-base-200 rounded-lg shadow-xl p-6 mb-6">
            <div className="w-full">
              <h2 className="text-2xl font-bold mb-4">Video Player</h2>
            
            <div className="relative bg-black rounded-lg overflow-hidden mb-4">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-auto cursor-pointer"
                onPlay={handlePlay}
                onPause={handlePause}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onProgress={handleProgress}
                onLoadStart={handleLoadStart}
                onSeeked={handleSeeked}
                onSeeking={handleSeeking}
                onClick={handleVideoClick}
                controls={false}
                preload="metadata"
              />
              
              {/* Play/Pause Overlay */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 cursor-pointer" onClick={handleVideoClick}>
                  <div className="bg-white bg-opacity-90 rounded-full p-4">
                    <svg className="w-12 h-12 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Controls */}
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                {/* Visual Progress Display */}
                <div className="relative w-full h-2 bg-gray-200 rounded-lg overflow-hidden">
                  {/* Buffer Progress */}
                  <div 
                    className="absolute top-0 left-0 h-full bg-gray-400 transition-all duration-200"
                    style={{ width: `${duration > 0 ? (buffered / duration) * 100 : 0}%` }}
                  ></div>
                  {/* Play Progress */}
                  <div 
                    className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-200"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  ></div>
                </div>
                {/* Interactive Seek Bar */}
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={isSeeking ? (videoRef.current?.currentTime || currentTime) : currentTime}
                  onInput={handleSeekInput}
                  onChange={handleSeek}
                  onMouseDown={handleSeekStart}
                  onMouseUp={handleSeekEnd}
                  onTouchStart={handleSeekStart}
                  onTouchEnd={handleSeekEnd}
                  className="w-full h-2 bg-transparent appearance-none cursor-pointer slider"
                  style={{
                    background: 'transparent',
                  }}
                />
              </div>

              {/* Time Display */}
              <div className="flex justify-between text-sm text-gray-600">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Volume Control */}
              <div className="flex items-center space-x-4 mb-4">
                <button
                  onClick={toggleMute}
                  className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.828 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.828l3.555-3.793A1 1 0 019.383 3.076zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.828 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.828l3.555-3.793A1 1 0 019.383 3.076zM12.146 5.146a.5.5 0 01.708 0 4 4 0 010 5.708.5.5 0 01-.708-.708 3 3 0 000-4.292.5.5 0 010-.708z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.828 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.828l3.555-3.793A1 1 0 019.383 3.076zM12.146 5.146a.5.5 0 01.708 0 4 4 0 010 5.708.5.5 0 01-.708-.708 3 3 0 000-4.292.5.5 0 010-.708zm2.854 0a.5.5 0 01.708 0 6 6 0 010 8.708.5.5 0 01-.708-.708 5 5 0 000-7.292.5.5 0 010-.708z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-600 w-8">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
              </div>

              {/* Control Buttons */}
              <div className="flex justify-center space-x-4">
                <button
                  onClick={togglePlayback}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  {isPlaying ? (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      <span>Play</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quality Selection - Moved closer to video player */}
              {video && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Video Quality
                  </label>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Object.entries(video.qualities).map(([quality, qualityInfo]) => (
                      <button
                        key={quality}
                        onClick={() => handleQualityChange(quality)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedQuality === quality
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {quality}
                        <span className="block text-xs opacity-75">
                          {(qualityInfo.fileSize / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </button>
                    ))}
                  </div>
                  {selectedQuality && video.qualities[selectedQuality] && (
                    <p className="text-sm text-gray-600 mt-2 text-center">
                      Current: {video.qualities[selectedQuality].fileName} ({(video.qualities[selectedQuality].fileSize / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              )}

              {/* Streaming Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 pt-4 border-t">
                <div>
                  <span className="font-medium">Status:</span> {isPlaying ? 'Playing' : 'Paused'}
                </div>

                <div className="text-right">
                  <span className="font-medium">Progress:</span> {duration > 0 ? Math.round((currentTime / duration) * 100) : 0}%
                </div>
              </div>

            </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="text-center space-x-4">
          <Link
            href="/storage"
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors inline-block"
          >
            ← Back to Storage
          </Link>
          {/* <Link
            href="/stream"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-block"
          >
            🎬 Try HLS Streaming
          </Link> */}
        </div>
      </div>
    </div>
  );
}