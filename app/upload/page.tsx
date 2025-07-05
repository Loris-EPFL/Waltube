'use client';
import React, { useState, useRef } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Navbar from '../components/Navbar';

interface VideoSegment {
  blob: Blob;
  duration: number;
  index: number;
}

const VideoUploadPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setSegments([]);
      setProgress(0);
      toast.success('Video file selected successfully!');
    } else {
      toast.error('Please select a valid video file (MP4 format recommended)');
    }
  };

  const createHLSSegments = async () => {
    if (!selectedFile || !videoRef.current) {
      toast.error('Please select a video file first');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!canvas) {
        throw new Error('Canvas element not found');
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Load the video
      const videoUrl = URL.createObjectURL(selectedFile);
      video.src = videoUrl;
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      const duration = video.duration;
      const segmentDuration = 10; // 10 seconds per segment
      const totalSegments = Math.ceil(duration / segmentDuration);
      const newSegments: VideoSegment[] = [];

      toast.info(`Processing video into ${totalSegments} segments...`);

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      for (let i = 0; i < totalSegments; i++) {
        const startTime = i * segmentDuration;
        const endTime = Math.min((i + 1) * segmentDuration, duration);
        const actualDuration = endTime - startTime;

        // Create MediaRecorder for this segment
        const stream = canvas.captureStream(30); // 30 FPS
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm; codecs=vp9'
        });

        const chunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        const segmentPromise = new Promise<VideoSegment>((resolve) => {
          mediaRecorder.onstop = () => {
            const segmentBlob = new Blob(chunks, { type: 'video/webm' });
            resolve({
              blob: segmentBlob,
              duration: actualDuration,
              index: i
            });
          };
        });

        // Start recording
        mediaRecorder.start();
        
        // Seek to start time and play segment
        video.currentTime = startTime;
        await new Promise(resolve => {
          video.onseeked = resolve;
        });

        // Record the segment by drawing frames to canvas
        const frameRate = 30;
        const frameInterval = 1000 / frameRate;
        const totalFrames = Math.floor(actualDuration * frameRate);
        
        for (let frame = 0; frame < totalFrames; frame++) {
          const currentTime = startTime + (frame / frameRate);
          video.currentTime = currentTime;
          
          await new Promise(resolve => {
            video.onseeked = resolve;
          });
          
          // Draw current frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Wait for next frame
          await new Promise(resolve => setTimeout(resolve, frameInterval));
        }

        // Stop recording
        mediaRecorder.stop();
        
        // Wait for segment to be created
        const segment = await segmentPromise;
        newSegments.push(segment);
        
        // Update progress
        const progressPercent = ((i + 1) / totalSegments) * 100;
        setProgress(progressPercent);
        
        toast.info(`Segment ${i + 1}/${totalSegments} created`);
      }

      setSegments(newSegments);
      toast.success(`Successfully created ${newSegments.length} HLS segments!`);
      
      // Clean up
      URL.revokeObjectURL(videoUrl);
      
    } catch (error: any) {
      console.error('Error processing video:', error);
      toast.error(`Failed to process video: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSegment = (segment: VideoSegment) => {
    const url = URL.createObjectURL(segment.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `segment_${segment.index.toString().padStart(3, '0')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded segment ${segment.index + 1}`);
  };

  const downloadAllSegments = () => {
    segments.forEach((segment, index) => {
      setTimeout(() => downloadSegment(segment), index * 100);
    });
  };

  const generateM3U8Playlist = () => {
    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:3\n';
    playlist += '#EXT-X-TARGETDURATION:10\n';
    playlist += '#EXT-X-MEDIA-SEQUENCE:0\n';
    
    segments.forEach((segment, index) => {
      playlist += `#EXTINF:${segment.duration.toFixed(6)},\n`;
      playlist += `segment_${index.toString().padStart(3, '0')}.webm\n`;
    });
    
    playlist += '#EXT-X-ENDLIST\n';
    
    const blob = new Blob([playlist], { type: 'application/vnd.apple.mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playlist.m3u8';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('M3U8 playlist downloaded!');
  };

  // Save segments and playlist to localStorage for storage page
  const saveToStorage = async () => {
    if (segments.length === 0) {
      toast.error('No segments to save');
      return;
    }

    try {
      // Convert segments to serializable format with proper base64 encoding
      const segmentsData = await Promise.all(
        segments.map(async (segment, index) => {
          const arrayBuffer = await segment.blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Use FileReader for safe base64 conversion to avoid stack overflow
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              // Remove the data URL prefix to get just the base64 data
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(segment.blob);
          });
          
          return {
            name: `segment_${index.toString().padStart(3, '0')}.webm`,
            data: base64,
            size: segment.blob.size
          };
        })
      );

      // Generate playlist content
      let playlistContent = '#EXTM3U\n';
      playlistContent += '#EXT-X-VERSION:3\n';
      playlistContent += '#EXT-X-TARGETDURATION:10\n';
      playlistContent += '#EXT-X-MEDIA-SEQUENCE:0\n';
      
      segments.forEach((segment, index) => {
        playlistContent += `#EXTINF:${segment.duration.toFixed(6)},\n`;
        playlistContent += `segment_${index.toString().padStart(3, '0')}.webm\n`;
      });
      
      playlistContent += '#EXT-X-ENDLIST\n';

      // Save to localStorage
      localStorage.setItem('waltube_segments', JSON.stringify(segmentsData));
      localStorage.setItem('waltube_playlist', JSON.stringify({ 
        content: playlistContent,
        fileName: 'playlist.m3u8'
      }));
      
      toast.success('Segments and playlist saved for storage!');
    } catch (error: any) {
      console.error('Failed to save to storage:', error);
      toast.error(`Failed to save: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <ToastContainer />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
            WALTUBE Video Upload & HLS Segmentation
          </h1>
          
          <div className="mb-8">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
                id="video-upload"
              />
              <label
                htmlFor="video-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-lg font-medium text-gray-600">
                  {selectedFile ? selectedFile.name : 'Click to upload MP4 video'}
                </span>
                <span className="text-sm text-gray-400 mt-2">
                  Supports MP4, WebM, and other video formats
                </span>
              </label>
            </div>
          </div>

          {selectedFile && (
            <div className="mb-8">
              <video
                ref={videoRef}
                className="w-full max-w-md mx-auto rounded-lg shadow-md"
                controls
                preload="metadata"
              >
                <source src={URL.createObjectURL(selectedFile)} type={selectedFile.type} />
                Your browser does not support the video tag.
              </video>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          <div className="text-center mb-8">
            <button
              onClick={createHLSSegments}
              disabled={!selectedFile || isProcessing}
              className={`px-8 py-3 rounded-lg font-medium text-white transition-colors ${
                !selectedFile || isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isProcessing ? 'Processing...' : 'Create HLS Segments'}
            </button>
          </div>

          {isProcessing && (
            <div className="mb-8">
              <div className="bg-gray-200 rounded-full h-4 mb-2">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-center text-gray-600">{Math.round(progress)}% Complete</p>
            </div>
          )}

          {segments.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  Generated Segments ({segments.length})
                </h2>
                <div className="space-x-2">
                  <button
                    onClick={generateM3U8Playlist}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Download M3U8
                  </button>
                  <button
                    onClick={downloadAllSegments}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Download All
                  </button>
                  <button
                    onClick={saveToStorage}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Save for Tusky Storage
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {segments.map((segment) => (
                  <div key={segment.index} className="bg-white rounded-lg p-4 shadow">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-800">
                        Segment {segment.index + 1}
                      </span>
                      <span className="text-sm text-gray-600">
                        {segment.duration.toFixed(2)}s
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        {(segment.blob.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      <button
                        onClick={() => downloadSegment(segment)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">How it works:</h3>
            <ul className="text-blue-700 space-y-2">
              <li>• Upload your MP4 video file</li>
              <li>• Video is automatically split into 10-second segments</li>
              <li>• Each segment is encoded as WebM for web compatibility</li>
              <li>• M3U8 playlist file is generated for HLS streaming</li>
              <li>• Segments can be downloaded individually or as a batch</li>
              <li>• Perfect for adaptive streaming and progressive loading</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoUploadPage;