import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { WalrusClient } from '@mysten/walrus';
import { RetryableWalrusClientError } from '@mysten/walrus';
import type { RequestInfo, RequestInit } from 'undici';
import { Agent, fetch, setGlobalDispatcher } from 'undici';


const suiClient = new SuiClient({
	url: getFullnodeUrl('testnet'),
});
const walrusClient = new WalrusClient({
	network: 'testnet',
	suiClient,
});

/*const walrusClient = new WalrusClient({
	network: 'testnet',
	suiClient,
	storageNodeClientOptions: {
		timeout: 60_000,
		fetch: (url, init) => {
			// Some casting may be required because undici types may not exactly match the @node/types types
			return fetch(url as RequestInfo, {
				...(init as RequestInit),
				dispatcher: new Agent({
					connectTimeout: 60_000,
				}),
			}) as unknown as Promise<Response>;
		},
	},
});*/

/*const walrusClient = new WalrusClient({
	network: 'testnet',
	suiClient,
	storageNodeClientOptions: {
		onError: (error) => console.log(error),
	},
});*/

/*if (error instanceof RetryableWalrusClientError) {
	walrusClient.reset();
	//retry your operation 
}*/

/*const walrusClient = new WalrusClient({
	suiClient,
	packageConfig: {
		systemObjectId: '0x98ebc47370603fe81d9e15491b2f1443d619d1dab720d586e429ed233e1255c1',
		stakingPoolId: '0x20266a17b4f1a216727f3eef5772f8d486a9e3b5e319af80a5b75809c035561d',
	},
});*/

/*const walrusClient = new WalrusClient({
	network: 'testnet',
	suiClient,
	storageNodeClientOptions: {
		fetch: (url, options) => {
			console.log('fetching', url);
			return fetch(url, options);
		},
		timeout: 60_000,
	},
});*/
