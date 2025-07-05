'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Navbar from '../components/Navbar';

interface VideoSegment {
  name: string;
  data: string; // base64 encoded
  size: number;
}

interface PlaylistData {
  content: string;
  fileName: string;
}

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
  mp4FileId: string;
  createdAt: string;
  fileSize: number;
}

const VideoStoragePage: React.FC = () => {
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [storedVideos, setStoredVideos] = useState<StoredVideo[]>([]);
  const [storedMP4Videos, setStoredMP4Videos] = useState<StoredMP4Video[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [videoName, setVideoName] = useState('');
  const [mp4VideoName, setMp4VideoName] = useState('');
  const [selectedMP4File, setSelectedMP4File] = useState<File | null>(null);
  const [isUploadingMP4, setIsUploadingMP4] = useState(false);
  const [hasLocalData, setHasLocalData] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      toast.success('Successfully connected to Tusky!');
      
      // Load existing vaults
      await loadStoredVideos();
    } catch (error: any) {
      console.error('Failed to connect to Tusky:', error);
      toast.error(`Failed to connect: ${error.message}`);
      setError(error.message);
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
      const mp4Response = await fetch('/api/tusky?action=mp4videos');
      if (mp4Response.ok) {
        const mp4Videos = await mp4Response.json();
        setStoredMP4Videos(mp4Videos);
      }
    } catch (error: any) {
      console.error('Failed to load stored videos:', error);
      toast.error(`Failed to load videos: ${error.message}`);
    }
  };

  // Load data from localStorage and auto-connect to Tusky on component mount
  useEffect(() => {
    const initializeComponent = async () => {
      loadFromLocalStorage();
      await connectToTusky();
      setIsInitializing(false);
    };
    
    initializeComponent();
  }, []);

  const loadFromLocalStorage = () => {
    try {
      const savedSegments = localStorage.getItem('waltube_segments');
      const savedPlaylist = localStorage.getItem('waltube_playlist');
      
      if (savedSegments && savedPlaylist) {
        const segmentsData: VideoSegment[] = JSON.parse(savedSegments);
        const playlistData: PlaylistData = JSON.parse(savedPlaylist);
        
        setSegments(segmentsData);
        setPlaylist(playlistData);
        setHasLocalData(true);
        toast.success(`Loaded ${segmentsData.length} segments from local storage`);
      } else {
        setHasLocalData(false);
      }
    } catch (error: any) {
      console.error('Failed to load from localStorage:', error);
      toast.error('Failed to load saved data');
      setHasLocalData(false);
    }
  };



  // Upload video to Tusky
  const uploadToTusky = async () => {
    if (!isConnected) {
      toast.error('Please connect to Tusky first');
      return;
    }

    if (segments.length === 0 || !playlist) {
      toast.error('No segments or playlist to upload');
      return;
    }

    if (!videoName.trim()) {
      toast.error('Please enter a video name');
      return;
    }

    setIsUploading(true);
    setUploadProgress({});

    try {
      const formData = new FormData();
      formData.append('videoName', videoName.trim());
      formData.append('playlist', JSON.stringify(playlist));
      formData.append('segments', JSON.stringify(segments));

      const response = await fetch('/api/tusky?action=upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      toast.success(`Successfully uploaded video "${videoName}" to Walrus via Tusky!`);
      setVideoName('');
      
      // Clear local data after successful upload
      localStorage.removeItem('waltube_segments');
      localStorage.removeItem('waltube_playlist');
      setSegments([]);
      setPlaylist(null);
      setHasLocalData(false);
      
      // Reload stored videos
      await loadStoredVideos();
      
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  // Upload MP4 video to Tusky
  const uploadMP4ToTusky = async () => {
    if (!isConnected) {
      toast.error('Please connect to Tusky first');
      return;
    }

    if (!selectedMP4File) {
      toast.error('Please select an MP4 file');
      return;
    }

    if (!mp4VideoName.trim()) {
      toast.error('Please enter a video name');
      return;
    }

    setIsUploadingMP4(true);

    try {
      const formData = new FormData();
      formData.append('videoName', mp4VideoName.trim());
      formData.append('mp4File', selectedMP4File);

      const response = await fetch('/api/tusky?action=uploadmp4', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('MP4 upload failed');
      }

      const result = await response.json();
      
      toast.success(`Successfully uploaded MP4 video "${mp4VideoName}" to Walrus via Tusky!`);
      setMp4VideoName('');
      setSelectedMP4File(null);
      
      // Reload stored videos
      await loadStoredVideos();
      
    } catch (error: any) {
      console.error('MP4 upload failed:', error);
      toast.error(`MP4 upload failed: ${error.message}`);
    } finally {
      setIsUploadingMP4(false);
    }
  };

  // Handle MP4 file selection
  const handleMP4FileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'video/mp4') {
      setSelectedMP4File(file);
      toast.success(`Selected MP4 file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      toast.error('Please select a valid MP4 file');
      setSelectedMP4File(null);
    }
  };

  // Stream video from Tusky
  const streamVideo = async (video: StoredVideo) => {
    if (!isConnected) {
      toast.error('Please connect to Tusky first');
      return;
    }

    try {
      toast.info('Downloading playlist...');
      
      const response = await fetch(`/api/tusky?action=download&fileId=${video.playlistFileId}`);
      if (!response.ok) {
        throw new Error('Failed to download playlist');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Download playlist for user
      const a = document.createElement('a');
      a.href = url;
      a.download = `${video.vaultName}_playlist.m3u8`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Playlist downloaded! Check your downloads folder.');
      
    } catch (error: any) {
      console.error('Download failed:', error);
      toast.error(`Download failed: ${error.message}`);
    }
  };

  // Download segment from Tusky
  const downloadSegment = async (video: StoredVideo, segmentIndex: number) => {
    if (!isConnected) {
      toast.error('Please connect to Tusky first');
      return;
    }

    try {
      const segmentFileId = video.segmentFileIds[segmentIndex];
      if (!segmentFileId) {
        toast.error('Segment not found');
        return;
      }

      toast.info(`Downloading segment ${segmentIndex + 1}...`);
      
      const response = await fetch(`/api/tusky?action=download&fileId=${segmentFileId}`);
      if (!response.ok) {
        throw new Error('Failed to download segment');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${video.vaultName}_segment_${segmentIndex.toString().padStart(3, '0')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Downloaded segment ${segmentIndex + 1}`);
      
    } catch (error: any) {
      console.error('Download failed:', error);
      toast.error(`Download failed: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <ToastContainer />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🗄️ WALTUBE Storage
          </h1>
          <p className="text-gray-600">
            Upload video segments to Walrus via Tusky SDK and stream them back
          </p>
        </div>

        {/* Tusky Connection */}
        <div className="w-full bg-base-200 rounded-lg shadow-xl p-6 mb-6">
          <div className="w-full">
            <h2 className="text-2xl font-bold mb-4">Tusky Connection</h2>
          {isInitializing ? (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-yellow-700 font-medium">Connecting to Tusky...</span>
            </div>
          ) : isConnected ? (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-green-700 font-medium">Connected to Tusky (Auto-configured)</span>
              <button
                onClick={() => {
                  setIsConnected(false);
                  connectToTusky();
                }}
                className="ml-4 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Reconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-red-700 font-medium">Connection failed</span>
              {error && <span className="text-red-600 text-sm">({error})</span>}
              <button
                onClick={connectToTusky}
                className="ml-4 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Retry Connection
              </button>
            </div>
          )}
          </div>
        </div>

        {/* Local Data Status 
        {isConnected && (
          <div className="bg-base-200 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Local Data Status</h2>
            {hasLocalData ? (
              <div className="space-y-2">
                <p className="text-green-600 font-medium">✓ Video data loaded from upload page</p>
                <p className="text-gray-600">Segments: {segments.length}</p>
                <p className="text-gray-600">Playlist: {playlist ? 'Ready' : 'Not available'}</p>
                <button
                  onClick={loadFromLocalStorage}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  Refresh Local Data
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-orange-600 font-medium">⚠ No local video data found</p>
                <p className="text-gray-600">Please process a video on the upload page first</p>
                <a 
                  href="/upload" 
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Go to Upload Page
                </a>
              </div>
            )}
          </div>
        )}
          */}

        {/* Upload Section - HLS Segments
        {isConnected && hasLocalData && segments.length > 0 && (
          <div className="bg-base-200 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📺 Upload HLS Video to Walrus</h2>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                Ready to upload {segments.length} video segments (HLS streaming)
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Name
                </label>
                <input
                  type="text"
                  value={videoName}
                  onChange={(e) => setVideoName(e.target.value)}
                  placeholder="Enter a name for your video"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <button
                onClick={uploadToTusky}
                disabled={isUploading || !videoName.trim()}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                {isUploading ? 'Uploading...' : 'Upload HLS to Walrus'}
              </button>
              
              {isUploading && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mt-1">
                    Uploading video segments to Walrus...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
           */}

        {/* Upload Section - MP4 Video */}
        {isConnected && (
          <div className="w-full bg-base-200 rounded-lg shadow-xl p-6 mb-6">
            <div className="w-full">
              <h2 className="text-2xl font-bold mb-4">🎬 Upload MP4 Video to Walrus</h2>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                Upload a complete MP4 video file for direct streaming
              </p>
            </div>

            <div className="space-y-4">
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select MP4 File
                </label>
                <input
                  type="file"
                  accept="video/mp4"
                  onChange={handleMP4FileSelect}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {selectedMP4File && (
                  <p className="text-sm text-green-600 mt-1">
                    Selected: {selectedMP4File.name} ({(selectedMP4File.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
              
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Name
                </label>
                <input
                  type="text"
                  value={mp4VideoName}
                  onChange={(e) => setMp4VideoName(e.target.value)}
                  placeholder="Enter a name for your MP4 video"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <button
                onClick={uploadMP4ToTusky}
                disabled={isUploadingMP4 || !selectedMP4File || !mp4VideoName.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {isUploadingMP4 ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                    Uploading MP4...
                  </>
                ) : (
                  'Upload MP4 to Walrus'
                )}
              </button>
              
              {isUploadingMP4 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mt-1">
                    Uploading MP4 video to Walrus...
                  </p>
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {/* Stored Videos 
        {isConnected && (
          <div className="bg-base-200 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">📺 Stored HLS Videos on Walrus</h2>
            
            {storedVideos.length === 0 ? (
              <p className="text-gray-600">No HLS videos stored yet.</p>
            ) : (
              <div className="space-y-4">
                {storedVideos.map((video, index) => (
                  <div key={video.vaultId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{video.vaultName}</h3>
                        <p className="text-sm text-gray-600">
                          Vault ID: {video.vaultId}
                        </p>
                        <p className="text-sm text-gray-600">
                          Segments: {video.segmentFileIds.length}
                        </p>
                        <p className="text-sm text-gray-600">
                          Created: {new Date(video.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="space-x-2">
                        <button
                          onClick={() => streamVideo(video)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          📺 Stream Playlist
                        </button>
                        <Link
                          href={`/stream?video=${video.vaultId}`}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          🎬 Watch HLS
                        </Link>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Download Segments:</p>
                      <div className="flex flex-wrap gap-2">
                        {video.segmentFileIds.map((_, segmentIndex) => (
                          <button
                            key={segmentIndex}
                            onClick={() => downloadSegment(video, segmentIndex)}
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                          >
                            Segment {segmentIndex + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        */}

        {/* Stored MP4 Videos */}
        {isConnected && (
          <div className="bg-base-200 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">🎬 Stored MP4 Videos on Walrus</h2>
            
            {storedMP4Videos.length === 0 ? (
              <p className="text-gray-600">No MP4 videos stored yet.</p>
            ) : (
              <div className="space-y-4">
                {storedMP4Videos.map((video, index) => (
                  <div key={video.vaultId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{video.vaultName}</h3>
                        <p className="text-sm text-gray-600">
                          Vault ID: {video.vaultId}
                        </p>
                        <p className="text-sm text-gray-600">
                          File Size: {(video.fileSize / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <p className="text-sm text-gray-600">
                          Created: {new Date(video.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="space-x-2">
                        <Link
                          href={`/mp4stream?video=${video.vaultId}`}
                          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                        >
                          🎬 Watch MP4
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 text-center">
          {/* <Link
            href="/upload"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors mr-4"
          >
            ← Back to Upload
          </Link> */}
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            🏠 Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VideoStoragePage;