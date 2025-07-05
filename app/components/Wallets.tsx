'use client';
import React, {useEffect, useState} from 'react';
import {
  usePrivy,
  WalletWithMetadata,
  useGuestAccounts,
} from '@privy-io/react-auth';
import { useCreateWallet } from '@privy-io/react-auth/extended-chains';
import {useRouter} from 'next/navigation';
import {ToastContainer, toast} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SuiWallet from '../components/SuiWallet';

export default function Wallets() {
  const router = useRouter();

  const {ready, authenticated, user} = usePrivy();
  const {createWallet: createSuiWallet} = useCreateWallet();
  const {createGuestAccount} = useGuestAccounts();
  const [pendingAction, setPendingAction] = useState('');
  const [walletCreationError, setWalletCreationError] = useState('');
  const [newlyCreatedWallets, setNewlyCreatedWallets] = useState<any[]>([]);

  const hasExistingSuiWallet = user?.linkedAccounts.some(
    (account): account is WalletWithMetadata =>
      account.type === 'wallet' &&
      account.walletClientType === 'privy' &&
      account.chainType === 'sui',
  );

  const existingSuiWallets = user?.linkedAccounts.filter(
    (account): account is WalletWithMetadata =>
      account.type === 'wallet' &&
      account.walletClientType === 'privy' &&
      account.chainType === 'sui',
  ) || [];
  
  // Merge existing wallets with newly created ones (which have public_key)
  const suiWallets = [
    ...existingSuiWallets.map(wallet => ({
      ...wallet,
      // Check if we have a newly created wallet with the same address
      public_key: newlyCreatedWallets.find(newWallet => newWallet.address === wallet.address)?.public_key
    })),
    // Add any newly created wallets that aren't in linkedAccounts yet
    ...newlyCreatedWallets.filter(newWallet => 
      !existingSuiWallets.some(existing => existing.address === newWallet.address)
    )
  ];

  /**
   *
   * If the user clicks create wallet before they have created an account
   * creat a guest account for them so they can create a wallet
   *
   * We create a useEffect to handle the pending action once a the
   * guest account is created, so that createEthereumWallet / createSolanaWallet
   * are updated with the user
   */

  useEffect(() => {
    if (pendingAction === 'Sui') {
      const createSuiWalletWithErrorHandling = async () => {
        try {
          setWalletCreationError('');
          const {user, wallet} = await createSuiWallet({chainType: 'sui'});

          console.log('address', wallet.address);
          console.log('wallet', wallet);
          console.log('user', user);
          
          console.log('pubkey', wallet.public_key);
          
          // Store the newly created wallet with its public key
          if (wallet.public_key) {
            setNewlyCreatedWallets(prev => {
              // Remove any existing wallet with the same address and add the new one
              const filtered = prev.filter(w => w.address !== wallet.address);
              return [...filtered, wallet];
            });
            console.log('✅ Stored wallet with public key for future use');
          }
          
          toast.success('Sui wallet created successfully!');
        } catch (error: any) {
          // Suppress the HD wallet error as it's expected for Sui
          if (error?.message?.includes('Only ethereum and solana chain types are supported for HD wallet generation')) {
            // This error is expected for Sui - wallet creation still works
            console.log('Expected HD wallet error for Sui - wallet creation proceeding');
          } else {
            setWalletCreationError(error?.message || 'Failed to create Sui wallet');
            toast.error(`Failed to create Sui wallet: ${error?.message}`);
          }
        }
      };
      createSuiWalletWithErrorHandling();
    }
    setPendingAction('');
  }, [user, createSuiWallet, pendingAction, setPendingAction]);

  const createWallet = async (walletType: string) => {
    if (ready && !authenticated && !user?.isGuest) {
      await createGuestAccount();
    }
    setPendingAction(walletType);
  };

  if (!ready) {
    return;
  }

  return (
    <div className="bg-base-100 shadow-lg p-6 w-full max-w-none">
      <ToastContainer />
      <div className="w-full max-w-none">
        <h1 className="flex text-2xl justify-center mb-4">WALTUBE Sui Wallet</h1>
        
        <div className="text-center mb-6">
          <p className="text-base-content/70 mb-4">
            Create your Sui wallet for WALTUBE to interact with the decentralized video platform.
            Your wallet will be used for transactions and content management on the Sui blockchain.
          </p>
          
          
          
          {walletCreationError && (
            <div className="alert alert-error shadow-lg mb-4">
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>Error: {walletCreationError}</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="card-actions justify-center mb-6">
          <button
            onClick={() => createWallet('Sui')}
            className={`btn ${hasExistingSuiWallet ? 'btn-success' : 'btn-primary'}`}
            disabled={hasExistingSuiWallet}
          >
            {hasExistingSuiWallet ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Sui Wallet Created
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Sui Wallet
              </>
            )}
          </button>
        </div>
        
        {suiWallets.length > 0 && (
          <div className="divider">Your Wallet</div>
        )}
        
        <div className="w-full max-w-none">
          {suiWallets.map((wallet, index) => (
            <div key={wallet.address} className="w-full max-w-none mb-4">
              <SuiWallet wallet={wallet} index={index} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
