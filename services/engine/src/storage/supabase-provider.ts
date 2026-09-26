import { Readable } from 'node:stream';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { StorageProvider, StorageMetadata } from './provider.js';

export class SupabaseStorageProvider implements StorageProvider {
  readonly code = 'supabase';

  constructor(
    private readonly client: SupabaseClient,
    private readonly bucketName: string = 'case-documents'
  ) {}

  async put(
    key: string,
    body: Buffer | Uint8Array | Readable,
    meta: StorageMetadata
  ): Promise<void> {
    let payload: Buffer | Uint8Array;

    if (body instanceof Buffer || body instanceof Uint8Array) {
      payload = body;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      payload = Buffer.concat(chunks);
    }

    const { error } = await this.client.storage
      .from(this.bucketName)
      .upload(key, payload, {
        contentType: meta.mime,
        upsert: true,
      });

    if (error) {
      throw new Error(`Error subiendo archivo a Supabase Storage [${key}]: ${error.message}`);
    }
  }

  async get(key: string): Promise<Readable> {
    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .download(key);

    if (error || !data) {
      throw new Error(
        `Error descargando archivo de Supabase Storage [${key}]: ${error?.message ?? 'No data'}`
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    return Readable.from(Buffer.from(arrayBuffer));
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucketName)
      .remove([key]);

    if (error) {
      throw new Error(`Error eliminando archivo de Supabase Storage [${key}]: ${error.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    const dir = key.includes('/') ? key.substring(0, key.lastIndexOf('/')) : '';
    const filename = key.includes('/') ? key.substring(key.lastIndexOf('/') + 1) : key;

    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .list(dir, { search: filename, limit: 1 });

    if (error || !data) {
      return false;
    }

    return data.some((item) => item.name === filename);
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .createSignedUrl(key, ttlSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(
        `Error generando URL firmada en Supabase Storage [${key}]: ${error?.message ?? 'URL vacía'}`
      );
    }

    return data.signedUrl;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { data, error } = await this.client.storage.getBucket(this.bucketName);
      return !error && data?.id === this.bucketName;
    } catch {
      return false;
    }
  }
}
