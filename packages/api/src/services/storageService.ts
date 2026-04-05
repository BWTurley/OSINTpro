import { Client as MinioClient } from 'minio';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { Readable } from 'stream';

export interface UploadResult {
  bucket: string;
  key: string;
  etag: string;
  size: number;
}

export interface FileMetadata {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  contentType?: string;
}

export class StorageService {
  private client: MinioClient;
  private bucket: string;

  constructor() {
    this.client = new MinioClient({
      endPoint: config.MINIO_ENDPOINT,
      port: config.MINIO_PORT,
      useSSL: config.MINIO_USE_SSL,
      accessKey: config.MINIO_ACCESS_KEY,
      secretKey: config.MINIO_SECRET_KEY,
    });
    this.bucket = config.MINIO_BUCKET;
  }

  async initialize(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        logger.info('Created MinIO bucket: %s', this.bucket);
      }
    } catch (err) {
      logger.error({ err }, 'Failed to initialize MinIO bucket');
    }
  }

  async upload(
    key: string,
    data: Buffer | Readable,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<UploadResult> {
    const size = Buffer.isBuffer(data) ? data.length : 0;

    const result = await this.client.putObject(
      this.bucket,
      key,
      data,
      size > 0 ? size : undefined,
      {
        'Content-Type': contentType,
        ...metadata,
      },
    );

    logger.info({ key, bucket: this.bucket }, 'File uploaded');

    return {
      bucket: this.bucket,
      key,
      etag: result.etag,
      size,
    };
  }

  async download(key: string): Promise<Readable> {
    return this.client.getObject(this.bucket, key);
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
    logger.info({ key, bucket: this.bucket }, 'File deleted');
  }

  async list(prefix?: string): Promise<FileMetadata[]> {
    return new Promise((resolve, reject) => {
      const files: FileMetadata[] = [];
      const stream = this.client.listObjectsV2(this.bucket, prefix ?? '', true);

      stream.on('data', (obj) => {
        if (obj.name) {
          files.push({
            key: obj.name,
            size: obj.size,
            lastModified: obj.lastModified,
            etag: obj.etag,
          });
        }
      });
      stream.on('end', () => resolve(files));
      stream.on('error', reject);
    });
  }

  async getPresignedUrl(key: string, expirySeconds: number = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async getPresignedUploadUrl(key: string, expirySeconds: number = 3600): Promise<string> {
    return this.client.presignedPutObject(this.bucket, key, expirySeconds);
  }

  async stat(key: string): Promise<FileMetadata | null> {
    try {
      const stat = await this.client.statObject(this.bucket, key);
      return {
        key,
        size: stat.size,
        lastModified: stat.lastModified,
        etag: stat.etag,
        contentType: stat.metaData?.['content-type'],
      };
    } catch (err: unknown) {
      const minioErr = err as { code?: string };
      if (minioErr.code === 'NotFound') return null;
      throw err;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.bucketExists(this.bucket);
      return true;
    } catch {
      return false;
    }
  }
}
