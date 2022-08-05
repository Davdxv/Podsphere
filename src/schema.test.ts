import z from 'zod';
import { dbSchema } from './result';
import { Podcast, ArSyncTx, Episode } from './test2';

const schemaForType = <T>() => <S extends z.ZodType<T, any, any>>(arg: S) => arg;

interface SchemaType {
  metadataToSync: Partial<Podcast>[];
  arSyncTxs: ArSyncTx[];
  episodes: {
    episodes: Episode[];
    subscribeUrl: string;
  }[];
  subscriptions: Podcast[]
}

describe('db schema typescript interface is in sync with zod schema', () => {
  test('', () => {
    const dog = schemaForType<SchemaType>()(dbSchema);
  });
});
