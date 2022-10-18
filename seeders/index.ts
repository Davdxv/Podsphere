import {
  JWKInterface,
  Podcast,
  PodcastDTO,
  Transaction,
} from '../src/client/interfaces';
import { podcastsFromDTO } from '../src/utils';
import { createNewDevWallet } from '../src/client/arweave/wallet';
import {
  newTransactionFromMetadata,
  signAndPostTransaction,
} from '../src/client/arweave/create-transaction';
import metadataBatches from './podcasts.json';

// eslint-disable-next-line import/no-extraneous-dependencies
require('dotenv').config();

const ARG = process.argv.at(-1);
if (ARG === 'some') {
  const firstBatchesOnly = metadataBatches.filter(batch => batch.metadataBatch === 0);
  seed(firstBatchesOnly);
}
else {
  seed(metadataBatches);
}

async function delay(ms: number) {
  return new Promise(resolve => { setTimeout(resolve, ms); });
}

export default async function seed(dtoMetadataBatches: PodcastDTO[], ms = 3000) : Promise<void> {
  await delay(ms);
  console.log('Begin seeding...');

  const wallet : JWKInterface = await createNewDevWallet();
  const batches : Podcast[] = podcastsFromDTO(dtoMetadataBatches, true, true);
  const txs : Transaction[] = await Promise.all(
    batches.map(batch => newTransactionFromMetadata(wallet, batch)),
  );
  await Promise.all(txs.map(tx => signAndPostTransaction(tx, wallet)));

  console.log(`Seeding of ${txs.length} transactions successful!`);
}
