import { db } from '../../providers/subscriptions';

export const downloadBackup = async () => {
  try {
    const FileName = 'backup.txt';
    const text = await db.exportDB();
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
    element.setAttribute('download', FileName);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  } catch (e) {
    console.error(e);
  }
};

export const importBackup = async (file: string) => {
  await db.importDB(file);
  window.location.href = '/';
};
