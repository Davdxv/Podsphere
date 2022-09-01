import {
  compressSync, strToU8, strFromU8, decompressSync,
} from 'fflate';
import { IndexedDb } from '../../indexed-db';

const db = new IndexedDb();

export const downloadBackup = async () => {
  const FileName = 'backup';
  const text = await db.exportDB();
  const compressedBlob = compressSync(strToU8(text));

  const blob = new Blob([compressedBlob], {
    type: 'application/octet-stream',
  });
  const url = window.URL.createObjectURL(blob);
  initiateDownload(url, FileName);
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

export const initiateDownload = (data: string, fileName: string) => {
  const a = document.createElement('a');
  a.setAttribute('href', data);
  a.setAttribute('download', fileName);
  document.body.appendChild(a);
  a.style.display = 'none';
  a.click();
  document.body.removeChild(a);
};

export const importBackup = async (file: Uint8Array) => db
  .importDB(strFromU8(decompressSync(file)));
