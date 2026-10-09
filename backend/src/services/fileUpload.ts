import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { supabase } from '../db/config';
import { logger } from '../logger';

export interface StoredFileResult {
  provider: 'supabase' | 'cloudinary' | 'local';
  url: string;
  path?: string;
  cloudinaryId?: string;
  mimeType: string;
  size: number;
  originalName: string;
}

const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'bayan-ledger';

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

const uploadsRoot = fsSync.existsSync(path.resolve(process.cwd(), 'uploads'))
  ? path.resolve(process.cwd(), 'uploads')
  : fsSync.existsSync(path.resolve(__dirname, '../../uploads'))
    ? path.resolve(__dirname, '../../uploads')
    : path.resolve(process.cwd(), 'backend/uploads');

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

  // Attempt upload to Supabase Storage bucket
  try {
    const filename = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(originalName)}`;
    const storagePath = `${folder}/${filename}`;
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (!uploadError) {
      const { data: publicData } = supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      if (publicData?.publicUrl) {
        return {
          provider: 'supabase',
          url: publicData.publicUrl,
          path: storagePath,
          mimeType,
          size: buffer.length,
          originalName,
        };
      }
    } else {
      logger.warn(`Supabase storage upload failed, falling back to local: ${uploadError.message}`);
    }
  } catch (storageErr: any) {
    logger.warn(`Supabase storage error, falling back to local: ${storageErr?.message || storageErr}`);
  }

  // Fallback to local uploads directory
  const subdir = path.join(uploadsRoot, folder);
  await fs.mkdir(subdir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(originalName)}`;
  const filepath = path.join(subdir, filename);
  await fs.writeFile(filepath, buffer);

  return {
    provider: 'local',
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

  if (file.provider === 'supabase' && file.path) {
    await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .remove([file.path])
      .catch((err) => logger.warn(`Failed to delete file from Supabase storage: ${err?.message || err}`));
    return;
  }

  const localPath = file.path || (file.url && file.url.includes('/uploads/')
    ? path.join(uploadsRoot, file.url.split('/uploads/')[1] || '')
    : undefined);

  if (localPath) {
    await fs.unlink(localPath).catch(() => undefined);
  }
}

