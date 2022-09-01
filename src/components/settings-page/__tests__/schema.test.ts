/* eslint-disable @typescript-eslint/no-unused-vars */
import z from 'zod';
import { verifyBackup } from '../../../idb-utils';
import { SchemaType } from '../../../providers/subscriptions';
import { dbSchema } from '../zod-schemas';
import { MinimalBackupString } from '../minimal-backup';

/**
 * @link https://github.com/colinhacks/zod/issues/372#issuecomment-826380330
 */
const schemaForType = <T>() => <S extends z.ZodType<T, any, any>>(arg: S) => arg;

beforeAll(() => {
  jest.restoreAllMocks();
});

describe('db schema typescript interface is in sync with the zod schema', () => {
  test('', () => {
    // Well this is not a typical test because it's essentially
    // a static typescript type-check. However I don't think there
    // is a better place than here to put this "test" in.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const schemaTest = schemaForType<SchemaType>()(dbSchema);
  });
});

test('verifyBackup works correctly', () => {
  expect(verifyBackup(dbSchema, MinimalBackupString).success).toBe(true);
  expect(() => verifyBackup(dbSchema, '')).toThrow();
});
