import { createClient } from './supabase/client';

export interface StorageUploadConfig {
  maxFileMb: number;
  allowedMimes: string[];
  acceptAttribute: string;
  displayHelpText: string;
}

export const DEFAULT_UPLOAD_CONFIG: StorageUploadConfig = {
  maxFileMb: 10,
  allowedMimes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ],
  acceptAttribute:
    '.pdf,.docx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png',
  displayHelpText: 'Formatos: PDF, Word (.docx), JPG, PNG. Máx. 10 MB.',
};

/**
 * Consulta la configuración de almacenamiento desde system_settings en Supabase
 * para determinar el tope de tamaño dinámico y los tipos MIME permitidos.
 */
export async function fetchStorageUploadConfig(): Promise<StorageUploadConfig> {
  try {
    const supabase = createClient();
    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('Network timeout') }), 1500),
    );
    const { data, error } = await Promise.race([
      supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'storage.max_file_mb',
          'documents.max_file_mb',
          'storage.allowed_mime',
          'documents.allowed_mime',
        ]),
      timeoutPromise,
    ]);

    if (error || !data || data.length === 0) return DEFAULT_UPLOAD_CONFIG;

    const map = new Map<string, unknown>();
    for (const row of data) {
      map.set(row.key, row.value);
    }

    let maxFileMb = DEFAULT_UPLOAD_CONFIG.maxFileMb;
    const maxSetting = map.get('storage.max_file_mb') ?? map.get('documents.max_file_mb');
    if (typeof maxSetting === 'number' && maxSetting > 0) {
      maxFileMb = maxSetting;
    }

    let allowedMimes = DEFAULT_UPLOAD_CONFIG.allowedMimes;
    const mimeSetting = map.get('storage.allowed_mime') ?? map.get('documents.allowed_mime');
    if (Array.isArray(mimeSetting) && mimeSetting.length > 0) {
      allowedMimes = mimeSetting.map(String);
    }

    const extensions: string[] = [];
    const labels: string[] = [];

    for (const mime of allowedMimes) {
      if (mime === 'application/pdf') {
        extensions.push('.pdf');
        labels.push('PDF');
      } else if (mime.includes('wordprocessingml') || mime === 'application/docx') {
        extensions.push('.docx');
        labels.push('Word (.docx)');
      } else if (mime === 'image/jpeg') {
        extensions.push('.jpg', '.jpeg');
        labels.push('JPG');
      } else if (mime === 'image/png') {
        extensions.push('.png');
        labels.push('PNG');
      } else {
        extensions.push(mime);
        labels.push(mime);
      }
    }

    const uniqueLabels = Array.from(new Set(labels));
    const acceptAttribute = Array.from(new Set([...extensions, ...allowedMimes])).join(',');
    const displayHelpText = `Formatos: ${uniqueLabels.join(', ')}. Máx. ${maxFileMb} MB.`;

    return { maxFileMb, allowedMimes, acceptAttribute, displayHelpText };
  } catch {
    return DEFAULT_UPLOAD_CONFIG;
  }
}
