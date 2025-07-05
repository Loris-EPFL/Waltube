import { NextRequest, NextResponse } from 'next/server';
import { Tusky } from '@tusky-io/ts-sdk';

// Hardcoded API key from environment
const TUSKY_API_KEY = '305842a1-27d9-4510-ac66-3339580fb91f';

// Global Tusky instance
let tuskyInstance: any = null;

// Initialize Tusky instance
async function getTuskyInstance() {
  if (!tuskyInstance) {
    tuskyInstance = new Tusky({ apiKey: TUSKY_API_KEY });
    await tuskyInstance.auth.signIn();
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
    await getTuskyInstance();
    return NextResponse.json({ success: true, message: 'Connected to Tusky' });
  } catch (error: any) {
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