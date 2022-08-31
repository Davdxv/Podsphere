import { z } from 'zod';

export const BackupConformationError = "Backup doesn't conform to the database schema";

export const verifyBackup = <T extends z.ZodObject<any>>(schema: T,
  backup: string) => schema.safeParse(JSON.parse(backup));
