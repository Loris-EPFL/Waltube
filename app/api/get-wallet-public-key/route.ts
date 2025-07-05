import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userDid, walletAddress } = await request.json();
    
    if (!userDid) {
      return NextResponse.json({ error: 'User DID is required' }, { status: 400 });
    }
    
    // Get Privy credentials from environment variables
    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const privyAppSecret = process.env.PRIVY_APP_SECRET;
    
    if (!privyAppId || !privyAppSecret) {
      return NextResponse.json({ 
        error: 'Privy credentials not configured. Please set NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET environment variables.' 
      }, { status: 500 });
    }
    
    // Create Basic Auth header
    const credentials = Buffer.from(`${privyAppId}:${privyAppSecret}`).toString('base64');
    
    // Call Privy API to get user data
    const response = await fetch(`https://auth.privy.io/api/v1/users/${userDid}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'privy-app-id': privyAppId,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Privy API error:', errorText);
      return NextResponse.json({ 
        error: `Failed to fetch user data from Privy: ${response.status} ${response.statusText}`,
        details: errorText
      }, { status: response.status });
    }
    
    const userData = await response.json();
    
    // Find the wallet in linked_accounts
    const linkedAccounts = userData.linked_accounts || [];
    const wallets = linkedAccounts.filter((account: any) => account.type === 'wallet');
    
    // Find the specific wallet by address
    let targetWallet = null;
    if (walletAddress) {
      targetWallet = wallets.find((wallet: any) => 
        wallet.address?.toLowerCase() === walletAddress.toLowerCase()
      );
    } else {
      // If no specific address provided, use the first wallet
      targetWallet = wallets[0];
    }
    
    if (!targetWallet) {
      return NextResponse.json({ 
        error: 'Wallet not found in user accounts',
        availableWallets: wallets.map((w: any) => ({ address: w.address, chain_type: w.chain_type }))
      }, { status: 404 });
    }
    
    // According to Privy docs, for embedded wallets the "address" field contains what they call the "public key"
    // However, for Sui signatures, we need the actual cryptographic public key, not the wallet address
    // The wallet address is derived from the public key, but they are different things
    
    console.log('Target wallet data:', JSON.stringify(targetWallet, null, 2));
    
    // Try to find the actual cryptographic public key
    // Check various possible fields where the public key might be stored
    const possiblePublicKeyFields = [
      'public_key',
      'publicKey', 
      'embedded_wallet_public_key',
      'key_data',
      'public_key_hex'
    ];
    
    let cryptographicPublicKey = null;
    
    for (const field of possiblePublicKeyFields) {
      if (targetWallet[field]) {
        cryptographicPublicKey = targetWallet[field];
        console.log(`Found public key in field '${field}':`, cryptographicPublicKey);
        break;
      }
    }
    
    // If we can't find the cryptographic public key, we need to explain the issue
    if (!cryptographicPublicKey) {
      return NextResponse.json({ 
        error: 'Cryptographic public key not found in wallet data',
        explanation: 'The wallet address is available but the actual cryptographic public key (needed for Sui signatures) is not exposed by Privy API',
        walletAddress: targetWallet.address, // This is the wallet address (what Privy calls "public key")
        availableFields: Object.keys(targetWallet),
        walletData: targetWallet,
        note: 'For Sui signatures, we need the 32-byte Ed25519 public key, not the wallet address'
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      publicKey: cryptographicPublicKey,
      walletAddress: targetWallet.address, // The actual wallet address
      chainType: targetWallet.chain_type,
      note: 'publicKey is the cryptographic key for signatures, walletAddress is the derived address'
    });
    
  } catch (error: any) {
    console.error('Error fetching public key:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}