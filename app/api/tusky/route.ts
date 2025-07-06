import { NextRequest, NextResponse } from 'next/server';
import { Tusky } from '@tusky-io/ts-sdk';

// Get API key from environment
const TUSKY_API_KEY = process.env.TUSKY_API_KEY;

// Global Tusky instance
let tuskyInstance: any = null;

// Reset Tusky instance (useful for reconnection)
function resetTuskyInstance() {
  tuskyInstance = null;
}

// Initialize Tusky instance
async function getTuskyInstance() {
  if (!TUSKY_API_KEY) {
    throw new Error('TUSKY_API_KEY environment variable is not set');
  }
  
  if (!tuskyInstance) {
    try {
      // Initialize Tusky with API key
      tuskyInstance = new Tusky({ apiKey: TUSKY_API_KEY });
      
      // Check if the SDK requires explicit sign-in or if API key is sufficient
      // Some versions of Tusky SDK may not require explicit signIn() call
      try {
        await tuskyInstance.auth.signIn();
      } catch (authError: any) {
        // If signIn fails but the instance is created, it might work without explicit auth
        console.warn('Auth signIn failed, but continuing with API key auth:', authError.message);
        
        // Test if the instance works by trying a simple operation
        try {
          await tuskyInstance.vault.listAll();
          console.log('Tusky instance working without explicit signIn');
        } catch (testError: any) {
          console.error('Tusky instance test failed:', testError);
          tuskyInstance = null;
          throw new Error(`Failed to authenticate with Tusky: ${authError.message}`);
        }
      }
    } catch (error: any) {
      console.error('Tusky initialization failed:', error);
      tuskyInstance = null;
      throw new Error(`Failed to initialize Tusky: ${error.message}`);
    }
  }
  return tuskyInstance;
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    
    switch (action) {
      case 'connect':
        return await handleConnect();
      case 'upload':
        return await handleUpload(request);
      case 'uploadmp4':
        return await handleUploadMP4(request);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    
    switch (action) {
      case 'videos':
        return await handleGetVideos();
      case 'mp4videos':
        return await handleGetMP4Videos();
      case 'download':
        const fileId = url.searchParams.get('fileId');
        if (!fileId) {
          return NextResponse.json({ error: 'File ID required' }, { status: 400 });
        }
        return await handleDownload(fileId);
      case 'stream':
        const streamFileId = url.searchParams.get('fileId');
        if (!streamFileId) {
          return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
        }
        return await handleStream(streamFileId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleConnect() {
  try {
    // Reset instance to force fresh connection
    resetTuskyInstance();
    
    const tusky = await getTuskyInstance();
    
    // Test the connection with a simple operation
    await tusky.vault.listAll();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Connected to Tusky successfully',
      apiKeyConfigured: !!TUSKY_API_KEY
    });
  } catch (error: any) {
    console.error('Connection test failed:', error);
    resetTuskyInstance();
    throw new Error(`Failed to connect to Tusky: ${error.message}`);
  }
}

async function handleUpload(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoName = formData.get('videoName') as string;
    const playlistData = JSON.parse(formData.get('playlist') as string);
    const segments = JSON.parse(formData.get('segments') as string);
    
    const tusky = await getTuskyInstance();
    
    // Create vault for this video
    const vaultName = `WALTUBE_VIDEO_${videoName}`;
    const { id: vaultId } = await tusky.vault.create(vaultName, { encrypted: false });
    
    // Create segments folder
    const { id: segmentsFolderId } = await tusky.folder.create(vaultId, 'segments');
    
    // Upload playlist file
    const playlistBlob = new Blob([playlistData.content], { type: 'application/vnd.apple.mpegurl' });
    const playlistUploadId = await tusky.file.upload(vaultId, playlistBlob, {
      name: 'playlist.m3u8',
      mimeType: 'application/vnd.apple.mpegurl'
    });
    
    // Upload segments
    const segmentFileIds: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentName = `segment_${i.toString().padStart(3, '0')}.webm`;
      
      // Convert base64 to blob
      const segmentBlob = new Blob(
        [Uint8Array.from(atob(segment.data), c => c.charCodeAt(0))], 
        { type: 'video/webm' }
      );
      
      const segmentUploadId = await tusky.file.upload(vaultId, segmentBlob, {
        name: segmentName,
        mimeType: 'video/webm',
        parentId: segmentsFolderId
      });
      
      segmentFileIds.push(segmentUploadId);
    }
    
    return NextResponse.json({
      success: true,
      vaultId,
      playlistFileId: playlistUploadId,
      segmentFileIds
    });
  } catch (error: any) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

async function handleGetVideos() {
  try {
    const tusky = await getTuskyInstance();
    const vaults = await tusky.vault.listAll();
    const videoVaults = vaults.filter((vault: any) => 
      vault.name.startsWith('WALTUBE_VIDEO_')
    );
    
    const stored: any[] = [];
    for (const vault of videoVaults) {
      try {
        const files = await tusky.file.listAll({ vaultId: vault.id });
        const playlistFile = files.find((f: any) => f.name === 'playlist.m3u8');
        const segmentFiles = files.filter((f: any) => f.name.startsWith('segment_'));
        
        if (playlistFile) {
          stored.push({
            vaultId: vault.id,
            vaultName: vault.name.replace('WALTUBE_VIDEO_', ''),
            playlistFileId: playlistFile.id,
            segmentFileIds: segmentFiles.map((f: any) => f.id),
            createdAt: vault.createdAt || new Date().toISOString()
          });
        }
      } catch (error) {
        console.warn(`Failed to load vault ${vault.id}:`, error);
      }
    }
    
    return NextResponse.json(stored);
  } catch (error: any) {
    throw new Error(`Failed to get videos: ${error.message}`);
  }
}

async function handleDownload(fileId: string) {
  try {
    const tusky = await getTuskyInstance();
    const buffer = await tusky.file.arrayBuffer(fileId);
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment'
      }
    });
  } catch (error: any) {
    throw new Error(`Download failed: ${error.message}`);
  }
}

