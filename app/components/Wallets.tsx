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
    <div className="mx-4 px-4">
      <ToastContainer />
      <h1 className="text-2xl font-bold text-center my-4">WALTUBE Sui Wallet</h1>
      <div className="text-center mt-4 mx-auto mb-4">
        <p className="status-text">
          Create your Sui wallet for WALTUBE to interact with the decentralized video platform.
          Your wallet will be used for transactions and content management on the Sui blockchain.
        </p>
        <div className="mb-2 mt-2 flex justify-center">
          <a
            href="https://docs.privy.io/recipes/use-tier-2"
            target="_blank"
            rel="noopener noreferrer"
            className="link status-text"
          >
            Sui Tier 2 Integration Guide
          </a>
        </div>
        {walletCreationError && (
          <div className="text-red-500 text-sm mt-2">
            Error: {walletCreationError}
          </div>
        )}
      </div>
      <div className="flex justify-center">
        <button
          onClick={() => createWallet('Sui')}
          className={`btn ${hasExistingSuiWallet ? 'btn-disabled' : ''}`}
          disabled={hasExistingSuiWallet}
        >
          <div
            className={`${hasExistingSuiWallet ? 'btn-text-disabled' : 'text-black'} btn-text`}
          >
            {hasExistingSuiWallet ? 'Sui Wallet Created' : 'Create Sui Wallet'}
          </div>
        </button>
      </div>
      <div className="mt-4">
        {suiWallets.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2 text-center">Your Sui Wallet</h2>
            <div className="flex justify-center">
              {suiWallets.map((wallet, index) => (
                <div key={wallet.address} className="max-w-md">
                  <SuiWallet wallet={wallet} index={index} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
