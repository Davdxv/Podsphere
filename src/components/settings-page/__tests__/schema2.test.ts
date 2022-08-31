/**
 * @jest-environment jsdom
 */
import * as idbUtils from '../../../idb-utils';
import { IndexedDb } from '../../../indexed-db';
import { downloadBackup, importBackup } from '../utils';
import { MinimalBackupString } from '../minimal-backup';

const verifyBackup = jest.spyOn(idbUtils, 'verifyBackup');

const { BackupConformationError } = idbUtils;

afterAll(() => {
  jest.restoreAllMocks();
});

test('download backup is working correctly', async () => {
  const BackupFail = 'backup export failed';
  let exportDB = jest.spyOn(IndexedDb.prototype, 'exportDB')
    .mockRejectedValueOnce(new Error(BackupFail));

  await expect(downloadBackup).rejects.toThrowError(BackupFail);
  expect(exportDB).toBeCalledTimes(1);

  exportDB = jest.spyOn(IndexedDb.prototype, 'exportDB')
    .mockResolvedValueOnce(MinimalBackupString);

  downloadBackup();
  expect(downloadBackup).not.toThrow();
  expect(exportDB).toBeCalledTimes(3);
});

test('import backup', async () => {
  // @ts-ignore
  verifyBackup.mockReturnValueOnce({ success: false });
  await expect(importBackup).rejects.toThrowError(BackupConformationError);
  expect(verifyBackup).toBeCalledTimes(1);

  const defectiveBackup = JSON.parse(MinimalBackupString);
  defectiveBackup.metadataToSync = 5;
  const defectiveBackupString = JSON.stringify(defectiveBackup);
  verifyBackup.mockRestore();

  await expect(() => importBackup(defectiveBackupString))
    .rejects.toThrowError(BackupConformationError);
});
