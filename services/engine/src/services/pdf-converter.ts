/**
 * pdf-converter.ts — Convert DOCX to PDF using LibreOffice headless.
 *
 * Features:
 * - Isolated profile per job (no concurrency conflicts)
 * - Configurable timeout (default 60s)
 * - Simple semaphore for concurrency limiting
 * - Graceful degradation when LibreOffice is not available
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { EngineEnv } from '@workflow/shared';

const execFileAsync = promisify(execFile);

/* ------------------------------------------------------------------ */
/* Semaphore                                                           */
/* ------------------------------------------------------------------ */

class Semaphore {
  private queue: Array<() => void> = [];
  private current = 0;

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.current--;
    }
  }
}

let semaphore: Semaphore | null = null;

function getSemaphore(maxConcurrent: number): Semaphore {
  if (!semaphore) {
    semaphore = new Semaphore(maxConcurrent);
  }
  return semaphore;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface ConvertDocxToPdfParams {
  docxBuffer: Buffer;
  jobId: string;
  env: EngineEnv;
}

/**
 * Converts a DOCX buffer to PDF using LibreOffice headless.
 *
 * @throws Error if LibreOffice is not available or conversion fails.
 */
export async function convertDocxToPdf(params: ConvertDocxToPdfParams): Promise<Buffer> {
  const { docxBuffer, jobId, env } = params;
  const bin = env.LIBREOFFICE_BIN;

  if (!bin) {
    throw new Error(
      'LIBREOFFICE_BIN no configurado. Active docs.pdf_generation o instale LibreOffice.',
    );
  }

  const sem = getSemaphore(env.LIBREOFFICE_MAX_CONCURRENT);
  const workDir = join(tmpdir(), `docgen-${jobId}-${randomUUID().slice(0, 8)}`);
  const profileDir = join(tmpdir(), `lo-${jobId}`);
  const inputPath = join(workDir, 'document.docx');

  await sem.acquire();
  try {
    await mkdir(workDir, { recursive: true });
    await mkdir(profileDir, { recursive: true });
    await writeFile(inputPath, docxBuffer);

    await execFileAsync(bin, [
      '--headless',
      '--norestore',
      '--nofirststartwizard',
      '--convert-to', 'pdf',
      '--outdir', workDir,
      `-env:UserInstallation=file://${profileDir.replace(/\\/g, '/')}`,
      inputPath,
    ], {
      timeout: env.LIBREOFFICE_TIMEOUT_MS,
      env: { ...process.env, HOME: profileDir },
    });

    const pdfPath = join(workDir, 'document.pdf');
    const pdfBuffer = await readFile(pdfPath);

    if (pdfBuffer.length === 0) {
      throw new Error('LibreOffice generó un PDF vacío');
    }

    return pdfBuffer;
  } finally {
    sem.release();
    await cleanupDir(workDir);
    await cleanupDir(profileDir);
  }
}

/**
 * Checks if the LibreOffice binary is available and executable.
 */
export async function isLibreOfficeAvailable(bin: string): Promise<boolean> {
  if (!bin) return false;
  try {
    await access(bin);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function cleanupDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; don't fail the conversion
  }
}
