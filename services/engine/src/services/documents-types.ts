export interface DocumentError extends Error {
  statusCode: number;
  code: string;
}

export function createDocumentError(
  message: string,
  statusCode: number,
  code: string,
): DocumentError {
  const error = new Error(message) as DocumentError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export interface UploadFileOptions {
  userJwt: string;
  caseDocumentId: string;
  fileBuffer: Buffer;
  originalFilename: string;
  claimedMime: string;
  changeSummary?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface DownloadUrlOptions {
  userJwt: string;
  versionId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}
