import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { 
  messageWithIntent, 
  toSerializedSignature, 
} from "@mysten/sui/cryptography";

import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { verifyPersonalMessageSignature, verifyTransactionSignature } from '@mysten/sui/verify';
import { blake2b } from "@noble/hashes/blake2b";
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { toast } from 'react-toastify';

interface SuiWalletProps {
  wallet: {
    address: string;
    public_key: string; // Added to support direct access to public key
    [key: string]: any; // Allow other properties from Privy wallet
  };
  index: number;
}

const SuiWallet: React.FC<SuiWalletProps> = ({ wallet, index }) => {
  const [showSignMessage, setShowSignMessage] = useState(false);
  const [showSendTransaction, setShowSendTransaction] = useState(false);
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  const [isMessagePending, setIsMessagePending] = useState(false);
  const [messageToSign, setMessageToSign] = useState('Hello from WALTUBE Sui wallet!');
  const [signedMessage, setSignedMessage] = useState<{message: string, signature: string, address: string} | null>(null);
  
  // Recipient address for display
  const recipientAddress = '0x46648fb254d9d49c1ee17bd12ac55db6691595a3c38b83234d5907126074382f';
  const { ready, authenticated, user } = usePrivy();
  const { signRawHash } = useSignRawHash();


  // Initialize Sui client for testnet
  const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

  // Check if wallet is ready for signing
  const isWalletReady = ready && authenticated && user && wallet && wallet.address && signRawHash;

  // Helper function to convert bytes to hex
  const toHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  };

  const customSignMessage = async () => {
    try {
      // Check if user is authenticated and ready
      if (!ready || !authenticated || !user) {
        toast.error('Please ensure you are logged in and authenticated');
        return;
      }

      // Verify wallet is properly initialized
      if (!wallet || !wallet.address) {
        toast.error('Wallet not properly initialized');
        return;
      }

      // Check if signRawHash is available
      if (!signRawHash) {
        toast.error('Signing functionality not available. Please try refreshing the page.');
        return;
      }

      // Check if we have the public key
      if (!wallet.public_key) {
        toast.error('Public key not available. Please create a new Sui wallet to enable message signing.');
        return;
      }

      setIsMessagePending(true);
      
      // Prepare the message for signing
      const messageBytes = new TextEncoder().encode(messageToSign);
      
      // For personal messages, we need to create the intent message for signing
      // but the verification function expects the original message bytes
      const intentMessage = messageWithIntent("PersonalMessage", messageBytes);
      const digest = blake2b(intentMessage, { dkLen: 32 });
      
      // Convert the digest to a hex string for signing
      const hashToSign = '0x' + toHex(digest);
      
      console.log('Hash to sign:', hashToSign);
      
      toast.info('Signing message with Privy...');
      
      // Sign the hash using Privy's signRawHash
      const signResult = await signRawHash({
        address: wallet.address,
        chainType: 'sui',
        hash: hashToSign as `0x${string}`
      });
      
      const rawSignature = signResult.signature;
      console.log('Raw signature from Privy:', rawSignature);
      
      // Parse the public key
      let keyBytes = wallet.public_key.startsWith('0x') 
        ? new Uint8Array(Buffer.from(wallet.public_key.slice(2), 'hex'))
        : new Uint8Array(Buffer.from(wallet.public_key, 'hex'));
      
      // Ed25519 public keys should be exactly 32 bytes
      if (keyBytes.length === 33) {
        keyBytes = keyBytes.slice(1); // Remove the first byte if it's a prefix
      }
      
      const publicKey = new Ed25519PublicKey(keyBytes);
      
      // Verify the public key matches the wallet address by deriving address manually
      // Sui address = BLAKE2b(signature_scheme_flag || public_key_bytes)
      const ED25519_FLAG = 0x00; // Ed25519 signature scheme flag
      const addressBytes = new Uint8Array(1 + keyBytes.length);
      addressBytes[0] = ED25519_FLAG;
      addressBytes.set(keyBytes, 1);
      
      const addressHash = blake2b(addressBytes, { dkLen: 32 });
      const derivedAddress = '0x' + toHex(addressHash);
      
      console.log('Derived address from public key:', derivedAddress);
      console.log('Wallet address:', wallet.address);
      
      if (derivedAddress !== wallet.address) {
        throw new Error(`Public key validation failed: derived address ${derivedAddress} does not match wallet address ${wallet.address}`);
      }
      
      console.log('✅ Public key validation successful!');
      
      // Convert raw signature to bytes (remove 0x prefix if present)
      const rawSigBytes = new Uint8Array(Buffer.from(rawSignature.replace('0x', ''), 'hex'));
      
      // Create the serialized signature for verification
      const messageSignature = toSerializedSignature({
        signature: rawSigBytes,
        signatureScheme: "ED25519",
        publicKey,
      });
      
      // Since we signed the intent-wrapped message hash directly, we need to verify it differently
      // We'll verify the signature against the same hash we signed
      const isValid = publicKey.verify(digest, rawSigBytes);
      console.log('Signature verification result:', isValid);
      
      if (!isValid) {
        throw new Error('Signature verification failed');
      }
      
      console.log('✅ Signature verification successful!');
      
      setSignedMessage({
        message: messageToSign,
        signature: messageSignature,
        address: wallet.address
      });
      
      toast.success('Message signed successfully!');
      
    } catch (error: any) {
      console.error('Error signing message:', error);
      toast.error(`Failed to sign message: ${error.message}`);
    } finally {
      setIsMessagePending(false);
    }
  };

  const customSendTransaction = async () => {
    try {
      // Check if user is authenticated and ready
      if (!ready || !authenticated || !user) {
        toast.error('Please ensure you are logged in and authenticated');
        return;
      }

      // Verify wallet is properly initialized
      if (!wallet || !wallet.address) {
        toast.error('Wallet not properly initialized');
        return;
      }

      // Check if signRawHash is available
      if (!signRawHash) {
        toast.error('Signing functionality not available. Please try refreshing the page.');
        return;
      }

      // Check if we have the public key
      if (!wallet.public_key) {
        toast.error('Public key not available. Please create a new Sui wallet to enable transactions.');
        return;
      }

      setIsTransactionPending(true);
      
      // Build a real Sui transaction
      const tx = new Transaction();
      
      // Set the sender
      tx.setSender(wallet.address);
      
      // Add a simple transfer transaction (sending 0.1 SUI to a test address)
      const amount = 100000000; // 0.1 SUI in MIST (1 SUI = 1,000,000,000 MIST)
      
      // Split coins to create the exact amount needed
      const [coin] = tx.splitCoins(tx.gas, [amount]);
      
      // Transfer the coin to the recipient
      tx.transferObjects([coin], recipientAddress);

      // After you've added the data to your transaction
      const txBytes = await tx.build({ client: suiClient });
      const intentMessage = messageWithIntent("TransactionData", txBytes);
      const digest = blake2b(intentMessage, { dkLen: 32 });
      
      // Convert the digest to a hex string for signing
      const hashToSign = '0x' + toHex(digest);
      
      console.log('Hash to sign:', hashToSign);
      
      toast.info('Signing transaction with Privy...');
      
      // Obtain the raw signature from Privy's raw_sign endpoint
      const signResult = await signRawHash({
        address: wallet.address,
        chainType: 'sui',
        hash: hashToSign as `0x${string}`
      });
      
      const rawSignature = signResult.signature;
      console.log('Raw signature from Privy:', rawSignature);
      
      // Parse the public key
      let keyBytes = wallet.public_key.startsWith('0x') 
        ? new Uint8Array(Buffer.from(wallet.public_key.slice(2), 'hex'))
        : new Uint8Array(Buffer.from(wallet.public_key, 'hex'));
      
      // Ed25519 public keys should be exactly 32 bytes
      if (keyBytes.length === 33) {
        keyBytes = keyBytes.slice(1); // Remove the first byte if it's a prefix
      }
      
      const publicKey = new Ed25519PublicKey(keyBytes);
      
      // Verify the public key matches the wallet address by deriving address manually
      // Sui address = BLAKE2b(signature_scheme_flag || public_key_bytes)
      const ED25519_FLAG = 0x00; // Ed25519 signature scheme flag
      const addressBytes = new Uint8Array(1 + keyBytes.length);
      addressBytes[0] = ED25519_FLAG;
      addressBytes.set(keyBytes, 1);
      
      const addressHash = blake2b(addressBytes, { dkLen: 32 });
      const derivedAddress = '0x' + toHex(addressHash);
      
      console.log('Derived address from public key:', derivedAddress);
      console.log('Wallet address:', wallet.address);
      
      if (derivedAddress !== wallet.address) {
        throw new Error(`Public key validation failed: derived address ${derivedAddress} does not match wallet address ${wallet.address}`);
      }
      
      console.log('✅ Public key validation successful!');
      
      // Convert raw signature to bytes (remove 0x prefix if present)
      const rawSigBytes = new Uint8Array(Buffer.from(rawSignature.replace('0x', ''), 'hex'));
      
      // Create and verify the transaction signature
      const txSignature = toSerializedSignature({
        signature: rawSigBytes,
        signatureScheme: "ED25519",
        publicKey,
      });
      
      const signer = await verifyTransactionSignature(txBytes, txSignature);
      console.log('Signature verification:', signer.toSuiAddress() === wallet.address);
      
      if (signer.toSuiAddress() !== wallet.address) {
        throw new Error('Signature verification failed');
      }
      
      toast.info('Submitting transaction to Sui network...');
      
      // Execute the transaction on the Sui network
      const result = await suiClient.executeTransactionBlock({
        transactionBlock: txBytes,
        signature: txSignature,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });
      
      if (result.effects?.status?.status === 'success') {
         toast.success(`Transaction successful! Digest: ${result.digest}`);
         console.log('Transaction result:', result);
       } else {
         toast.error(`Transaction failed: ${result.effects?.status?.error}`);
       }
      
    } catch (error: any) {
      console.error('Transaction error:', error);
      
      // Handle specific Privy wallet proxy errors
      if (error?.message?.includes('Wallet proxy not initialized')) {
        toast.error('Wallet not ready for signing. Please try logging out and back in, or refresh the page.');
      } else if (error?.message?.includes('User rejected')) {
        toast.info('Transaction cancelled by user');
      } else {
        toast.error(`Failed to send transaction: ${error?.message}`);
      }
    } finally {
       setIsTransactionPending(false);
     }
   };

  return (
    <div className="w-full space-y-4">
      <div className="w-full bg-base-200 rounded-lg shadow-md p-6">
        <div className="w-full">
          <h3 className="text-lg font-bold mb-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Sui Wallet {index + 1}
          </h3>
          
          <div className="mb-4">
            <div className="text-sm text-base-content/60 mb-2">Address:</div>
            <div className="font-mono text-base bg-base-100 p-4 rounded-lg break-all w-full">
              {wallet.address}
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="badge badge-outline">Sui Testnet</div>
            <div className={`badge ${
              isWalletReady ? 'badge-success' : 'badge-warning'
            }`}>
              {isWalletReady ? '✓ Ready' : '⚠ Initializing'}
            </div>
          </div>
          
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setShowSignMessage(true)}
              className="btn btn-primary btn-sm"
              disabled={!isWalletReady}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              {!isWalletReady ? 'Initializing...' : 'Sign Message'}
            </button>
            
            <button
              onClick={() => setShowSendTransaction(true)}
              className="btn btn-secondary btn-sm"
              disabled={!isWalletReady || isTransactionPending}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {!isWalletReady ? 'Initializing...' : 
               isTransactionPending ? 'Pending...' : 'Send Transaction'}
            </button>
          </div>
        </div>
      </div>
      {showSignMessage && (
        <div className="w-full bg-base-200 rounded-lg shadow-lg p-6">
          <div className="w-full">
            <h2 className="text-lg font-bold mb-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Sign Message
            </h2>
            
            <div className="alert alert-info mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <div>
                <div className="text-sm mb-1">Wallet:</div>
                <div className="font-mono text-sm bg-base-200 p-2 rounded break-all">{wallet.address}</div>
                <div className="text-xs opacity-70 mt-2">Using Privy's Sui Tier 2 integration</div>
              </div>
            </div>
            
            <div className="form-control mb-4 w-full">
              <label className="label">
                <span className="label-text font-medium">Message to sign:</span>
              </label>
              <textarea
                value={messageToSign}
                onChange={(e) => setMessageToSign(e.target.value)}
                className="textarea textarea-bordered h-24 w-full"
                placeholder="Enter your message here..."
              />
            </div>
            
            {signedMessage && (
              <div className="alert alert-success mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <div>
                  <h4 className="font-bold">Message Signed Successfully!</h4>
                  <div className="text-sm mt-3 space-y-3">
                    <div>
                      <div className="font-semibold mb-1">Message:</div>
                      <div className="bg-base-200 p-2 rounded">{signedMessage.message}</div>
                    </div>
                    <div>
                      <div className="font-semibold mb-1">Signature:</div>
                      <div className="font-mono text-xs bg-base-200 p-2 rounded break-all">{signedMessage.signature}</div>
                    </div>
                    <div>
                      <div className="font-semibold mb-1">Address:</div>
                      <div className="font-mono text-sm bg-base-200 p-2 rounded break-all">{signedMessage.address}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSignMessage(false)}
                className="btn btn-ghost"
                disabled={isMessagePending}
              >
                Cancel
              </button>
              <button
                onClick={() => customSignMessage()}
                className="btn btn-primary"
                disabled={isMessagePending || !messageToSign.trim()}
              >
                {isMessagePending && <span className="loading loading-spinner loading-sm"></span>}
                {isMessagePending ? 'Signing...' : 'Sign Message'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showSendTransaction && (
        <div className="w-full bg-base-200 rounded-lg shadow-lg p-6">
          <div className="w-full">
            <h2 className="text-lg font-bold mb-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send Sui Transaction
            </h2>
            
            <div className="alert alert-warning mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 w-6 h-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>
              <div>
                <div className="font-bold">Real Transaction Warning</div>
                <div className="text-sm">This will send a real transaction on Sui Testnet using Privy's Tier 2 integration</div>
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-medium">From:</span>
                </label>
                <div className="input input-bordered font-mono text-sm break-all bg-base-200 p-3 w-full">
                  {wallet.address}
                </div>
              </div>
              
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-medium">To:</span>
                </label>
                <div className="input input-bordered font-mono text-sm break-all bg-base-200 p-3 w-full">
                  {recipientAddress}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Amount:</span>
                  </label>
                  <div className="input input-bordered bg-base-200">
                    0.1 SUI
                  </div>
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Network:</span>
                  </label>
                  <div className="badge badge-outline badge-lg w-full">
                    Sui Testnet
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSendTransaction(false)}
                className="btn btn-ghost"
                disabled={isTransactionPending}
              >
                Cancel
              </button>
              <button
                onClick={() => customSendTransaction()}
                className="btn btn-primary"
                disabled={isTransactionPending}
              >
                {isTransactionPending && <span className="loading loading-spinner loading-sm"></span>}
                {isTransactionPending ? 'Sending...' : 'Send Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuiWallet;