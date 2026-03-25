import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION as string,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID as string,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY as string,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const S3_BUCKET = (import.meta.env.VITE_AWS_S3_BUCKET ?? "") as string;
export const CLOUDFRONT_URL = (
  (import.meta.env.VITE_CLOUDFRONT_URL ?? "") as string
).replace(/\/$/, "");

export type S3Folder =
  | "courses/videos"
  | "courses/thumbnails"
  | "courses/pdfs"
  | "artists/images";

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
}

/** Upload a file to S3, returns the CloudFront URL. Reports progress 0–100. */
export async function uploadToS3(
  file: File,
  folder: S3Folder,
  onProgress?: (percent: number) => void
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: S3_BUCKET,
      Key: key,
      Body: file,
      ContentType: file.type,
    },
  });

  if (onProgress) {
    upload.on("httpUploadProgress", (p) => {
      if (p.loaded && p.total) {
        onProgress(Math.round((p.loaded / p.total) * 100));
      }
    });
  }

  await upload.done();
  return `${CLOUDFRONT_URL}/${key}`;
}

/** Delete a single object from S3 by key. */
export async function deleteS3Object(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}

/** List all objects in the bucket (handles pagination). */
export async function listAllS3Objects(): Promise<S3Object[]> {
  const all: S3Object[] = [];
  let token: string | undefined;

  do {
    const res: ListObjectsV2CommandOutput = await s3Client.send(
      new ListObjectsV2Command({ Bucket: S3_BUCKET, ContinuationToken: token })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key && obj.Size !== undefined && obj.LastModified) {
        all.push({ key: obj.Key, size: obj.Size, lastModified: obj.LastModified });
      }
    }
    token = res.NextContinuationToken;
  } while (token);

  return all;
}

/** Extract the S3 key from a CloudFront URL. Returns null if it doesn't match. */
export function keyFromUrl(url: string): string | null {
  if (!url.startsWith(CLOUDFRONT_URL)) return null;
  return url.slice(CLOUDFRONT_URL.length + 1); // strip leading slash
}

/** Format bytes as a human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
