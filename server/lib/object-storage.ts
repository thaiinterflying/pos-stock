import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export type ObjectStorageStatus = 'up' | 'down' | 'not_configured';

const DEFAULT_BUCKET = 'assets';
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

export type StoredObject = {
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
};

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  if ('name' in error) {
    const name = (error as { name?: string }).name;
    if (name === 'NoSuchKey' || name === 'NotFound') return true;
  }

  if ('$metadata' in error) {
    const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
    if (metadata?.httpStatusCode === 404) return true;
  }

  return false;
}

export function getObjectStorageBucket(): string {
  return process.env.STORAGE_BUCKET ?? process.env.NEON_STORAGE_BUCKET ?? DEFAULT_BUCKET;
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.AWS_ENDPOINT_URL_S3 &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION,
  );
}

let client: S3Client | null = null;

/**
 * สร้าง S3 client สำหรับ Neon Object Storage
 * Neon ต้องใช้ path-style addressing และอ่าน credential จาก AWS_* env vars
 */
export function getObjectStorageClient(): S3Client {
  if (!isObjectStorageConfigured()) {
    throw new Error('ยังไม่ได้ตั้งค่า Neon Object Storage (AWS_* env vars)');
  }

  if (!client) {
    client = new S3Client({
      forcePathStyle: true,
      region: process.env.AWS_REGION,
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  return client;
}

/** ตรวจว่า bucket ที่ declare ไว้ใน neon.ts เข้าถึงได้หรือไม่ (ใช้ใน health check) */
export async function checkObjectStorage(): Promise<ObjectStorageStatus> {
  if (!isObjectStorageConfigured()) return 'not_configured';

  try {
    await getObjectStorageClient().send(
      new HeadBucketCommand({ Bucket: getObjectStorageBucket() }),
      { abortSignal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS) },
    );
    return 'up';
  } catch {
    return 'down';
  }
}

/** อัปโหลดไฟล์ (ใช้กับรูปสินค้า) */
export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  await getObjectStorageClient().send(
    new PutObjectCommand({
      Bucket: getObjectStorageBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'private, max-age=86400',
    }),
  );
}

/** อ่านไฟล์ทั้งไฟล์ (รูปสินค้าจำกัด 2 MB) — คืน null ถ้าไม่พบ object */
export async function getObjectBytes(key: string): Promise<StoredObject | null> {
  try {
    const response = await getObjectStorageClient().send(
      new GetObjectCommand({ Bucket: getObjectStorageBucket(), Key: key }),
    );

    if (!response.Body) return null;

    const bytes = await response.Body.transformToByteArray();
    // copy ลง ArrayBuffer ใหม่เพื่อให้ใช้กับ Response BodyInit ได้ตรงชนิด
    const buffer = new Uint8Array(bytes.byteLength);
    buffer.set(bytes);

    return {
      bytes: buffer,
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getObjectStorageClient().send(
    new DeleteObjectCommand({ Bucket: getObjectStorageBucket(), Key: key }),
  );
}

/** ลบแบบ best-effort — ใช้ทำความสะอาดไฟล์เก่าโดยไม่ทำให้ request ล้มเหลว */
export async function deleteObjectQuietly(key: string): Promise<void> {
  try {
    await deleteObject(key);
  } catch {
    // ไม่ต้อง throw: ไฟล์กำพร้าไม่ได้กระทบข้อมูลหลัก
  }
}

/** ทดสอบ upload → download → delete จริง (ใช้ใน scripts/check-storage.ts) */
export async function runObjectStorageRoundTrip(): Promise<{
  bucket: string;
  region: string;
  bytes: number;
}> {
  const bucket = getObjectStorageBucket();
  const key = `healthchecks/tif-stock-${crypto.randomUUID()}.txt`;
  const payload = `TIF Stock object storage check ${new Date().toISOString()}`;
  const s3 = getObjectStorageClient();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: payload,
      ContentType: 'text/plain; charset=utf-8',
    }),
  );

  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await response.Body?.transformToString();

    if (body !== payload) {
      throw new Error('ข้อมูลที่ดาวน์โหลดไม่ตรงกับที่อัปโหลด');
    }

    return {
      bucket,
      region: process.env.AWS_REGION ?? '',
      bytes: Buffer.byteLength(payload, 'utf8'),
    };
  } finally {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}
