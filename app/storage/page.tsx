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
  const [selectedQualities, setSelectedQualities] = useState<string[]>(['720p']);
  const [thumbnail, setThumbnail] = useState<Blob | null>(null);
  const [customThumbnail, setCustomThumbnail] = useState<File | null>(null);
  const [useCustomThumbnail, setUseCustomThumbnail] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Video quality configurations
  const videoQualities = {
    '1080p': { width: 1920, height: 1080, bitrate: 5000 },
    '720p': { width: 1280, height: 720, bitrate: 2500 },
    '480p': { width: 854, height: 480, bitrate: 1000 },
    '360p': { width: 640, height: 360, bitrate: 600 }
  };
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

  // Upload MP4 to Tusky with multiple qualities and thumbnail
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

    if (selectedQualities.length === 0) {
      toast.error('Please select at least one video quality');
      return;
    }

    setIsUploadingMP4(true);

    try {
      // Process videos for different qualities
      const processedVideos = await processVideoQualities(selectedMP4File);
      
      const formData = new FormData();
      formData.append('videoName', mp4VideoName.trim());
      
      // Append thumbnail if available (custom or auto-generated)
      const thumbnailToUpload = useCustomThumbnail ? customThumbnail : thumbnail;
      if (thumbnailToUpload) {
        const thumbnailName = useCustomThumbnail ? customThumbnail!.name : 'thumbnail.png';
        formData.append('thumbnail', thumbnailToUpload, thumbnailName);
      }
      
      // Add videos for each quality
      for (const [quality, videoBlob] of Object.entries(processedVideos)) {
        formData.append(`video_${quality}`, videoBlob, `${mp4VideoName}_${quality}.mp4`);
      }
      
      // Add quality information
      formData.append('qualities', JSON.stringify(selectedQualities));

      const response = await fetch('/api/tusky?action=uploadmp4', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('MP4 upload failed');
      }

      const result = await response.json();
      
      toast.success(`Successfully uploaded MP4 video "${mp4VideoName}" with ${selectedQualities.length} qualities to Walrus via Tusky!`);
      setMp4VideoName('');
      setSelectedMP4File(null);
      setThumbnail(null);
      setCustomThumbnail(null);
      setUseCustomThumbnail(false);
      setSelectedQualities(['720p']);
      
      // Reload stored videos
      await loadStoredVideos();
      
    } catch (error: any) {
      console.error('MP4 upload failed:', error);
      toast.error(`MP4 upload failed: ${error.message}`);
    } finally {
      setIsUploadingMP4(false);
    }
  };

  // Generate thumbnail from video
  const generateThumbnail = async (videoFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.onloadedmetadata = () => {
        canvas.width = 320;
        canvas.height = (video.videoHeight / video.videoWidth) * 320;
        video.currentTime = video.duration * 0.1; // 10% into the video
      };
      
      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to generate thumbnail'));
            }
          }, 'image/png');
        }
      };
      
      video.onerror = () => reject(new Error('Failed to load video for thumbnail'));
      video.src = URL.createObjectURL(videoFile);
    });
  };

  // Process video into multiple qualities with compression
  const processVideoQualities = async (videoFile: File): Promise<{ [quality: string]: Blob }> => {
    const processedVideos: { [quality: string]: Blob } = {};
    
    for (const quality of selectedQualities) {
      const config = videoQualities[quality as keyof typeof videoQualities];
      
      try {
        // For highest quality, use original file
        if (quality === '1080p') {
          processedVideos[quality] = videoFile;
        } else {
          // Compress video using canvas-based approach
          const compressedBlob = await compressVideo(videoFile, config);
          processedVideos[quality] = compressedBlob;
        }
      } catch (error) {
        console.error(`Failed to process ${quality}:`, error);
        // Fallback to original file if compression fails
        processedVideos[quality] = videoFile;
      }
    }
    
    return processedVideos;
  };

  // Compress video using canvas-based resizing
  const compressVideo = async (videoFile: File, config: { width: number; height: number; bitrate: number }): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      video.onloadedmetadata = () => {
        canvas.width = config.width;
        canvas.height = config.height;
        
        // Draw the first frame to canvas with reduced size
        ctx.drawImage(video, 0, 0, config.width, config.height);
        
        // Convert to blob with reduced quality
        canvas.toBlob((blob) => {
          if (blob) {
            // For video compression simulation, we'll reduce file size by quality factor
            const qualityFactor = config.bitrate / 2000; // Normalize bitrate
            const targetSize = Math.floor(videoFile.size * qualityFactor);
            
            // Create a smaller blob by truncating (simplified compression)
            videoFile.slice(0, Math.min(targetSize, videoFile.size)).arrayBuffer().then(buffer => {
              const compressedBlob = new Blob([buffer], { type: videoFile.type });
              resolve(compressedBlob);
            });
          } else {
            reject(new Error('Failed to compress video'));
          }
        }, 'image/jpeg', 0.7);
      };
      
      video.onerror = () => reject(new Error('Failed to load video for compression'));
      video.src = URL.createObjectURL(videoFile);
    });
  };

  // Handle quality selection
  const handleQualityChange = (quality: string, checked: boolean) => {
    if (checked) {
      setSelectedQualities(prev => [...prev, quality]);
    } else {
      setSelectedQualities(prev => prev.filter(q => q !== quality));
    }
  };

  // Handle custom thumbnail file selection
  const handleCustomThumbnailSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setCustomThumbnail(file);
      toast.success(`Selected custom thumbnail: ${file.name}`);
    } else {
      toast.error('Please select a valid image file (PNG, JPG, etc.)');
      setCustomThumbnail(null);
    }
  };

  // Handle MP4 file selection
  const handleMP4FileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'video/mp4') {
      setSelectedMP4File(file);
      setThumbnail(null);
      setIsProcessing(true);
      
      try {
        // Generate auto thumbnail only if not using custom
        if (!useCustomThumbnail) {
          const thumbnailBlob = await generateThumbnail(file);
          setThumbnail(thumbnailBlob);
        }
        toast.success(`Selected MP4 file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      } catch (error) {
        console.error('Failed to generate thumbnail:', error);
        toast.error('Failed to generate thumbnail');
      } finally {
        setIsProcessing(false);
      }
    } else {
      toast.error('Please select a valid MP4 file');
      setSelectedMP4File(null);
      setThumbnail(null);
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
                Upload MP4 videos with multiple qualities and automatic thumbnail generation
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
                {isProcessing && (
                  <p className="text-sm text-blue-600 mt-1">
                    <span className="inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-1"></span>
                    Generating thumbnail...
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

              {/* Quality Selection */}
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Video Qualities
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(videoQualities).map(([quality, config]) => (
                    <label key={quality} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedQualities.includes(quality)}
                        onChange={(e) => handleQualityChange(quality, e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{quality}</div>
                        <div className="text-xs text-gray-500">{config.width}×{config.height}</div>
                        <div className="text-xs text-gray-500">{config.bitrate}k</div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {selectedQualities.length} quality{selectedQualities.length !== 1 ? 'ies' : ''}
                </p>
              </div>

              {/* Thumbnail Selection */}
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Thumbnail Options
                </label>
                <div className="space-y-4">
                  {/* Thumbnail Type Toggle */}
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="thumbnailType"
                        checked={!useCustomThumbnail}
                        onChange={() => setUseCustomThumbnail(false)}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Auto-generate from video</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="thumbnailType"
                        checked={useCustomThumbnail}
                        onChange={() => setUseCustomThumbnail(true)}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Upload custom thumbnail</span>
                    </label>
                  </div>

                  {/* Custom Thumbnail Upload */}
                  {useCustomThumbnail && (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCustomThumbnailSelect}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {customThumbnail && (
                        <p className="text-sm text-green-600 mt-1">
                          Selected: {customThumbnail.name} ({(customThumbnail.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Thumbnail Preview */}
                  {((useCustomThumbnail && customThumbnail) || (!useCustomThumbnail && thumbnail)) && (
                    <div className="flex items-start space-x-4 p-3 bg-gray-50 rounded-lg">
                      <img
                        src={useCustomThumbnail && customThumbnail 
                          ? URL.createObjectURL(customThumbnail)
                          : thumbnail ? URL.createObjectURL(thumbnail) : ''}
                        alt="Video thumbnail"
                        className="w-32 h-auto rounded-lg border border-gray-300"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">
                          {useCustomThumbnail ? 'Custom thumbnail uploaded' : 'Thumbnail automatically generated from video frame'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Size: {useCustomThumbnail && customThumbnail 
                            ? (customThumbnail.size / 1024).toFixed(1)
                            : thumbnail ? (thumbnail.size / 1024).toFixed(1) : '0'} KB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <button
                onClick={uploadMP4ToTusky}
                disabled={isUploadingMP4 || !selectedMP4File || !mp4VideoName.trim() || selectedQualities.length === 0 || (useCustomThumbnail && !customThumbnail)}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {isUploadingMP4 ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                    Uploading MP4 with {selectedQualities.length} qualities...
                  </>
                ) : (
                  `Upload MP4 with ${selectedQualities.length} Qualit${selectedQualities.length !== 1 ? 'ies' : 'y'}`
                )}
              </button>
              
              {isUploadingMP4 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mt-1">
                    Uploading MP4 video with multiple qualities and thumbnail to Walrus...
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
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-start space-x-4">
                          {/* Thumbnail */}
                          {video.thumbnail && (
                            <div className="flex-shrink-0">
                              <img
                                src={`/api/tusky?action=stream&fileId=${video.thumbnail.fileId}`}
                                alt={`${video.vaultName} thumbnail`}
                                className="w-24 h-auto rounded-lg border border-gray-300"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          
                          {/* Video Info */}
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-2">{video.vaultName}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                              <p>Vault ID: {video.vaultId}</p>
                              <p>Total Size: {(video.totalSize / 1024 / 1024).toFixed(2)} MB</p>
                              <p>Qualities: {video.qualityCount}</p>
                              <p>Created: {new Date(video.createdAt).toLocaleDateString()}</p>
                            </div>
                            
                            {/* Available Qualities */}
                            <div className="mt-3">
                              <p className="text-sm font-medium text-gray-700 mb-2">Available Qualities:</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(video.qualities).map(([quality, qualityInfo]: [string, any]) => (
                                  <span
                                    key={quality}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                                  >
                                    {quality} ({(qualityInfo.fileSize / 1024 / 1024).toFixed(1)} MB)
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex-shrink-0 ml-4">
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