import { IndexedDb } from '../../indexed-db';

const db = new IndexedDb();

export const downloadBackup = async () => {
  const FileName = 'backup.txt';
  const text = await db.exportDB();
  const element = document.createElement('a');
  element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
  element.setAttribute('download', FileName);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
};

export const importBackup = async (file: string) => db.importDB(file);
