import { JWKInterface, WalletTypes } from '../interfaces';
import client from './client';
import { usingArConnect } from './utils';

export async function createNewDevWallet() : Promise<JWKInterface> {
  const wallet = await client.wallets.generate();
  await mintDevTokens(await getWalletAddress(wallet));
  return wallet;
}

export async function getWalletAddress(wallet: WalletTypes)
  : Promise<string> {
  if (usingArConnect()) return window.arweaveWallet.getActiveAddress();

  return client.wallets.jwkToAddress(wallet as JWKInterface);
}

async function mintDevTokens(walletAddress: string, numTokens = '100000000000000000') {
  client.api.get(`/mint/${walletAddress}/${numTokens}`);
}
