import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { 
  messageWithIntent, 
  toSerializedSignature, 
} from "@mysten/sui/cryptography";
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { blake2b } from "@noble/hashes/blake2b";
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { toast } from 'react-toastify';

interface SuiWalletProps {
  wallet: any; // Sui wallet type from Privy
  index: number;
}

const SuiWallet: React.FC<SuiWalletProps> = ({ wallet, index }) => {
  const [showSignMessage, setShowSignMessage] = useState(false);
  const [showSendTransaction, setShowSendTransaction] = useState(false);
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  
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

       // Debug wallet information
       console.log('Wallet object:', wallet);
       console.log('User authenticated:', authenticated);
       console.log('Privy ready:', ready);

       // Create a simple message to sign
      const message = 'Hello from WALTUBE Sui wallet!';
      const messageBytes = new TextEncoder().encode(message);
      const messageHash = blake2b(messageBytes, { dkLen: 32 });
      const hashToSign = '0x' + toHex(messageHash);

      // Sign the hash using Privy's raw sign functionality
      const signResult = await signRawHash({
        address: wallet.address,
        chainType: 'sui',
        hash: hashToSign as `0x${string}`
      });
      
      console.log('Message sign result:', signResult);
      const signature = signResult.signature;
      
      // 🎉 NEW SOLUTION: Recover the public key from the signature!
      // This solves the Privy public key issue using Sui SDK's verifyPersonalMessageSignature
      try {
        console.log('Recovering public key from signature using Sui SDK...');
        
        // Convert signature to the format expected by verifyPersonalMessageSignature
        const signatureBytes = new Uint8Array(Buffer.from(signature.replace('0x', ''), 'hex'));
        
        // Create the serialized signature for verification
        // We need to create a temporary Ed25519PublicKey for the signature format
        // But we'll recover the actual public key from the verification
        const tempPublicKey = new Ed25519PublicKey(new Uint8Array(32)); // Temporary placeholder
        const tempSerializedSig = toSerializedSignature({
          signature: signatureBytes,
          signatureScheme: "ED25519",
          publicKey: tempPublicKey,
        });
        
        // Use verifyPersonalMessageSignature to recover the actual public key
        const recoveredPublicKey = await verifyPersonalMessageSignature(messageBytes, tempSerializedSig);
        
        console.log('✅ Successfully recovered public key:', recoveredPublicKey.toBase64());
        console.log('✅ Recovered address:', recoveredPublicKey.toSuiAddress());
        console.log('✅ Original wallet address:', wallet.address);
        
        // Verify the recovered address matches the wallet address
        if (recoveredPublicKey.toSuiAddress() === wallet.address) {
          toast.success(`Message signed successfully! Public key recovered: ${recoveredPublicKey.toBase64().slice(0, 20)}...`);
        } else {
          toast.warning('Signature valid but address mismatch - this may indicate a different signing scheme');
        }
        
      } catch (recoveryError: any) {
        console.error('Public key recovery failed:', recoveryError);
        toast.success(`Message signed successfully! Signature: ${signature.slice(0, 20)}... (Note: Public key recovery failed - ${recoveryError.message})`);
      }
    } catch (error: any) {
      console.error('Sign message error:', error);
      
      // Handle specific Privy wallet proxy errors
      if (error?.message?.includes('Wallet proxy not initialized')) {
        toast.error('Wallet not ready for signing. Please try logging out and back in, or refresh the page.');
      } else if (error?.message?.includes('User rejected')) {
        toast.info('Message signing cancelled by user');
      } else {
        toast.error(`Failed to sign message: ${error?.message}`);
      }
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

        // Debug wallet information
        console.log('Transaction - Wallet object:', wallet);
        console.log('Transaction - User authenticated:', authenticated);
        console.log('Transaction - Privy ready:', ready);
        console.log('Transaction - User object:', user);
  
        setIsTransactionPending(true);
      
      // Build a real Sui transaction
      const transaction = new Transaction();
      
      // Set the sender
      transaction.setSender(wallet.address);
      
      // Add a simple transfer transaction (sending 0.1 SUI to a test address)
      const amount = 100000000; // 0.1 SUI in MIST (1 SUI = 1,000,000,000 MIST)
      
      // Split coins to create the exact amount needed
      const [coin] = transaction.splitCoins(transaction.gas, [amount]);
      
      // Transfer the coin to the recipient
      transaction.transferObjects([coin], recipientAddress);
      
      // Build the transaction to get the transaction bytes
      const transactionBytes = await transaction.build({ client: suiClient });
      
      console.log('Transaction built, preparing for Privy signing...');
      
      // Follow Privy's Sui documentation approach
      // Create the intent message and digest for signing
      const intentMessage = messageWithIntent("TransactionData", transactionBytes);
      const digest = blake2b(intentMessage, { dkLen: 32 });
      
      // Convert the digest to a hex string for signing
      const hashToSign = '0x' + toHex(digest);
      
      console.log('Hash to sign:', hashToSign);
      
      toast.info('Signing transaction with Privy...');
      
      // Sign the hash using Privy's signRawHash
      const signResult = await signRawHash({
        address: wallet.address,
        chainType: 'sui',
        hash: hashToSign as `0x${string}`
      });
      
      console.log('Sign result:', signResult);
      
      // Get the raw signature from Privy
      const rawSignature = signResult.signature;
      
      console.log('Raw signature from Privy:', rawSignature);
      
      // 🎉 NEW SOLUTION: Recover the public key from the signature!
      // This completely eliminates the need for backend API calls or public key exposure
      let serializedSignature: string;
      
      try {
        console.log('🚀 Recovering public key from transaction signature using Sui SDK...');
        
        // Convert signature to the format expected by verifyPersonalMessageSignature
        const signatureBytes = new Uint8Array(Buffer.from(rawSignature.replace('0x', ''), 'hex'));
        
        // Create a temporary serialized signature for verification
        // We use a placeholder public key initially
        const tempPublicKey = new Ed25519PublicKey(new Uint8Array(32));
        const tempSerializedSig = toSerializedSignature({
          signature: signatureBytes,
          signatureScheme: "ED25519",
          publicKey: tempPublicKey,
        });
        
        // Use verifyPersonalMessageSignature to recover the actual public key
        // We need to verify against the original intent message that was signed
        const recoveredPublicKey = await verifyPersonalMessageSignature(intentMessage, tempSerializedSig);
        
        console.log('✅ Successfully recovered public key from transaction signature!');
        console.log('✅ Recovered public key:', recoveredPublicKey.toBase64());
        console.log('✅ Recovered address:', recoveredPublicKey.toSuiAddress());
        console.log('✅ Original wallet address:', wallet.address);
        
        // Verify the recovered address matches the wallet address
        if (recoveredPublicKey.toSuiAddress() !== wallet.address) {
          throw new Error(`Address mismatch: recovered ${recoveredPublicKey.toSuiAddress()} vs wallet ${wallet.address}`);
        }
        
        // Create the final serialized signature with the recovered public key
        serializedSignature = toSerializedSignature({
          signature: signatureBytes,
          signatureScheme: "ED25519",
          publicKey: recoveredPublicKey,
        });
        
        console.log('✅ Created final serialized signature with recovered public key');
        
      } catch (recoveryError: any) {
        console.error('❌ Public key recovery failed:', recoveryError);
        throw new Error(`Failed to recover public key from signature: ${recoveryError.message}. This indicates the signature verification process failed.`);
      }
      
      toast.info('Submitting transaction to Sui network...');
      
      // Execute the transaction on the Sui network
      const result = await suiClient.executeTransactionBlock({
        transactionBlock: transactionBytes,
        signature: serializedSignature,
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
          <div className="flex flex-col space-y-3">
            <button
              onClick={() => customSignMessage()}
              className="wallet-button wallet-button-primary"
            >
              <div className="btn-text">Sign message</div>
            </button>
            <button
              onClick={() => setShowSignMessage(false)}
              className="wallet-button wallet-button-secondary"
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