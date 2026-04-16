import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? '';
const R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '';
const R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '';
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'aireply-media';
const R2_PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL ?? '').replace(/\/$/, '');

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    });
  }
  return _client;
}

/**
 * Upload a Buffer to R2.
 * Returns the public URL if R2_PUBLIC_URL is configured, otherwise null.
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string | null> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) return null;
  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=86400',
      })
    );
    return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : null;
  } catch (err) {
    console.error('[R2] Upload error:', err);
    return null;
  }
}

/**
 * Check if a key already exists in R2 (to avoid re-uploading).
 */
export async function existsInR2(key: string): Promise<boolean> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) return false;
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Download a remote image URL and upload it to R2.
 * Returns the R2 public URL or null on failure.
 */
export async function mirrorImageToR2(
  remoteUrl: string,
  key: string
): Promise<string | null> {
  if (!R2_ACCOUNT_ID || !R2_PUBLIC_URL) return null;
  try {
    // If already uploaded, return direct URL
    const alreadyExists = await existsInR2(key);
    if (alreadyExists) return `${R2_PUBLIC_URL}/${key}`;

    const res = await fetch(remoteUrl);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    return uploadToR2(key, buffer, contentType);
  } catch (err) {
    console.error('[R2] Mirror error:', err);
    return null;
  }
}
