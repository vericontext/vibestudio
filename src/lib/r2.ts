import { createReadStream } from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type R2UploadResult = {
  key: string;
  url: string;
};

type R2Config = {
  bucket: string;
  publicBaseUrl: string;
  client: S3Client;
};

export async function uploadFileToR2(input: {
  filePath: string;
  key: string;
  contentType: string;
  cacheControl?: string;
}): Promise<R2UploadResult> {
  const config = r2Config();
  await config.client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      Body: createReadStream(input.filePath),
      ContentType: input.contentType,
      CacheControl: input.cacheControl ?? "public, max-age=31536000, immutable"
    })
  );
  return { key: input.key, url: publicR2Url(config.publicBaseUrl, input.key) };
}

export function publicUrlForR2Key(key: string): string {
  const config = r2Config();
  return publicR2Url(config.publicBaseUrl, key);
}

export function assertR2Configured(): void {
  r2Config();
}

function r2Config(): R2Config {
  const accountId = env("R2_ACCOUNT_ID");
  const endpoint = normalizeEndpoint(env("R2_ENDPOINT") || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ""));
  const accessKeyId = env("R2_ACCESS_KEY_ID");
  const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
  const bucket = env("R2_BUCKET");
  const publicBaseUrl = env("R2_PUBLIC_BASE_URL");
  const missing = [
    ["R2_ACCESS_KEY_ID", accessKeyId],
    ["R2_SECRET_ACCESS_KEY", secretAccessKey],
    ["R2_BUCKET", bucket],
    ["R2_PUBLIC_BASE_URL", publicBaseUrl],
    ["R2_ENDPOINT or R2_ACCOUNT_ID", endpoint]
  ].flatMap(([name, value]) => (value ? [] : [name]));
  if (missing.length > 0) {
    throw new Error(`R2 publish is not configured. Missing: ${missing.join(", ")}.`);
  }
  return {
    bucket,
    publicBaseUrl,
    client: new S3Client({
      region: env("R2_REGION") || "auto",
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey }
    })
  };
}

function publicR2Url(baseUrl: string, key: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function normalizeEndpoint(value: string): string {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}
