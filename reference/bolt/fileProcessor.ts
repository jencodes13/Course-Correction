import JSZip from 'jszip';

export type ProcessedFile = {
  file: File;
  name: string;
  size: number;
  type: string;
  path: string;
  isVideo: boolean;
};

export type ExtractionResult = {
  files: ProcessedFile[];
  videoFiles: ProcessedFile[];
  totalSize: number;
  videoCount: number;
  documentCount: number;
  archiveName?: string;
};

const VIDEO_EXTENSIONS = [
  '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv',
  '.webm', '.m4v', '.mpg', '.mpeg', '.3gp'
];

const VIDEO_MIME_TYPES = [
  'video/mp4', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/x-ms-wmv', 'video/x-flv',
  'video/webm', 'video/mpeg', 'video/3gpp'
];

export function isVideoFile(fileName: string, mimeType: string = ''): boolean {
  const lowerName = fileName.toLowerCase();
  const hasVideoExtension = VIDEO_EXTENSIONS.some(ext => lowerName.endsWith(ext));
  const hasVideoMimeType = VIDEO_MIME_TYPES.some(type => mimeType.includes(type));

  return hasVideoExtension || hasVideoMimeType;
}

export async function extractZipFile(zipFile: File): Promise<ExtractionResult> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipFile);

  const files: ProcessedFile[] = [];
  const videoFiles: ProcessedFile[] = [];
  let totalSize = 0;
  let videoCount = 0;
  let documentCount = 0;

  const filePromises: Promise<void>[] = [];

  loadedZip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;

    if (relativePath.startsWith('__MACOSX/') || relativePath.includes('.DS_Store')) {
      return;
    }

    const promise = zipEntry.async('blob').then((blob) => {
      const fileName = relativePath.split('/').pop() || relativePath;
      const file = new File([blob], fileName, { type: blob.type });

      const processedFile: ProcessedFile = {
        file,
        name: fileName,
        size: file.size,
        type: file.type,
        path: relativePath,
        isVideo: isVideoFile(fileName, file.type)
      };

      totalSize += file.size;

      if (processedFile.isVideo) {
        videoFiles.push(processedFile);
        videoCount++;
      } else {
        files.push(processedFile);
        documentCount++;
      }
    });

    filePromises.push(promise);
  });

  await Promise.all(filePromises);

  return {
    files,
    videoFiles,
    totalSize,
    videoCount,
    documentCount,
    archiveName: zipFile.name
  };
}

export async function processFileList(fileList: FileList | File[]): Promise<ExtractionResult> {
  const filesArray = Array.from(fileList);
  const files: ProcessedFile[] = [];
  const videoFiles: ProcessedFile[] = [];
  let totalSize = 0;
  let videoCount = 0;
  let documentCount = 0;

  for (const file of filesArray) {
    const isVideo = isVideoFile(file.name, file.type);

    const processedFile: ProcessedFile = {
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      path: file.name,
      isVideo
    };

    totalSize += file.size;

    if (isVideo) {
      videoFiles.push(processedFile);
      videoCount++;
    } else {
      files.push(processedFile);
      documentCount++;
    }
  }

  return {
    files,
    videoFiles,
    totalSize,
    videoCount,
    documentCount
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function checkTierLimit(totalSize: number, userTier: 'free' | 'premium'): {
  withinLimit: boolean;
  limit: number;
  overage: number;
} {
  const limit = userTier === 'premium' ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
  const withinLimit = totalSize <= limit;
  const overage = Math.max(0, totalSize - limit);

  return { withinLimit, limit, overage };
}

export function isZipFile(file: File): boolean {
  return (
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed' ||
    file.name.toLowerCase().endsWith('.zip')
  );
}
