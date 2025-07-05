'use client';
import {usePrivy} from '@privy-io/react-auth';
import {useRouter} from 'next/navigation';
import Login from './components/Login';
import Wallets from './components/Wallets';
import Navbar from './components/Navbar';

export default function Home() {
  const {ready} = usePrivy();
  if (!ready) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="bg-base-200">
      <Navbar />
      <div className="w-full py-8">
        {/* Main Content */}
        <div className="w-full max-w-none mx-auto mb-12">
          <div className="mb-8">
            <Login />
          </div>
          <div className="w-full">
            <Wallets />
          </div>
        </div>
        
        {/* Features Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-8">Platform Features</h2>
          
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            <a href="/storage" className="btn btn-primary btn-lg gap-2 shadow-lg">
              📁 Store to Walrus
            </a>
            <a href="/storage" className="btn btn-secondary btn-lg gap-2 shadow-lg">
              📤 Upload Videos
            </a>
            <a href="/mp4stream" className="btn btn-accent btn-lg gap-2 shadow-lg">
              🎬 Stream Content
            </a>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="w-full bg-white rounded-lg shadow-lg p-6">
              <div className="text-center">
                <div className="text-4xl mb-4">📁</div>
                <h3 className="text-lg font-bold mb-2">Walrus Storage</h3>
                <p className="text-gray-600">
                  Upload your processed video segments to Walrus storage using Tusky SDK for decentralized storage
                </p>
              </div>
            </div>
            
            <div className="w-full bg-white rounded-lg shadow-lg p-6">
              <div className="text-center">
                <div className="text-4xl mb-4">📤</div>
                <h3 className="text-lg font-bold mb-2">Video Upload</h3>
                <p className="text-gray-600">
                  Upload MP4 videos and automatically store them into Walrus, and share / sell them.
                </p>
              </div>
            </div>
            
            <div className="w-full bg-white rounded-lg shadow-lg p-6">
              <div className="text-center">
                <div className="text-4xl mb-4">🎬</div>
                <h3 className="text-lg font-bold mb-2">Video Streaming</h3>
                <p className="text-gray-600">
                  Stream your stored videos directly from Walrus with progressive loading and high quality
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