async function handleStream(fileId: string) {
  try {
    const tusky = await getTuskyInstance();
    const stream = await tusky.file.stream(fileId);
    
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error: any) {
    throw new Error(`Stream failed: ${error.message}`);
  }
}

async function handleUploadMP4(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoName = formData.get('videoName') as string;
    const qualities = JSON.parse(formData.get('qualities') as string || '[]');
    const thumbnail = formData.get('thumbnail') as File | null;
    
    if (!videoName || qualities.length === 0) {
      throw new Error('Video name and at least one quality are required');
    }
    
    const tusky = await getTuskyInstance();
    
    // Create vault for this MP4 video
    const vaultName = `WALTUBE_MP4_${videoName}`;
    const { id: vaultId } = await tusky.vault.create(vaultName, { encrypted: false });
    
    const uploadedFiles: any = {
      qualities: {},
      thumbnail: null
    };
    
    // Upload thumbnail if provided
    if (thumbnail) {
      const thumbnailUploadId = await tusky.file.upload(vaultId, thumbnail, {
        name: 'thumbnail.png',
        mimeType: 'image/png'
      });
      uploadedFiles.thumbnail = {
        fileId: thumbnailUploadId,
        fileName: 'thumbnail.png',
        fileSize: thumbnail.size
      };
    }
    
    // Upload video files for each quality
    for (const quality of qualities) {
      const videoFile = formData.get(`video_${quality}`) as File;
      if (videoFile) {
        const videoUploadId = await tusky.file.upload(vaultId, videoFile, {
          name: `${videoName}_${quality}.mp4`,
          mimeType: 'video/mp4'
        });
        
        uploadedFiles.qualities[quality] = {
          fileId: videoUploadId,
          fileName: `${videoName}_${quality}.mp4`,
          fileSize: videoFile.size
        };
      }
    }
    
    return NextResponse.json({
      success: true,
      vaultId,
      vaultName: videoName,
      uploadedFiles,
      qualityCount: qualities.length
    });
  } catch (error: any) {
    throw new Error(`MP4 upload failed: ${error.message}`);
  }
}

async function handleGetMP4Videos() {
  try {
    const tusky = await getTuskyInstance();
    const vaults = await tusky.vault.listAll();
    const mp4Vaults = vaults.filter((vault: any) => 
      vault.name.startsWith('WALTUBE_MP4_')
    );
    
    const stored: any[] = [];
    for (const vault of mp4Vaults) {
      try {
        const files = await tusky.file.listAll({ vaultId: vault.id });
        
        // Find thumbnail
        const thumbnailFile = files.find((f: any) => f.name === 'thumbnail.png');
        
        // Find video files by quality
        const videoFiles = files.filter((f: any) => f.name.endsWith('.mp4'));
        const qualities: any = {};
        let totalSize = 0;
        
        for (const videoFile of videoFiles) {
          // Extract quality from filename (e.g., "video_720p.mp4")
          const qualityMatch = videoFile.name.match(/_([0-9]+p)\.mp4$/);
          if (qualityMatch) {
            const quality = qualityMatch[1];
            qualities[quality] = {
              fileId: videoFile.id,
              fileName: videoFile.name,
              fileSize: videoFile.size || 0
            };
            totalSize += videoFile.size || 0;
          }
        }
        
        if (Object.keys(qualities).length > 0) {
          stored.push({
            vaultId: vault.id,
            vaultName: vault.name.replace('WALTUBE_MP4_', ''),
            qualities,
            thumbnail: thumbnailFile ? {
              fileId: thumbnailFile.id,
              fileName: thumbnailFile.name,
              fileSize: thumbnailFile.size || 0
            } : null,
            totalSize,
            qualityCount: Object.keys(qualities).length,
            createdAt: vault.createdAt || new Date().toISOString()
          });
        }
      } catch (error) {
        console.warn(`Failed to load MP4 vault ${vault.id}:`, error);
      }
    }
    
    return NextResponse.json(stored);
  } catch (error: any) {
    throw new Error(`Failed to get MP4 videos: ${error.message}`);
  }
}