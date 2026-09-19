import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

export interface StoredFileResult {
  provider: 'cloudinary' | 'local';
  url: string;
  path?: string;
  cloudinaryId?: string;
  mimeType: string;
  size: number;
  originalName: string;
}

const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });
}

const uploadsRoot = path.resolve(process.cwd(), 'uploads');

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

export async function uploadFileBuffer(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder = 'documents'
): Promise<StoredFileResult> {
  if (cloudinaryConfigured) {
    const publicId = `${folder}/${Date.now()}-${sanitizeFileName(originalName)}`;
    return await new Promise<StoredFileResult>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'sta-cruz-chain',
          public_id: publicId,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error('Cloudinary upload failed'));
            return;
          }

          resolve({
            provider: 'cloudinary',
            url: result.secure_url,
            cloudinaryId: result.public_id,
            mimeType,
            size: buffer.length,
            originalName,
          });
        }
      );

      stream.end(buffer);
    });
  }

  const subdir = path.join(uploadsRoot, folder);
  await fs.mkdir(subdir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(originalName)}`;
  const filepath = path.join(subdir, filename);
  await fs.writeFile(filepath, buffer);

  return {
    provider: 'local',
    // Store a relative asset path so the frontend can resolve it against
    // the actual public backend origin in local, LAN, or internet deployments.
    url: `/uploads/${folder}/${filename}`,
    path: filepath,
    mimeType,
    size: buffer.length,
    originalName,
  };
}

export async function deleteStoredFile(file: { provider?: string; cloudinaryId?: string; path?: string; url?: string }) {
  if (file.provider === 'cloudinary' && file.cloudinaryId) {
    await cloudinary.uploader.destroy(file.cloudinaryId, { resource_type: 'raw' }).catch(() => undefined);
    await cloudinary.uploader.destroy(file.cloudinaryId, { resource_type: 'image' }).catch(() => undefined);
    return;
  }

  const localPath = file.path || (file.url && file.url.includes('/uploads/')
    ? path.join(uploadsRoot, file.url.split('/uploads/')[1] || '')
    : undefined);

  if (localPath) {
    await fs.unlink(localPath).catch(() => undefined);
  }
}
