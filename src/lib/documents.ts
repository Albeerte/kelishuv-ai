import "server-only";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { encrypt, decrypt } from "./store";

const folder = path.join(process.cwd(), ".data", "documents");
const bucket = process.env.MINIO_BUCKET || "medimatch-documents";
let client: S3Client | undefined;
let bucketReady: Promise<void> | undefined;
function objectStorage() {
  if (!process.env.MINIO_ENDPOINT) return undefined;
  const endpoint = process.env.MINIO_ENDPOINT.includes("://")
    ? process.env.MINIO_ENDPOINT
    : `http://${process.env.MINIO_ENDPOINT}`;
  return (client ??= new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || "",
      secretAccessKey: process.env.MINIO_SECRET_KEY || "",
    },
  }));
}
async function ensureBucket(storage: S3Client) {
  bucketReady ??= storage
    .send(new HeadBucketCommand({ Bucket: bucket }))
    .then(() => undefined)
    .catch(async (error) => {
      if (error.$metadata?.httpStatusCode !== 404) throw error;
      try {
        await storage.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch {
        await storage.send(new HeadBucketCommand({ Bucket: bucket }));
      }
    })
    .catch((error) => {
      bucketReady = undefined;
      throw error;
    });
  return bucketReady;
}
export async function saveDocument(key: string, contents: Buffer) {
  const encrypted = encrypt(contents);
  const storage = objectStorage();
  if (storage) {
    await ensureBucket(storage);
    await storage.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: encrypted,
        ContentType: "application/octet-stream",
      }),
    );
    return;
  }
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, key), encrypted, { mode: 0o600 });
}
export async function loadDocument(key: string) {
  const storage = objectStorage();
  if (!storage) return decrypt(await readFile(path.join(folder, key)));
  const object = await storage.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!object.Body) throw new Error("The encrypted document is empty");
  return decrypt(Buffer.from(await object.Body.transformToByteArray()));
}
export async function removeDocument(key: string) {
  const storage = objectStorage();
  if (storage) {
    await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }
  await unlink(path.join(folder, key));
}
