'use client';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';

export default function Navbar() {
  const { ready, authenticated, user, logout } = usePrivy();

  return (
    <div className="navbar bg-base-100 shadow-lg">
      <div className="navbar-start">
        <div className="dropdown">
          <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h8m-8 6h16"
              />
            </svg>
          </div>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow"
          >
            <li><Link href="/">Home</Link></li>
            <li><Link href="/storage">Storage</Link></li>
            <li><Link href="/mp4stream">MP4 Stream</Link></li>
          </ul>
        </div>
        <Link href="/" className="btn btn-ghost text-xl font-bold">
          🎬 WALTUBE
        </Link>
      </div>
      
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1">
          <li><Link href="/" className="btn btn-ghost">Home</Link></li>
          <li><Link href="/storage" className="btn btn-ghost">📁 Storage</Link></li>
          <li><Link href="/mp4stream" className="btn btn-ghost">🎬 MP4 Stream</Link></li>
        </ul>
      </div>
      
      <div className="navbar-end">
        {ready && authenticated ? (
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full bg-primary text-primary-content flex items-center justify-center">
                <span className="text-sm font-bold">
                  {user?.email?.charAt(0).toUpperCase() || user?.phone?.charAt(0) || '👤'}
                </span>
              </div>
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow"
            >
              <li>
                <div className="justify-between">
                  Profile
                  <span className="badge badge-sm">New</span>
                </div>
              </li>
              <li><a>Settings</a></li>
              <li><button onClick={logout} className="text-error">Logout</button></li>
            </ul>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="badge badge-outline">Not authenticated</div>
          </div>
        )}
      </div>
    </div>
  );
}