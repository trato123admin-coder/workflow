'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Camera,
  FileText,
  AlertCircle,
  Loader2,
  X,
  FileCheck,
  FileType,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { optimizeImageFile, convertImageToPdf } from '../../lib/image-compression';
import { uploadDocumentToEngine } from '../../lib/engine-client';
import {
  fetchStorageUploadConfig,
  DEFAULT_UPLOAD_CONFIG,
  type StorageUploadConfig,
} from '../../lib/settings-client';
import type { UploadVersionResponse } from '@workflow/shared';

interface FileUploaderProps {
  caseDocumentId: string;
  documentTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (version: UploadVersionResponse) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  caseDocumentId,
  documentTitle = 'Documento',
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawSourceFile, setRawSourceFile] = useState<File | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [changeSummary, setChangeSummary] = useState('');
  const [convertToPdf, setConvertToPdf] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isColdStarting, setIsColdStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadConfig, setUploadConfig] = useState<StorageUploadConfig>(DEFAULT_UPLOAD_CONFIG);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      void fetchStorageUploadConfig().then(setUploadConfig);
    }
  }, [isOpen]);

  const resetState = () => {
    setSelectedFile(null);
    setRawSourceFile(null);
    setOriginalSize(null);
    setChangeSummary('');
    setConvertToPdf(false);
    setIsProcessing(false);
    setIsUploading(false);
    setIsColdStarting(false);
    setErrorMessage(null);
    setIsDragOver(false);
  };

  const handleClose = () => {
    if (isUploading) return;
    resetState();
    onClose();
  };

  const processFile = async (file: File, fromCamera = false) => {
    setErrorMessage(null);
    setOriginalSize(file.size);
    setRawSourceFile(file);

    if (file.type.startsWith('image/')) {
      const asPdf = fromCamera;
      setConvertToPdf(asPdf);
      setIsProcessing(true);
      try {
        const finalFile = asPdf ? await convertImageToPdf(file) : await optimizeImageFile(file);
        setSelectedFile(finalFile);
      } catch {
        setSelectedFile(file);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setSelectedFile(file);
    }
  };

  const handleTogglePdf = async (checked: boolean) => {
    setConvertToPdf(checked);
    if (rawSourceFile && rawSourceFile.type.startsWith('image/')) {
      setIsProcessing(true);
      try {
        const finalFile = checked
          ? await convertImageToPdf(rawSourceFile)
          : await optimizeImageFile(rawSourceFile);
        setSelectedFile(finalFile);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const result = await uploadDocumentToEngine({
        caseDocumentId,
        file: selectedFile,
        changeSummary: changeSummary.trim() || undefined,
        onColdStartNotice: (waking) => setIsColdStarting(waking),
      });

      onSuccess(result);
      handleClose();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al subir el archivo');
    } finally {
      setIsUploading(false);
      setIsColdStarting(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Subir: ${documentTitle}`}
      description={uploadConfig.displayHelpText}
      maxWidth="md"
    >
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isColdStarting && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>Despertando motor en Render… espere unos segundos (cold-start).</span>
          </div>
        )}

        {!selectedFile ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void processFile(file, false);
            }}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 bg-surface'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              Arrastra y suelta tu archivo aquí
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              o selecciona desde tu dispositivo o cámara
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
              >
                Examinar archivo
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-xl border border-input bg-surface text-foreground text-xs font-semibold hover:bg-muted flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Usar cámara</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={uploadConfig.acceptAttribute}
              onChange={(e) => e.target.files?.[0] && void processFile(e.target.files[0], false)}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => e.target.files?.[0] && void processFile(e.target.files[0], true)}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl border border-border bg-surface flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatBytes(selectedFile.size)}
                    {originalSize && originalSize > selectedFile.size && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1">
                        (optimizado desde {formatBytes(originalSize)})
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {!isUploading && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setRawSourceFile(null);
                  }}
                  className="text-muted-foreground hover:text-foreground p-1"
                  title="Cambiar archivo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {rawSourceFile?.type.startsWith('image/') && (
              <div className="p-2.5 rounded-xl border border-border bg-surface flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-foreground font-medium">
                  <FileType className="w-3.5 h-3.5 text-primary" />
                  Convertir foto a documento PDF
                </span>
                <input
                  type="checkbox"
                  checked={convertToPdf}
                  onChange={(e) => void handleTogglePdf(e.target.checked)}
                  disabled={isUploading || isProcessing}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="change-summary"
                className="block text-xs font-semibold text-foreground mb-1"
              >
                Notas de la versión (opcional)
              </label>
              <input
                id="change-summary"
                type="text"
                placeholder="Ej. Copia certificada actualizada con firma notarial"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                disabled={isUploading}
                className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isUploading}
                className="px-4 py-2 rounded-xl border border-input text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading || isProcessing}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Transfiriendo…</span>
                  </>
                ) : isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Procesando…</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Subir Documento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
