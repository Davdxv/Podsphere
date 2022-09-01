/**
 * @jest-environment jsdom
 */
import * as idbUtils from '../../../idb-utils';
import { IndexedDb } from '../../../indexed-db';
import { downloadBackup } from '../utils';
import { MinimalBackupString } from '../minimal-backup';

const verifyBackup = jest.spyOn(idbUtils, 'verifyBackup');

const { BackupConformationError } = idbUtils;

afterAll(() => {
  jest.restoreAllMocks();
});

window.URL.createObjectURL = jest.fn();

test('download backup is working correctly', async () => {
  const BackupFail = 'backup export failed';
  let exportDB = jest.spyOn(IndexedDb.prototype, 'exportDB')
    .mockRejectedValueOnce(new Error(BackupFail));

  await expect(downloadBackup).rejects.toThrowError(BackupFail);
  expect(exportDB).toBeCalledTimes(1);

  exportDB = jest.spyOn(IndexedDb.prototype, 'exportDB')
    .mockResolvedValueOnce(MinimalBackupString);

  expect(downloadBackup).not.toThrow();
  expect(exportDB).toBeCalledTimes(2);
});

test('import database', async () => {
  const db = new IndexedDb();
  verifyBackup.mockReturnValueOnce({ success: false } as any);
  await expect(db.importDB).rejects.toThrowError(BackupConformationError);
  expect(verifyBackup).toBeCalledTimes(1);

  const defectiveBackup = JSON.parse(MinimalBackupString);
  defectiveBackup.metadataToSync = 5;
  const defectiveBackupString = JSON.stringify(defectiveBackup);
  verifyBackup.mockRestore();

  await expect(() => db.importDB(defectiveBackupString))
    .rejects.toThrowError(BackupConformationError);
});
