/* eslint-disable @typescript-eslint/no-unused-vars */
import z from 'zod';
import { SchemaType } from '../../../providers/subscriptions';
import { dbSchema } from '../zod-schemas';

/**
 * @link https://github.com/colinhacks/zod/issues/372#issuecomment-826380330
 */
const schemaForType = <T>() => <S extends z.ZodType<T, any, any>>(arg: S) => arg;

describe('db schema typescript interface is in sync with the zod schema', () => {
  test('', () => {
    // Well this is not a typical test because it's essentially
    // a static typescript type-check. However I don't think there
    // is a better place than here to put this "test" in.
    const schemaTest = schemaForType<SchemaType>()(dbSchema);
  });
});
