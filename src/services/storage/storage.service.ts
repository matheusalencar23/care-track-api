import { createReadStream } from "node:fs";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_FORCE_PATH_STYLE,
  S3_PUBLIC_ENDPOINT,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
} from "../../config/secrets.js";

export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

const clientFor = (endpoint: string) =>
  new S3Client({
    endpoint,
    region: S3_REGION,
    forcePathStyle: S3_FORCE_PATH_STYLE,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });

const client = clientFor(S3_ENDPOINT);
const signingClient = clientFor(S3_PUBLIC_ENDPOINT);

export const putObject = async (
  key: string,
  filePath: string,
  contentType: string,
  size: number,
) => {
  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
      ContentLength: size,
    }),
  );
};

export const createDownloadUrl = async (
  key: string,
  disposition: "attachment" | "inline" = "attachment",
) => {
  return await getSignedUrl(
    signingClient,
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ResponseContentDisposition: disposition,
      ResponseCacheControl: "no-store",
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
};
