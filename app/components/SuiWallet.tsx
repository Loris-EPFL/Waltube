import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { 
  messageWithIntent, 
  toSerializedSignature, 
} from "@mysten/sui/cryptography";
import { blake2b } from "@noble/hashes/blake2b";
import { verifyTransactionSignature } from "@mysten/sui/verify";
import { toast } from 'react-toastify';

interface SuiWalletProps {
  wallet: any; // Sui wallet type from Privy
  index: number;
}

const SuiWallet: React.FC<SuiWalletProps> = ({ wallet, index }) => {
  const [showSignMessage, setShowSignMessage] = useState(false);
  const [showSendTransaction, setShowSendTransaction] = useState(false);
  const { signRawHash } = useSignRawHash();

  // Helper function to convert bytes to hex
  const toHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  };

  const customSignMessage = async () => {
    try {
      // Create a simple message to sign
      const message = 'Hello from WALTUBE Sui wallet!';
      const messageBytes = new TextEncoder().encode(message);
      const messageHash = blake2b(messageBytes, { dkLen: 32 });
      const hashToSign = '0x' + toHex(messageHash);

      // Sign the hash using Privy's raw sign functionality
      const { signature } = await signRawHash({
        address: wallet.address,
        chainType: 'sui',
        hash: hashToSign as `0x${string}`
      });

      toast.success(`Message signed successfully! Signature: ${signature.slice(0, 20)}...`);
    } catch (error: any) {
      toast.error(`Failed to sign message: ${error?.message}`);
    }
  };

  const customSendTransaction = async () => {
    try {
      // This is a simplified example - in a real app, you'd build a proper Sui transaction
      // For demonstration, we'll create a mock transaction hash
      const mockTxData = {
        sender: wallet.address,
        recipient: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000', // 1 SUI in MIST
        gasPrice: '1000',
        gasBudget: '10000000'
      };

      // In a real implementation, you would:
      // 1. Build the transaction using Sui SDK
      // 2. Get transaction bytes
      // 3. Create intent message and hash it
      // 4. Sign the hash
      // 5. Submit to Sui network

      // Mock transaction bytes for demonstration
      const mockTxBytes = new TextEncoder().encode(JSON.stringify(mockTxData));
      const intentMessage = messageWithIntent("TransactionData", mockTxBytes);
      const digest = blake2b(intentMessage, { dkLen: 32 });
      const hashToSign = '0x' + toHex(digest);

      // Sign the transaction hash
      const { signature: rawSignature } = await signRawHash({
        address: wallet.address,
        chainType: 'sui',
        hash: hashToSign as `0x${string}`
      });

      // In a real implementation, you would create the serialized signature
      // and submit to the Sui network
      // const txSignature = toSerializedSignature({
      //   signature: rawSignature,
      //   signatureScheme: "ED25519",
      //   publicKey: wallet.publicKey,
      // });

      toast.success(`Transaction signed successfully! Hash: ${hashToSign.slice(0, 20)}...`);
      toast.info('Note: This is a demo transaction - not submitted to Sui network');
    } catch (error: any) {
      toast.error(`Failed to send transaction: ${error?.message}`);
    }
  };

  return (
    <div className="wallet-container">
      <h3 className="wallet-header">Sui wallet {index + 1}</h3>
      <p className="wallet-address">
        <span className="break-all">{wallet.address}</span>
      </p>
      <p className="text-xs text-gray-600 mb-2">Chain: Sui (Tier 2 Support)</p>
      <div className="flex justify-between">
        <div className="flex flex-col">
          <button
            onClick={() => setShowSignMessage(true)}
            className="wallet-button wallet-button-primary mb-3"
          >
            <div className="btn-text">Sign message</div>
          </button>
          <button
            onClick={() => setShowSendTransaction(true)}
            className="wallet-button wallet-button-secondary"
          >
            <div className="btn-text">Send transaction</div>
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
          <h2 className="text-lg font-semibold mb-2">Custom Sui transaction</h2>
          <p className="text-xs text-gray-600 mb-2">
            From: <br />
            <span className="break-all">{wallet.address}</span>
          </p>
          <p className="text-xs text-gray-600 mb-2">
            To: <br />
            <span className="break-all">0x1234567890abcdef1234567890abcdef12345678</span>
          </p>
          <p className="text-xs text-gray-600 mb-2">Amount: 1 SUI</p>
          <p className="text-xs text-gray-500 mb-2">
            Demo transaction using Privy's raw signing for Sui
          </p>
          <div className="flex flex-col space-y-3">
            <button
              onClick={() => customSendTransaction()}
              className="wallet-button wallet-button-primary"
            >
              <div className="btn-text">Sign Transaction</div>
            </button>
            <button
              onClick={() => setShowSendTransaction(false)}
              className="wallet-button wallet-button-secondary"
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