import { googleService, type CloudFile } from '../services/googleService';

export interface CloudSource {
  provider: 'gdrive';
  integration: 'google';
  label: string;
  clientIdKey: 'googleClientId';
  clientIdName: string;
  listFolder: (folderId?: string) => Promise<CloudFile[]>;
  search: (text: string) => Promise<CloudFile[]>;
  recent: () => Promise<CloudFile[]>;
  shared: () => Promise<CloudFile[]>;
}

export const DRIVE_SOURCE: CloudSource = {
  provider: 'gdrive',
  integration: 'google',
  label: 'Google Drive',
  clientIdKey: 'googleClientId',
  clientIdName: 'Google',
  listFolder: (folderId) => googleService.listDriveFolder(folderId),
  search: (text) => googleService.searchDriveFiles(text),
  recent: () => googleService.listRecentDriveFiles(),
  shared: () => googleService.listSharedWithMe(),
};
