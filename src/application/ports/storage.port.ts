import type { Readable } from 'stream';

export interface IStorageService {
  uploadFile(
    bucket: string,
    key: string,
    data: Buffer | Readable,
    contentType: string,
    sizeBytes?: number,
  ): Promise<string>;
  getFileUrl(bucket: string, key: string): Promise<string>;
  deleteFile(bucket: string, key: string): Promise<void>;
  initiateMultipartUpload(
    bucket: string,
    key: string,
    contentType: string,
  ): Promise<string>;
  getMultipartUploadPartUrl(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresSec?: number,
  ): Promise<string>;
  completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<void>;
  abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
  ): Promise<void>;
  statObject(bucket: string, key: string): Promise<{ size: number } | null>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
