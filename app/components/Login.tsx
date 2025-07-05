'use client';
import {useEffect, useState} from 'react';
import {useLoginWithEmail, useLoginWithSms, useGuestAccounts, usePrivy} from '@privy-io/react-auth';
import OAuth from './OAuth';

const Login = () => {
  const {createGuestAccount} = useGuestAccounts();
  const {ready, authenticated, logout} = usePrivy();

  /**
   * Logic for using whitelabel email auth
   *
   */
  const {
    sendCode: sendCodeEmail,
    loginWithCode: loginWithCodeEmail,
    state: stateEmail,
  } = useLoginWithEmail({
    onComplete: ({ user, isNewUser, wasAlreadyAuthenticated, loginMethod }) => {
      console.log('🔑 ✅ User successfully logged in with email', {
        user,
        isNewUser,
        wasAlreadyAuthenticated,
        loginMethod,
      });
    },
    onError: (error) => {
      console.log(error);
    },
  });

  // Email Local State
  const [email, setEmail] = useState('');
  const [codeEmail, setCodeEmail] = useState('');
  const [emailState, setEmailState] = useState(stateEmail.status as string);

  // Update email status
  useEffect(() => {
    if (stateEmail.status === 'error' && stateEmail.error) {
      const message = `Error ${stateEmail.error.message}`;
      setEmailState(message);
    } else {
      setEmailState(stateEmail.status);
    }
  }, [stateEmail]);

  /**
   * Logic for using whitelabel sms Auth
   */
  const {
    sendCode: sendCodeSms,
    loginWithCode: loginWithCodeSms,
    state: stateSms,
  } = useLoginWithSms({
    onComplete: ({ user, isNewUser, wasAlreadyAuthenticated, loginMethod }) => {
      console.log('🔑 ✅ User successfully logged in with Sms', {
        user,
        isNewUser,
        wasAlreadyAuthenticated,
        loginMethod,
      });
    },
    onError: (error) => {
      console.log(error);
    },
  });

  // Sms Local State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [codeSms, setCodeSms] = useState('');
  const [smsState, setSmsState] = useState(stateSms.status as string);

  useEffect(() => {
    if (stateSms.status === 'error' && stateSms.error) {
      const message = `Error ${stateSms.error.message}`;
      setSmsState(message);
    } else {
      setSmsState(stateSms.status);
    }
  }, [stateSms]);

  return (
    <div className="bg-base-100">
      {/* Hero Section */}
      <div className="hero bg-base-200 py-12">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-4xl font-bold mb-4 text-base-content">🔐 Authentication</h1>
            <p className="text-base mb-6 text-base-content/70">
              Experience seamless Web3 authentication with Privy. Choose from multiple login methods or start as a guest.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  console.log('click');
                  createGuestAccount();
                }}
                className="btn btn-primary btn-lg shadow-md hover:shadow-lg transition-all duration-300"
              >
                🎯 Start as Guest
              </button>
              {ready && authenticated && (
                <button onClick={logout} className="btn btn-outline btn-lg">
                  👋 Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Authentication Cards Section */}
      <div className="px-4 py-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Choose Your Login Method</h2>
          <p className="text-base-content/70 max-w-2xl mx-auto">
            Secure, fast, and user-friendly authentication powered by Privy's advanced infrastructure.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          {/* Email Authentication Card */}
          <div className="w-full bg-white rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 p-6">
            <div className="w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="avatar placeholder">
                  <div className="bg-primary text-primary-content rounded-full w-12">
                    <span className="text-xl">📧</span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold">Email Login</h2>
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Email Address</span>
                </label>
                <input
                  type="email"
                  className="input input-bordered w-full"
                  placeholder="Enter your email"
                  onChange={(e) => setEmail(e.currentTarget.value)}
                />
              </div>
              
              <button
                onClick={() => sendCodeEmail({email})}
                className="btn btn-primary mt-4"
                disabled={emailState === 'sending-code'}
              >
                {emailState === 'sending-code' ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  '📤 Send Verification Code'
                )}
              </button>
              
              {emailState !== 'initial' && emailState !== 'sending-code' && (
                <div className="form-control mt-4">
                  <label className="label">
                    <span className="label-text font-medium">Verification Code</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="Enter 6-digit code"
                    onChange={(e) => setCodeEmail(e.currentTarget.value)}
                  />
                  <button
                    onClick={() => loginWithCodeEmail({code: codeEmail})}
                    className="btn btn-success mt-4"
                    disabled={emailState === 'initial'}
                  >
                    🔐 Login with Email
                  </button>
                </div>
              )}
              
              <div className="alert alert-info mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span className="text-sm">Status: {emailState}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section 
        <div className="mt-12">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold mb-4">Why Choose Our Authentication?</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body text-center py-4">
                <div className="text-2xl mb-2">🔒</div>
                <h4 className="card-title justify-center text-sm">Secure</h4>
                <p className="text-xs text-base-content/60">Enterprise-grade security</p>
              </div>
            </div>
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body text-center py-4">
                <div className="text-2xl mb-2">⚡</div>
                <h4 className="card-title justify-center text-sm">Fast</h4>
                <p className="text-xs text-base-content/60">Lightning-fast authentication</p>
              </div>
            </div>
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body text-center py-4">
                <div className="text-2xl mb-2">🌐</div>
                <h4 className="card-title justify-center text-sm">Universal</h4>
                <p className="text-xs text-base-content/60">Works on all platforms</p>
              </div>
            </div>
          </div>
        </div>
*/}
      </div>
    </div>
  );
};

export default Login;
