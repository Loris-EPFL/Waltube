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
      
      // Verify the signature using the public key's verifyPersonalMessage method
      // This method handles the intent wrapping internally and is the correct way to verify
      const isValid = await publicKey.verifyPersonalMessage(messageBytes, messageSignature);
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
    <div className="wallet-container">
      <h3 className="wallet-header">Sui wallet {index + 1}</h3>
      <p className="wallet-address">
        <span className="break-all">{wallet.address}</span>
      </p>
      <p className="text-xs text-gray-600 mb-1">Chain: Sui (Tier 2 Support)</p>
      <p className={`text-xs mb-2 ${
        isWalletReady ? 'text-green-600' : 'text-orange-600'
      }`}>
        Status: {isWalletReady ? '✓ Ready for signing' : '⚠ Initializing...'}
      </p>
      <div className="flex justify-between">
        <div className="flex flex-col">
          <button
            onClick={() => setShowSignMessage(true)}
            className="wallet-button wallet-button-primary mb-3"
            disabled={!isWalletReady}
          >
            <div className="btn-text">
              {!isWalletReady ? 'Wallet Initializing...' : 'Sign message'}
            </div>
          </button>
          <button
            onClick={() => setShowSendTransaction(true)}
            className="wallet-button wallet-button-secondary"
            disabled={!isWalletReady || isTransactionPending}
          >
            <div className="btn-text">
              {!isWalletReady ? 'Wallet Initializing...' : 
               isTransactionPending ? 'Transaction Pending...' : 'Send Real Transaction'}
            </div>
          </button>
        </div>
      </div>
      {showSignMessage && (
        <div className="mt-4 p-2 border rounded shadow bg-white text-left">
          <h2 className="text-lg font-semibold mb-2">Sign message confirmation</h2>
          <p className="text-xs text-gray-600 mb-2">
            Signing message with Privy Sui wallet: <span className="break-all">{wallet.address}</span>
          </p>
          <p className="text-xs text-gray-500 mb-2">
            Using Privy's raw sign functionality for Sui Tier 2 support
          </p>
          
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message to sign:
            </label>
            <textarea
              value={messageToSign}
              onChange={(e) => setMessageToSign(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm"
              rows={3}
              placeholder="Enter your message here..."
            />
          </div>
          
          {signedMessage && (
            <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded">
              <h4 className="text-sm font-medium text-green-800 mb-1">✅ Message Signed Successfully!</h4>
              <p className="text-xs text-gray-600 mb-1">
                <strong>Message:</strong> {signedMessage.message}
              </p>
              <p className="text-xs text-gray-600 mb-1">
                <strong>Signature:</strong> <span className="break-all">{signedMessage.signature}</span>
              </p>
              <p className="text-xs text-gray-600">
                <strong>Address:</strong> <span className="break-all">{signedMessage.address}</span>
              </p>
            </div>
          )}
          
          <div className="flex flex-col space-y-3">
            <button
              onClick={() => customSignMessage()}
              className="wallet-button wallet-button-primary"
              disabled={isMessagePending || !messageToSign.trim()}
            >
              <div className="btn-text">
                {isMessagePending ? 'Signing...' : 'Sign message'}
              </div>
            </button>
            <button
              onClick={() => setShowSignMessage(false)}
              className="wallet-button wallet-button-secondary"
              disabled={isMessagePending}
            >
              <div className="btn-text">Cancel</div>
            </button>
          </div>
        </div>
      )}
      {showSendTransaction && (
        <div className="mt-4 p-2 border rounded shadow bg-white text-left">
          <h2 className="text-lg font-semibold mb-2">Send Sui Transaction</h2>
          <p className="text-xs text-gray-600 mb-2">
            From: <br />
            <span className="break-all">{wallet.address}</span>
          </p>
          <p className="text-xs text-gray-600 mb-2">
            To: <br />
            <span className="break-all">{recipientAddress}</span>
          </p>
          <p className="text-xs text-gray-600 mb-2">Amount: 0.1 SUI</p>
          <p className="text-xs text-gray-600 mb-2">Network: Sui Testnet</p>
          <p className="text-xs text-gray-500 mb-2">
            This will send a real transaction on the Sui testnet using Privy's Tier 2 integration
          </p>
          <div className="flex flex-col space-y-3">
            <button
              onClick={() => customSendTransaction()}
              className="wallet-button wallet-button-primary"
              disabled={isTransactionPending}
            >
              <div className="btn-text">
                {isTransactionPending ? 'Sending...' : 'Send Transaction'}
              </div>
            </button>
            <button
              onClick={() => setShowSendTransaction(false)}
              className="wallet-button wallet-button-secondary"
              disabled={isTransactionPending}
            >
              <div className="btn-text">Cancel</div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuiWallet;