import { useState, useRef, useCallback } from 'react';
import type { DriveDownloadProgress } from '../types';

// ============================================
// Type declarations for Google APIs
// ============================================

declare global {
  interface Window {
    gapi: {
      load: (api: string, config: { callback: () => void; onerror: (err: any) => void }) => void;
    };
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
          revoke: (token: string, callback: () => void) => void;
        };
      };
      picker: {
        PickerBuilder: new () => PickerBuilder;
        DocsView: new () => DocsView;
        Feature: { MULTISELECT_ENABLED: string };
        Action: { PICKED: string; CANCEL: string };
        Response: { DOCUMENTS: string };
        Document: {
          ID: string;
          NAME: string;
          MIME_TYPE: string;
          SIZE_BYTES: string;
        };
      };
    };
  }

  interface PickerBuilder {
    addView: (view: any) => PickerBuilder;
    setOAuthToken: (token: string) => PickerBuilder;
    setDeveloperKey: (key: string) => PickerBuilder;
    setCallback: (callback: (data: any) => void) => PickerBuilder;
    enableFeature: (feature: string) => PickerBuilder;
    setMaxItems: (max: number) => PickerBuilder;
    setTitle: (title: string) => PickerBuilder;
    setOrigin: (origin: string) => PickerBuilder;
    build: () => { setVisible: (visible: boolean) => void };
  }

  interface DocsView {
    setIncludeFolders: (include: boolean) => DocsView;
    setSelectFolderEnabled: (enabled: boolean) => DocsView;
    setMimeTypes: (types: string) => DocsView;
  }
}

// ============================================
// Script loading (module-level, load once)
// ============================================

let gapiLoadPromise: Promise<void> | null = null;
let gisLoadPromise: Promise<void> | null = null;

function loadGapiScript(): Promise<void> {
  if (gapiLoadPromise) return gapiLoadPromise;
  gapiLoadPromise = new Promise((resolve, reject) => {
    if (window.gapi) {
      window.gapi.load('picker', { callback: resolve, onerror: reject });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.onload = () => {
      window.gapi.load('picker', { callback: resolve, onerror: reject });
    };
    script.onerror = () => reject(new Error('Failed to load Google API script'));
    document.head.appendChild(script);
  });
  return gapiLoadPromise;
}

function loadGisScript(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

// ============================================
// Google Workspace MIME types
// ============================================

const WORKSPACE_MIME_TYPES = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.spreadsheet',
];

const PICKER_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  ...WORKSPACE_MIME_TYPES,
].join(',');

// ============================================
// File download helpers
// ============================================

async function downloadDriveFile(
  fileId: string,
  fileName: string,
  mimeType: string,
  token: string,
  onProgress: (progress: number) => void,
): Promise<File> {
  const isWorkspaceFile = WORKSPACE_MIME_TYPES.includes(mimeType);
  const exportMimeType = 'application/pdf';

  const url = isWorkspaceFile
    ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${response.statusText}`);
  }

  // Stream with progress tracking
  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total > 0) {
      onProgress(Math.round((loaded / total) * 100));
    } else {
      // Indeterminate — pulse between 10-90
      onProgress(Math.min(90, 10 + (loaded / (1024 * 1024)) * 5));
    }
  }

  onProgress(100);

  const finalMimeType = isWorkspaceFile ? exportMimeType : mimeType;
  const blob = new Blob(chunks, { type: finalMimeType });

  // Append .pdf for exported workspace files
  let finalName = fileName;
  if (isWorkspaceFile && !finalName.toLowerCase().endsWith('.pdf')) {
    finalName += '.pdf';
  }

  return new File([blob], finalName, { type: finalMimeType });
}

// ============================================
// Hook
// ============================================

interface UseGoogleDrivePickerOptions {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
}

interface UseGoogleDrivePickerReturn {
  openPicker: () => void;
  isLoading: boolean;
  downloadProgress: DriveDownloadProgress[];
  error: string | null;
}

export function useGoogleDrivePicker(
  options: UseGoogleDrivePickerOptions,
): UseGoogleDrivePickerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DriveDownloadProgress[]>([]);
  const tokenRef = useRef<string | null>(null);

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

  const showPicker = useCallback((token: string) => {
    const docsView = new window.google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMimeTypes(PICKER_MIME_TYPES);

    const picker = new window.google.picker.PickerBuilder()
      .addView(docsView)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setCallback(async (data: any) => {
        if (data.action === window.google.picker.Action.CANCEL) {
          setIsLoading(false);
          return;
        }

        if (data.action === window.google.picker.Action.PICKED) {
          const docs = data[window.google.picker.Response.DOCUMENTS];
          if (!docs || docs.length === 0) {
            setIsLoading(false);
            return;
          }

          setIsLoading(true);

          // Initialize download progress for each file
          const progressEntries: DriveDownloadProgress[] = docs.map((doc: any) => ({
            fileId: doc[window.google.picker.Document.ID],
            fileName: doc[window.google.picker.Document.NAME],
            progress: 0,
            status: 'downloading' as const,
          }));
          setDownloadProgress(progressEntries);

          const downloadedFiles: File[] = [];

          for (const doc of docs) {
            const fileId = doc[window.google.picker.Document.ID];
            const fileName = doc[window.google.picker.Document.NAME];
            const mimeType = doc[window.google.picker.Document.MIME_TYPE];

            try {
              const file = await downloadDriveFile(
                fileId,
                fileName,
                mimeType,
                token,
                (progress) => {
                  setDownloadProgress(prev =>
                    prev.map(p =>
                      p.fileId === fileId ? { ...p, progress } : p,
                    ),
                  );
                },
              );

              // Check 50MB limit
              if (file.size > 50 * 1024 * 1024) {
                setDownloadProgress(prev =>
                  prev.map(p =>
                    p.fileId === fileId
                      ? { ...p, status: 'error', error: 'File exceeds 50MB limit' }
                      : p,
                  ),
                );
                continue;
              }

              downloadedFiles.push(file);
              setDownloadProgress(prev =>
                prev.map(p =>
                  p.fileId === fileId ? { ...p, progress: 100, status: 'complete' } : p,
                ),
              );
            } catch (err) {
              console.error(`Failed to download ${fileName}:`, err);
              setDownloadProgress(prev =>
                prev.map(p =>
                  p.fileId === fileId
                    ? { ...p, status: 'error', error: String(err) }
                    : p,
                ),
              );
            }
          }

          // Revoke token
          if (tokenRef.current) {
            try {
              window.google.accounts.oauth2.revoke(tokenRef.current, () => {});
            } catch {
              // Token revocation is best-effort
            }
            tokenRef.current = null;
          }

          if (downloadedFiles.length > 0) {
            options.onFilesSelected(downloadedFiles);
          }

          setIsLoading(false);
        }
      })
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setMaxItems(options.maxFiles || 10)
      .setTitle('Select course materials')
      .setOrigin(window.location.origin)
      .build();

    picker.setVisible(true);
  }, [API_KEY, options]);

  const openPicker = useCallback(async () => {
    if (!CLIENT_ID || !API_KEY) {
      setError('Google Drive is not configured. Missing API credentials.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setDownloadProgress([]);

    try {
      // Load scripts in parallel
      await Promise.all([loadGapiScript(), loadGisScript()]);

      // Request OAuth token
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            setError(`Google Drive authorization failed: ${tokenResponse.error}`);
            setIsLoading(false);
            return;
          }
          tokenRef.current = tokenResponse.access_token || null;
          if (tokenRef.current) {
            showPicker(tokenRef.current);
          }
        },
      });

      tokenClient.requestAccessToken();
    } catch (err) {
      console.error('Google Drive Picker error:', err);
      setError('Failed to open Google Drive. Please try again.');
      setIsLoading(false);
    }
  }, [CLIENT_ID, API_KEY, showPicker]);

  return { openPicker, isLoading, downloadProgress, error };
}
