import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseStorageProvider } from '../storage/supabase-provider.js';

describe('SupabaseStorageProvider (S5-03)', () => {
  it('sube un archivo correctamente con su MIME y upsert', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const mockClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: uploadMock,
        }),
      },
    } as unknown as SupabaseClient;

    const provider = new SupabaseStorageProvider(mockClient, 'case-documents');
    const buffer = Buffer.from('test content');

    await provider.put('case-1/doc-1/v1/test.pdf', buffer, {
      mime: 'application/pdf',
      sha256: 'abc123sha',
      size: buffer.length,
    });

    expect(uploadMock).toHaveBeenCalledWith('case-1/doc-1/v1/test.pdf', buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
  });

  it('lanza error descriptivo si upload falla', async () => {
    const mockClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: new Error('Bucket not found') }),
        }),
      },
    } as unknown as SupabaseClient;

    const provider = new SupabaseStorageProvider(mockClient, 'case-documents');
    await expect(
      provider.put('key', Buffer.from('x'), { mime: 'image/png', sha256: 'x', size: 1 })
    ).rejects.toThrow('Error subiendo archivo a Supabase Storage [key]: Bucket not found');
  });

  it('genera una URL firmada con el TTL indicado', async () => {
    const mockClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://supabase.co/storage/v1/object/sign/case-documents/doc.pdf?token=xyz' },
            error: null,
          }),
        }),
      },
    } as unknown as SupabaseClient;

    const provider = new SupabaseStorageProvider(mockClient, 'case-documents');
    const url = await provider.signedUrl('case-1/doc.pdf', 60);

    expect(url).toContain('https://supabase.co/storage');
    expect(url).toContain('token=xyz');
  });

  it('elimina un archivo del bucket', async () => {
    const removeMock = vi.fn().mockResolvedValue({ error: null });
    const mockClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          remove: removeMock,
        }),
      },
    } as unknown as SupabaseClient;

    const provider = new SupabaseStorageProvider(mockClient, 'case-documents');
    await provider.delete('case-1/doc.pdf');

    expect(removeMock).toHaveBeenCalledWith(['case-1/doc.pdf']);
  });
});
