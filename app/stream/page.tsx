'use client';
import React, { useState, useEffect, useRef } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Link from 'next/link';
import Navbar from '../components/Navbar';

interface StoredVideo {
  vaultId: string;
  vaultName: string;
  playlistFileId: string;
  segmentFileIds: string[];
  createdAt: string;
}

const VideoStreamPage: React.FC = () => {
  const [storedVideos, setStoredVideos] = useState<StoredVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<StoredVideo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [playlistContent, setPlaylistContent] = useState<string>('');
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [segmentUrls, setSegmentUrls] = useState<Map<number, string>>(new Map());
  const [bufferedSegments, setBufferedSegments] = useState<Set<number>>(new Set());
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);
  const bufferSize = 3; // Number of segments to buffer ahead

  // Connect to Tusky API
  const connectToTusky = async () => {
    try {
      const response = await fetch('/api/tusky?action=connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to connect to Tusky');
      }
      
      setIsConnected(true);
      toast.success('Connected to Tusky!');
      await loadStoredVideos();
    } catch (error: any) {
      console.error('Failed to connect to Tusky:', error);
      toast.error(`Failed to connect: ${error.message}`);
    }
  };

  // Load stored videos from Tusky
  const loadStoredVideos = async () => {
    try {
      const response = await fetch('/api/tusky?action=videos');
      if (!response.ok) {
        throw new Error('Failed to load videos');
      }
      
      const videos = await response.json();
      setStoredVideos(videos);
    } catch (error: any) {
      console.error('Failed to load stored videos:', error);
      toast.error(`Failed to load videos: ${error.message}`);
    }
  };

  // Stream individual segment and create blob URL
  const streamSegment = async (fileId: string, segmentIndex: number): Promise<string> => {
    try {
      const response = await fetch(`/api/tusky?action=stream&fileId=${fileId}`);
      if (!response.ok) {
        throw new Error(`Failed to stream segment: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Store the segment URL
      setSegmentUrls(prev => {
        const newMap = new Map(prev);
        newMap.set(segmentIndex, url);
        return newMap;
      });
      
      setBufferedSegments(prev => new Set([...prev, segmentIndex]));
      
      return url;
    } catch (error: any) {
      console.error(`Failed to stream segment ${segmentIndex}:`, error);
      throw error;
    }
  };

  // Load a single segment
  const loadSegment = async (video: StoredVideo, segmentIndex: number) => {
    if (bufferedSegments.has(segmentIndex) || segmentIndex >= video.segmentFileIds.length) {
      return;
    }
    
    try {
      await streamSegment(video.segmentFileIds[segmentIndex], segmentIndex);
    } catch (error) {
      console.error(`Failed to load segment ${segmentIndex}:`, error);
    }
  };
  
  // Buffer upcoming segments
  const bufferUpcomingSegments = async (video: StoredVideo, currentIndex: number) => {
    setIsBuffering(true);
    
    const promises = [];
    for (let i = currentIndex; i < Math.min(currentIndex + bufferSize, video.segmentFileIds.length); i++) {
      if (!bufferedSegments.has(i)) {
        promises.push(loadSegment(video, i));
      }
    }
    
    try {
      await Promise.all(promises);
      setBufferProgress(Math.min(100, (bufferedSegments.size / video.segmentFileIds.length) * 100));
    } catch (error) {
      console.error('Failed to buffer segments:', error);
    } finally {
      setIsBuffering(false);
    }
  };

  // Load and prepare video for streaming
  const prepareVideoForStreaming = async (video: StoredVideo) => {
    setIsLoading(true);
    setSelectedVideo(video);
    setCurrentSegmentIndex(0);
    setBufferedSegments(new Set());
    setSegmentUrls(new Map());
    
    try {
      // First, get the playlist
      const playlistResponse = await fetch(`/api/tusky?action=download&fileId=${video.playlistFileId}`);
      if (!playlistResponse.ok) {
        throw new Error('Failed to load playlist');
      }
      
      const playlistBlob = await playlistResponse.blob();
      const playlistText = await playlistBlob.text();
      setPlaylistContent(playlistText);
      
      // Load the first segment
      const firstSegmentUrl = await streamSegment(video.segmentFileIds[0], 0);
      
      // Set video source to first segment
      if (videoRef.current) {
        videoRef.current.src = firstSegmentUrl;
      }
      
      // Buffer upcoming segments
      await bufferUpcomingSegments(video, 0);
      
      toast.success(`Video "${video.vaultName}" ready for streaming!`);
    } catch (error: any) {
      console.error('Failed to prepare video:', error);
      toast.error(`Failed to prepare video: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle video ended event - transition to next segment
  const handleVideoEnded = async () => {
    if (!selectedVideo) return;
    
    const nextSegmentIndex = currentSegmentIndex + 1;
    
    if (nextSegmentIndex < selectedVideo.segmentFileIds.length) {
      // Move to next segment
      setCurrentSegmentIndex(nextSegmentIndex);
      
      // Check if next segment is buffered
      if (segmentUrls.has(nextSegmentIndex)) {
        const nextSegmentUrl = segmentUrls.get(nextSegmentIndex);
        if (videoRef.current && nextSegmentUrl) {
          videoRef.current.src = nextSegmentUrl;
          try {
            await videoRef.current.play();
          } catch (error) {
            console.error('Failed to play next segment:', error);
          }
        }
      } else {
        // Load next segment if not buffered
        try {
          const nextSegmentUrl = await streamSegment(selectedVideo.segmentFileIds[nextSegmentIndex], nextSegmentIndex);
          if (videoRef.current) {
            videoRef.current.src = nextSegmentUrl;
            await videoRef.current.play();
          }
        } catch (error) {
          console.error('Failed to load next segment:', error);
        }
      }
      
      // Buffer upcoming segments
      await bufferUpcomingSegments(selectedVideo, nextSegmentIndex);
    } else {
      // End of video
      setIsPlaying(false);
      toast.info('Video playback completed!');
    }
  };

  // Play/pause controls
  const togglePlayback = () => {
    if (!videoRef.current || !selectedVideo) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Initialize connection on component mount
  useEffect(() => {
    connectToTusky();
  }, []);

  // Update video source when current segment changes
  useEffect(() => {
    if (selectedVideo && segmentUrls.has(currentSegmentIndex)) {
      const segmentUrl = segmentUrls.get(currentSegmentIndex);
      if (videoRef.current && segmentUrl) {
        videoRef.current.src = segmentUrl;
      }
    }
  }, [currentSegmentIndex, segmentUrls, selectedVideo]);

  // Buffer upcoming segments when current segment changes
  useEffect(() => {
    if (selectedVideo && currentSegmentIndex >= 0) {
      bufferUpcomingSegments(selectedVideo, currentSegmentIndex);
    }
  }, [currentSegmentIndex, selectedVideo]);

  // Navigation functions
  const goToPreviousSegment = async () => {
    if (!selectedVideo || currentSegmentIndex <= 0) return;
    
    const prevSegmentIndex = currentSegmentIndex - 1;
    setCurrentSegmentIndex(prevSegmentIndex);
    
    if (segmentUrls.has(prevSegmentIndex)) {
      const segmentUrl = segmentUrls.get(prevSegmentIndex);
      if (videoRef.current && segmentUrl) {
        videoRef.current.src = segmentUrl;
        if (isPlaying) {
          try {
            await videoRef.current.play();
          } catch (error) {
            console.error('Failed to play previous segment:', error);
          }
        }
      }
    }
    
    await bufferUpcomingSegments(selectedVideo, prevSegmentIndex);
  };

  const goToNextSegment = async () => {
    if (!selectedVideo || currentSegmentIndex >= selectedVideo.segmentFileIds.length - 1) return;
    
    const nextSegmentIndex = currentSegmentIndex + 1;
    setCurrentSegmentIndex(nextSegmentIndex);
    
    if (segmentUrls.has(nextSegmentIndex)) {
      const segmentUrl = segmentUrls.get(nextSegmentIndex);
      if (videoRef.current && segmentUrl) {
        videoRef.current.src = segmentUrl;
        if (isPlaying) {
          try {
            await videoRef.current.play();
          } catch (error) {
            console.error('Failed to play next segment:', error);
          }
        }
      }
    } else {
      // Load segment if not buffered
      try {
        const segmentUrl = await streamSegment(selectedVideo.segmentFileIds[nextSegmentIndex], nextSegmentIndex);
        if (videoRef.current) {
          videoRef.current.src = segmentUrl;
          if (isPlaying) {
            await videoRef.current.play();
          }
        }
      } catch (error) {
        console.error('Failed to load next segment:', error);
      }
    }
    
    await bufferUpcomingSegments(selectedVideo, nextSegmentIndex);
  };

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">🎬 WalTube Stream</h1>
          <p className="text-gray-600 mb-6">Stream your videos from Walrus via Tusky</p>
          
          <Link 
            href="/"
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors mr-4"
          >
            ← Back to Home
          </Link>
          
          <Link 
            href="/storage"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            📁 Storage
          </Link>
        </div>

        {/* Connection Status */}
        <div className="bg-base-200 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="font-medium">
                {isConnected ? 'Connected to Tusky' : 'Disconnected'}
              </span>
            </div>
            
            {!isConnected && (
              <button
                onClick={connectToTusky}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Connect
              </button>
            )}
          </div>
        </div>

        {/* Video Player */}
        {selectedVideo && (
          <div className="bg-base-200 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">Now Playing: {selectedVideo.vaultName}</h2>
            
            <div className="relative bg-black rounded-lg overflow-hidden mb-4">
              <video
                ref={videoRef}
                className="w-full h-96 object-contain"
                controls
                onEnded={handleVideoEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              >
                Your browser does not support the video tag.
              </video>
              
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="text-white text-lg">Loading video...</div>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <div>Segment {currentSegmentIndex + 1} of {selectedVideo.segmentFileIds.length} • Buffered: {bufferedSegments.size} segments</div>
                <div className="flex items-center mt-2">
                  <span className="mr-2">Buffer Status:</span>
                  <div className="flex items-center">
                    {Array.from({length: Math.min(10, selectedVideo.segmentFileIds.length)}, (_, i) => {
                      const segmentIndex = Math.max(0, currentSegmentIndex - 2) + i;
                      if (segmentIndex >= selectedVideo.segmentFileIds.length) return null;
                      
                      const isBuffered = bufferedSegments.has(segmentIndex);
                      const isCurrent = segmentIndex === currentSegmentIndex;
                      const isLoading = isBuffering && !isBuffered;
                      
                      return (
                        <div
                          key={segmentIndex}
                          className={`w-3 h-3 rounded-full mr-1 ${
                            isCurrent ? 'bg-blue-600 ring-2 ring-blue-300' :
                            isBuffered ? 'bg-green-500' :
                            isLoading ? 'bg-yellow-500 animate-pulse' :
                            'bg-gray-300'
                          }`}
                          title={`Segment ${segmentIndex + 1} ${
                            isCurrent ? '(current)' :
                            isBuffered ? '(buffered)' :
                            isLoading ? '(loading)' :
                            '(pending)'
                          }`}
                        />
                      );
                    })}
                    {selectedVideo.segmentFileIds.length > 10 && (
                      <span className="text-xs text-gray-500 ml-1">...</span>
                    )}
                    {isBuffering && <span className="text-blue-600 text-xs ml-2">Buffering...</span>}
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={goToPreviousSegment}
                  disabled={currentSegmentIndex <= 0}
                  className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ⏮️ Prev
                </button>
                <button
                  onClick={togglePlayback}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                </button>
                <button
                  onClick={goToNextSegment}
                  disabled={currentSegmentIndex >= selectedVideo.segmentFileIds.length - 1}
                  className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next ⏭️
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video Library */}
        <div className="bg-base-200 rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4">📚 Video Library</h2>
          
          {storedVideos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No videos found in your Tusky vaults</p>
              <Link 
                href="/upload"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📤 Upload Your First Video
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storedVideos.map((video, index) => (
                <div 
                  key={index}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedVideo?.vaultId === video.vaultId 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
                  onClick={() => prepareVideoForStreaming(video)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800 truncate">{video.vaultName}</h3>
                    {selectedVideo?.vaultId === video.vaultId && (
                      <span className="text-blue-600 text-sm">▶️ Playing</span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    {video.segmentFileIds.length} segments
                  </p>
                  
                  <p className="text-xs text-gray-500">
                    Created: {new Date(video.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <ToastContainer position="bottom-right" />
    </div>
  );
};

export default VideoStreamPage;