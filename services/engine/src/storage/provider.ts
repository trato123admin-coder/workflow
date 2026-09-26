import type { Readable } from 'node:stream';

export interface StorageMetadata {
  mime: string;
  sha256: string;
  size: number;
}

/**
 * Interfaz universal de almacenamiento (01-anexo §B.4).
 * Aísla la lógica del motor respecto al proveedor físico subyacente.
 */
export interface StorageProvider {
  /** Código del backend registrado en storage_backends (ej. 'supabase', 'r2') */
  readonly code: string;

  /** Sube un archivo con sus metadatos de integridad */
  put(key: string, body: Buffer | Uint8Array | Readable, meta: StorageMetadata): Promise<void>;

  /** Obtiene un stream de lectura del archivo */
  get(key: string): Promise<Readable | NodeJS.ReadableStream>;

  /** Elimina un archivo del almacén */
  delete(key: string): Promise<void>;

  /** Comprueba si el archivo existe */
  exists(key: string): Promise<boolean>;

  /** Genera una URL firmada de corta duración para descarga */
  signedUrl(key: string, ttlSeconds: number): Promise<string>;

  /** Comprueba conectividad y disponibilidad del bucket */
  healthCheck?(): Promise<boolean>;
}
