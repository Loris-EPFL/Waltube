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
  const [showSmartContract, setShowSmartContract] = useState(false);
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  const [isMessagePending, setIsMessagePending] = useState(false);
  const [isContractPending, setIsContractPending] = useState(false);
  const [messageToSign, setMessageToSign] = useState('Hello from WALTUBE Sui wallet!');
  const [signedMessage, setSignedMessage] = useState<{message: string, signature: string, address: string} | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('0x46648fb254d9d49c1ee17bd12ac55db6691595a3c38b83234d5907126074382f');
  const [amountInSui, setAmountInSui] = useState('0.1');
  
  // Smart contract interaction states
  const [packageId, setPackageId] = useState('0xa56d7fb3fa3555ec1f1a54dcbc6f26289b9a09f17bfc84e65bef2a001e530c62');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [vaultId, setVaultId] = useState('');
  const [contractAction, setContractAction] = useState<'add_video' | 'edit_video' | 'delete_video' | 'create_user' | 'edit_user'>('add_video');
  
  // User creation/editing states
  const [userName, setUserName] = useState('');
  const [userSurname, setUserSurname] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userCountry, setUserCountry] = useState('');
  
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
      
      // Add a simple transfer transaction
      const amount = Math.floor(parseFloat(amountInSui) * 1000000000); // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
      
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

  const callSmartContract = async () => {
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

      // Validate required fields
      if (!packageId) {
        toast.error('Package ID is required');
        return;
      }

      if (contractAction === 'create_user') {
        if (!userName || !userSurname || !userEmail || !userPhone || !userCountry) {
          toast.error('Please fill in all user details for creating a user');
          return;
        }
      } else if (contractAction === 'edit_user') {
        if (!userName || !userSurname || !userEmail || !userPhone || !userCountry) {
          toast.error('Please fill in all user details for editing user');
          return;
        }
      } else {
        if (contractAction === 'add_video' && (!videoTitle || !videoDescription || !vaultId)) {
          toast.error('Please fill in all video details for adding a video');
          return;
        }

        if (contractAction === 'edit_video' && (!videoTitle || !videoDescription || !vaultId)) {
          toast.error('Please fill in all video details for editing a video');
          return;
        }

        if (contractAction === 'delete_video' && !vaultId) {
          toast.error('Please enter a vault ID for deleting a video');
          return;
        }
      }

      setIsContractPending(true);
      
      // Build the smart contract transaction
      const tx = new Transaction();
      
      // Set the sender
      tx.setSender(wallet.address);
      
      // Add MoveCall based on the selected action
      if (contractAction === 'create_user') {
        tx.moveCall({
          target: `${packageId}::waltube::create_user`,
          arguments: [
            tx.pure.string(userName),
            tx.pure.string(userSurname),
            tx.pure.string(userEmail),
            tx.pure.string(userPhone),
            tx.pure.string(userCountry)
          ],
        });
      } else if (contractAction === 'edit_user') {
        tx.moveCall({
          target: `${packageId}::waltube::edit_user_info`,
          arguments: [
            tx.pure.string(userName),
            tx.pure.string(userSurname),
            tx.pure.string(userEmail),
            tx.pure.string(userPhone),
            tx.pure.string(userCountry)
          ],
        });
      } else if (contractAction === 'add_video') {
        tx.moveCall({
          target: `${packageId}::waltube::add_to_list`,
          arguments: [
            tx.pure.string(videoTitle),
            tx.pure.string(videoDescription),
            tx.pure.string(vaultId)
          ],
        });
      } else if (contractAction === 'edit_video') {
        tx.moveCall({
          target: `${packageId}::waltube::edit_video_by_id`,
          arguments: [
            tx.pure.string(videoTitle),
            tx.pure.string(videoDescription),
            tx.pure.string(vaultId)
          ],
        });
      } else if (contractAction === 'delete_video') {
        tx.moveCall({
          target: `${packageId}::waltube::delete_video_by_id`,
          arguments: [
            tx.pure.string(vaultId)
          ],
        });
      }

      // Build the transaction bytes
      const txBytes = await tx.build({ client: suiClient });
      const intentMessage = messageWithIntent("TransactionData", txBytes);
      const digest = blake2b(intentMessage, { dkLen: 32 });
      
      // Convert the digest to a hex string for signing
      const hashToSign = '0x' + toHex(digest);
      
      console.log('Hash to sign:', hashToSign);
      
      toast.info('Signing smart contract transaction with Privy...');
      
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
      
      // Verify the public key matches the wallet address
      const ED25519_FLAG = 0x00;
      const addressBytes = new Uint8Array(1 + keyBytes.length);
      addressBytes[0] = ED25519_FLAG;
      addressBytes.set(keyBytes, 1);
      
      const addressHash = blake2b(addressBytes, { dkLen: 32 });
      const derivedAddress = '0x' + toHex(addressHash);
      
      if (derivedAddress !== wallet.address) {
        throw new Error(`Public key validation failed: derived address ${derivedAddress} does not match wallet address ${wallet.address}`);
      }
      
      // Convert raw signature to bytes
      const rawSigBytes = new Uint8Array(Buffer.from(rawSignature.replace('0x', ''), 'hex'));
      
      // Create and verify the transaction signature
      const txSignature = toSerializedSignature({
        signature: rawSigBytes,
        signatureScheme: "ED25519",
        publicKey,
      });
      
      const signer = await verifyTransactionSignature(txBytes, txSignature);
      
      if (signer.toSuiAddress() !== wallet.address) {
        throw new Error('Signature verification failed');
      }
      
      toast.info('Submitting smart contract transaction to Sui network...');
      
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
         toast.success(`Smart contract transaction successful! Digest: ${result.digest}`);
         console.log('Smart contract transaction result:', result);
         
         // Reset form
        setVideoTitle('');
        setVideoDescription('');
        setVaultId('');
        setUserName('');
        setUserSurname('');
        setUserEmail('');
        setUserPhone('');
        setUserCountry('');
       } else {
         toast.error(`Smart contract transaction failed: ${result.effects?.status?.error}`);
       }
      
    } catch (error: any) {
      console.error('Smart contract transaction error:', error);
      
      if (error?.message?.includes('Wallet proxy not initialized')) {
        toast.error('Wallet not ready for signing. Please try logging out and back in, or refresh the page.');
      } else if (error?.message?.includes('User rejected')) {
        toast.info('Transaction cancelled by user');
      } else {
        toast.error(`Failed to execute smart contract: ${error?.message}`);
      }
    } finally {
       setIsContractPending(false);
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
          
          <div className="flex justify-center gap-2 flex-wrap">
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
            
            <button
              onClick={() => setShowSmartContract(true)}
              className="btn btn-accent btn-sm"
              disabled={!isWalletReady || isContractPending}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {!isWalletReady ? 'Initializing...' : 
               isContractPending ? 'Pending...' : 'Smart Contract'}
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
                <div className="font-mono text-sm bg-base-200 text-base-content p-2 rounded break-all">{wallet.address}</div>
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
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="input input-bordered font-mono text-sm w-full"
                  placeholder="Enter recipient address"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Amount (SUI):</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={amountInSui}
                    onChange={(e) => setAmountInSui(e.target.value)}
                    className="input input-bordered"
                    placeholder="0.1"
                  />
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
      {showSmartContract && (
        <div className="w-full bg-base-200 rounded-lg shadow-lg p-6">
          <div className="w-full">
            <h2 className="text-lg font-bold mb-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              WALTUBE Smart Contract
            </h2>
            
            <div className="alert alert-info mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <div>
                <div className="text-sm mb-1">Interact with WALTUBE video management contract</div>
                <div className="text-xs opacity-70">Add, edit, or delete videos from your user profile</div>
              </div>
            </div>
            
            <div className="space-y-4 mb-6">
               <div className="form-control">
                 <label className="label">
                   <span className="label-text font-medium">Package ID:</span>
                 </label>
                 <input
                   type="text"
                   value={packageId}
                   onChange={(e) => setPackageId(e.target.value)}
                   className="input input-bordered font-mono text-sm"
                   placeholder="0x..."
                   readOnly
                 />
               </div>
               

              
              <div className="form-control">
                 <label className="label">
                   <span className="label-text font-medium">Action:</span>
                 </label>
                 <select
                   value={contractAction}
                   onChange={(e) => setContractAction(e.target.value as 'add_video' | 'edit_video' | 'delete_video' | 'create_user' | 'edit_user')}
                   className="select select-bordered"
                 >
                   <option value="create_user">Create User</option>
                   <option value="edit_user">Edit User</option>
                   <option value="add_video">Add Video</option>
                   <option value="edit_video">Edit Video</option>
                   <option value="delete_video">Delete Video</option>
                 </select>
               </div>
               
               {(contractAction === 'create_user' || contractAction === 'edit_user') && (
                 <>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="form-control">
                       <label className="label">
                         <span className="label-text font-medium">Name:</span>
                       </label>
                       <input
                         type="text"
                         value={userName}
                         onChange={(e) => setUserName(e.target.value)}
                         className="input input-bordered"
                         placeholder="Enter name"
                       />
                     </div>
                     
                     <div className="form-control">
                       <label className="label">
                         <span className="label-text font-medium">Surname:</span>
                       </label>
                       <input
                         type="text"
                         value={userSurname}
                         onChange={(e) => setUserSurname(e.target.value)}
                         className="input input-bordered"
                         placeholder="Enter surname"
                       />
                     </div>
                   </div>
                   
                   <div className="form-control">
                     <label className="label">
                       <span className="label-text font-medium">Email:</span>
                     </label>
                     <input
                       type="email"
                       value={userEmail}
                       onChange={(e) => setUserEmail(e.target.value)}
                       className="input input-bordered"
                       placeholder="Enter email"
                     />
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="form-control">
                       <label className="label">
                         <span className="label-text font-medium">Phone Number:</span>
                       </label>
                       <input
                         type="tel"
                         value={userPhone}
                         onChange={(e) => setUserPhone(e.target.value)}
                         className="input input-bordered"
                         placeholder="Enter phone number"
                       />
                     </div>
                     
                     <div className="form-control">
                       <label className="label">
                         <span className="label-text font-medium">Country:</span>
                       </label>
                       <input
                         type="text"
                         value={userCountry}
                         onChange={(e) => setUserCountry(e.target.value)}
                         className="input input-bordered"
                         placeholder="Enter country"
                       />
                     </div>
                   </div>
                 </>
               )}
               
               {(contractAction === 'add_video' || contractAction === 'edit_video') && (
                <>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Video Title:</span>
                    </label>
                    <input
                      type="text"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      className="input input-bordered"
                      placeholder="Enter video title"
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Video Description:</span>
                    </label>
                    <textarea
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      className="textarea textarea-bordered h-24"
                      placeholder="Enter video description"
                    />
                  </div>
                </>
              )}
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Vault ID:</span>
                </label>
                <input
                  type="text"
                  value={vaultId}
                  onChange={(e) => setVaultId(e.target.value)}
                  className="input input-bordered"
                  placeholder="Enter vault ID"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSmartContract(false)}
                className="btn btn-ghost"
                disabled={isContractPending}
              >
                Cancel
              </button>
              <button
                onClick={() => callSmartContract()}
                className="btn btn-accent"
                disabled={isContractPending}
              >
                {isContractPending && <span className="loading loading-spinner loading-sm"></span>}
                {isContractPending ? 'Processing...' : `${contractAction.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuiWallet;