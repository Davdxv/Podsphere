/* eslint-disable @typescript-eslint/lines-between-class-members */
import { IDBPDatabase, openDB, unwrap } from 'idb';
// @ts-ignore
import IDBExportImport from 'indexeddb-export-import';
import { Podcast } from './client/interfaces';
import { dbSchema } from './components/settings-page/zod-schemas';

type TableSchemaV1 = {
  tableName: string,
  createObjectStoreParams: IDBObjectStoreParameters,
  createIndexParams?: {
    indexName: string,
    keyPath: string,
    objectParameters?: IDBIndexParameters,
  }
};

const verifyBackup = (backup: string) => dbSchema.safeParse(JSON.parse(backup));

export class IndexedDb {
  private database: string;

  private db!: IDBPDatabase;

  public static readonly SUBSCRIPTIONS = 'subscriptions';
  public static readonly EPISODES = 'episodes';
  public static readonly METADATATOSYNC = 'metadataToSync';
  public static readonly TX_HISTORY = 'transactionHistory';
  public static readonly TX_CACHE = 'transactionCache';

  public static readonly ID_MAPPINGS_INDEX = 'idMappings';

  public static readonly DB_NAME = 'Podsphere';
  public static readonly DB_VERSION = 1;
  public static readonly DB_SCHEMA_V1 : TableSchemaV1[] = [
    {
      tableName: IndexedDb.SUBSCRIPTIONS,
      createObjectStoreParams: { autoIncrement: false, keyPath: 'id' },
      createIndexParams: { indexName: IndexedDb.ID_MAPPINGS_INDEX, keyPath: 'feedUrl' },
    },
    {
      tableName: IndexedDb.EPISODES,
      createObjectStoreParams: { autoIncrement: false, keyPath: 'id' },
    },
    {
      tableName: IndexedDb.METADATATOSYNC,
      createObjectStoreParams: { autoIncrement: false, keyPath: 'id' },
    },
    {
      tableName: IndexedDb.TX_HISTORY,
      createObjectStoreParams: { autoIncrement: false, keyPath: 'id' },
    },
    {
      tableName: IndexedDb.TX_CACHE,
      createObjectStoreParams: { autoIncrement: false, keyPath: 'txId' },
    },
  ];

  public static readonly DB_ERROR_GENERIC_HELP_MESSAGE = [
    'If a refresh does not fix this, please contact our development team. You may attempt to',
    'resolve this yourself by loading a backup of your Ponder user data. A last resort would be to',
    'clear the offending table from the IndexedDB field in your browser\'s developer tools, but',
    'this will clear the corresponding cached data.',
  ].join(' ');

  constructor(database: string = IndexedDb.DB_NAME) {
    this.database = database;
    this.initializeDBSchema();
  }

  private async connectDB() {
    if (!this.db) {
      try {
        this.db = await openDB(this.database, IndexedDb.DB_VERSION);
      }
      catch (ex) { console.error(ex); }
    }
  }

  public async initializeDBSchema() {
    await this.createObjectStore(IndexedDb.DB_SCHEMA_V1);
  }

  private async createObjectStore(tables: TableSchemaV1[]) {
    try {
      this.db = await openDB(this.database, IndexedDb.DB_VERSION, {
        upgrade(db: IDBPDatabase) {
          for (const { tableName, createObjectStoreParams, createIndexParams } of tables) {
            if (!db.objectStoreNames.contains(tableName)) {
              const store = db.createObjectStore(tableName, createObjectStoreParams);
              if (createIndexParams && createIndexParams.indexName && createIndexParams.keyPath) {
                store.createIndex(createIndexParams.indexName, createIndexParams.keyPath);
              }
            }
          }
        },
      });
    }
    catch (ex) {
      throw new Error(`Initialization of database tables failed: ${ex}`);
    }
  }

  public async getByPodcastId(tableName: string, podcastId: Podcast['id']) {
    await this.connectDB();

    const tx = this.db.transaction(tableName, 'readonly');
    const store = tx.objectStore(tableName);
    const result = await store.get(podcastId);
    return result;
  }

  public async getAllValues(tableName: string) : Promise<any[]> {
    try {
      await this.connectDB();
      const tx = this.db.transaction(tableName, 'readonly');
      const store = tx.objectStore(tableName);
      const result = await store.getAll();
      return result;
    }
    catch (_ex) {
      return [];
    }
  }

  public async putValue(tableName: string, value: object) {
    await this.connectDB();

    const tx = this.db.transaction(tableName, 'readwrite');
    const store = tx.objectStore(tableName);
    const result = await store.put(value);
    return result;
  }

  public async putValues(tableName: string, values: object[]) {
    await this.connectDB();

    const tx = this.db.transaction(tableName, 'readwrite');
    const store = tx.objectStore(tableName);
    await Promise.all(values.map(value => store.put(value)));
    return true;
  }

  public async clearAllValues(tableName: string) {
    await this.connectDB();

    const tx = this.db.transaction(tableName, 'readwrite');
    const store = tx.objectStore(tableName);
    const result = await store.clear();
    return result;
  }

  public async deleteSubscription(tableName: string, id: Podcast['id']) {
    try {
      await this.connectDB();

      const tx = this.db.transaction(tableName, 'readwrite');
      const store = tx.objectStore(tableName);
      const result = await store.delete(id);
      return result;
    }
    catch (ex) {
      console.warn('IndexedDb.deleteSubscription() encountered the following error:', ex);
    }
    return null;
  }

  public async getIdFromFeedUrl(feedUrl: Podcast['feedUrl']) {
    let result = null;
    try {
      await this.connectDB();

      const tx = this.db.transaction(IndexedDb.SUBSCRIPTIONS, 'readonly');
      const store = tx.objectStore(IndexedDb.SUBSCRIPTIONS);
      const idMappingsIndex = store.index(IndexedDb.ID_MAPPINGS_INDEX);
      result = idMappingsIndex.getKey(feedUrl);
    }
    catch (ex) {
      console.warn('IndexedDb.getIdFromFeedUrl() encountered the following error:', ex);
    }
    return result;
  }

  public async exportDB() {
    await this.connectDB();
    const idbDatabase = unwrap(this.db); // get native IDBDatabase

    // export to JSON, clear database, and import from JSON
    return new Promise<string>((res, rej) => {
      IDBExportImport.exportToJsonString(idbDatabase, (err: Error, jsonString: string) => {
        if (err) {
          rej(err);
        } else {
          res(jsonString);
        }
      });
    });
  }

  public async importDB(backup: string) {
    console.log(JSON.parse(backup));
    console.log(verifyBackup(backup));
    if (!verifyBackup(backup).success) {
      console.error("Backup doesn't conform to the database schema");
      return;
    }
    await this.connectDB();

    const idbDatabase = unwrap(this.db); // get native IDBDatabase

    IDBExportImport.clearDatabase(idbDatabase, (err: Error) => {
      if (!err) { // cleared data successfully
        IDBExportImport.importFromJsonString(idbDatabase, backup, (err2: Error) => {
          if (!err2) {
            console.log('Imported data successfully');
          }
        });
      }
    });
  }
}
