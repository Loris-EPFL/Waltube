'use client';
import React, { useState, useEffect } from 'react';
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

interface StoredMP4Video {
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

interface VideoItem {
  vaultId: string;
  title: string;
  description: string;
  owner: string;
  thumbnail?: string;
  duration?: string;
  views?: number;
  uploadDate?: string;
  type: 'hls' | 'mp4';
  qualities?: { [quality: string]: any };
  totalSize?: number;
}

const VideoGalleryPage: React.FC = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [storedVideos, setStoredVideos] = useState<StoredVideo[]>([]);
  const [storedMP4Videos, setStoredMP4Videos] = useState<StoredMP4Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No hardcoded videos - using real data from API

  // Initialize connection to API
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
      
      // Load existing vaults
      await loadStoredVideos();
    } catch (error: any) {
      console.error('Failed to connect to Tusky:', error);
      toast.error(`Failed to connect: ${error.message}`);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Load stored videos from Tusky vaults
  const loadStoredVideos = async () => {
    try {
      const response = await fetch('/api/tusky?action=videos');
      if (!response.ok) {
        throw new Error('Failed to load videos');
      }
      
      const videos = await response.json();
      setStoredVideos(videos);
      
      // Also load MP4 videos
      let mp4Videos: StoredMP4Video[] = [];
      const mp4Response = await fetch('/api/tusky?action=mp4videos');
      if (mp4Response.ok) {
        mp4Videos = await mp4Response.json();
        setStoredMP4Videos(mp4Videos);
      }

      // Convert only MP4 videos to VideoItem format
      const combinedVideos: VideoItem[] = [
        ...mp4Videos.map((video: StoredMP4Video) => ({
          vaultId: video.vaultId,
          title: video.vaultName,
          description: `MP4 video with ${video.qualityCount} qualities (${(video.totalSize / 1024 / 1024).toFixed(2)} MB)`,
          owner: 'Decentralized User',
          uploadDate: video.createdAt,
          type: 'mp4' as const,
          qualities: video.qualities,
          totalSize: video.totalSize,
          thumbnail: video.thumbnail ? `/api/tusky?action=stream&fileId=${video.thumbnail.fileId}` : undefined,
          views: Math.floor(Math.random() * 5000) + 100, // Random views for demo
          duration: `${Math.floor(Math.random() * 30) + 5}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
        }))
      ];
      
      setVideos(combinedVideos);
    } catch (error: any) {
      console.error('Failed to load stored videos:', error);
      toast.error(`Failed to load videos: ${error.message}`);
    }
  };

  useEffect(() => {
    connectToTusky();
  }, []);

  const playVideo = async (video: VideoItem) => {
    try {
      setIsPlaying(true);
      setSelectedVideo(video);
      
      toast.info(`Opening ${video.type.toUpperCase()} player for: ${video.title}`);
      
      // Redirect to MP4 player
      window.open(`/mp4stream?video=${video.vaultId}`, '_blank');
      
    } catch (error: any) {
      console.error('Failed to play video:', error);
      toast.error(`Failed to play video: ${error.message}`);
    } finally {
      setIsPlaying(false);
      setSelectedVideo(null);
    }
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <ToastContainer />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400 rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-lg text-gray-900 dark:text-white">Loading videos...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <ToastContainer />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 text-xl mb-4">Failed to connect to video service</div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setIsLoading(true);
                connectToTusky();
              }}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      <ToastContainer />
      
      {/* Video Grid */}
      <div className="container mx-auto px-4 py-8 bg-white dark:bg-gray-900">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                ← Back to Home
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🎬 WALTUBE Gallery</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${isConnected ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {isConnected ? 'Connected to Tusky' : 'Disconnected'}
                </span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {videos.length} MP4 videos available
              </div>
            </div>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Discover MP4 Videos</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Browse MP4 videos from the decentralized network. Each video is stored using Walrus and can be streamed by anyone with the vault ID.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => (
            <div key={video.vaultId} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700">
              {/* Video Thumbnail */}
              <div className="relative">
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={`${video.title} thumbnail`}
                    className="aspect-video w-full object-cover rounded-t-lg"
                    onError={(e) => {
                      // Fallback to placeholder if thumbnail fails to load
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`aspect-video bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-t-lg flex items-center justify-center ${video.thumbnail ? 'hidden' : ''}`}>
                   <div className="text-center">
                     <div className="text-4xl mb-2">🎬</div>
                     <div className="text-xs text-gray-600 dark:text-gray-400">MP4</div>
                     <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">Vault: {video.vaultId.slice(0, 8)}...</div>
                   </div>
                 </div>
                
                {/* Video Type Badge */}
                 <div className="absolute top-2 left-2">
                   <span className="px-2 py-1 text-xs font-medium text-white bg-purple-600 rounded">
                     MP4
                   </span>
                 </div>
                
                {/* Duration */}
                {video.duration && (
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {video.duration}
                  </div>
                )}
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-black/30 rounded-t-lg cursor-pointer"
                     onClick={() => playVideo(video)}>
                  <button
                    disabled={isPlaying}
                    className="w-16 h-16 bg-purple-600 hover:bg-purple-700 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    {isPlaying && selectedVideo?.vaultId === video.vaultId ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Video Info */}
              <div className="p-4">
                <h3 className="text-base font-semibold line-clamp-2 text-gray-900 dark:text-white mb-2">
                  {video.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                  {video.description}
                </p>
                
                {/* Channel Info */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium">{video.owner.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{video.owner}</span>
                </div>

                {/* Video Stats */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span>{formatViews(video.views || 0)} views</span>
                  <span>{formatDate(video.uploadDate || '')}</span>
                </div>
                
                {/* Quality Info for MP4 videos */}
                {video.qualities && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Available qualities:</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(video.qualities).map((quality) => (
                        <span key={quality} className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded">
                          {quality}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-between items-center mt-3">
                  <button
                    onClick={() => playVideo(video)}
                    disabled={isPlaying}
                    className="flex-1 mr-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded transition-colors"
                  >
                    {isPlaying && selectedVideo?.vaultId === video.vaultId ? (
                      <div className="flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Loading...
                      </div>
                    ) : (
                      <>▶ Watch MP4</>
                    )}
                  </button>
                  <div className="relative group">
                    <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                      </svg>
                    </button>
                    <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                      <div className="py-1">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(video.vaultId);
                            toast.success('Vault ID copied to clipboard!');
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          Copy Vault ID
                        </button>
                        <button 
                          onClick={() => {
                            const shareUrl = `${window.location.origin}/mp4stream?video=${video.vaultId}`;
                            navigator.clipboard.writeText(shareUrl);
                            toast.success('Share link copied to clipboard!');
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          Copy Share Link
                        </button>
                        <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">
                          Report
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {videos.length === 0 && isConnected && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📹</div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">No MP4 videos found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              There are no MP4 videos available in the gallery at the moment.
            </p>
            <Link href="/storage" className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors">
              Upload Your First Video
            </Link>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="text-sm">
          MP4 videos are stored on Walrus decentralized storage and streamed via Tusky SDK
        </p>
        <div className="flex justify-center items-center gap-4 mt-2">
          <Link href="/storage" className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm transition-colors">
            Upload Videos
          </Link>
          <span className="text-xs">•</span>
          <Link href="/" className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm transition-colors">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VideoGalleryPage;