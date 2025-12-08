/**
 * S3 Uploader for Lambda report storage
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "node:fs";
import { logger } from "./logger";

const log = logger.child({ component: "S3Uploader" });

export interface S3UploadResult {
  key: string;
  url: string;
  bucket: string;
}

export class S3Uploader {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(bucketName?: string) {
    this.bucketName =
      bucketName ||
      process.env.REPORTS_BUCKET_NAME ||
      `denethor-qa-reports-${process.env.AWS_ACCOUNT_ID || "default"}`;

    this.s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

    log.info(
      { bucket: this.bucketName },
      "S3Uploader initialized",
    );
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(
    filePath: string,
    s3Key: string,
    contentType: string,
  ): Promise<S3UploadResult> {
    try {
      log.info({ filePath, s3Key, contentType }, "Uploading file to S3");

      const fileContent = readFileSync(filePath);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;

      log.info({ s3Key, url }, "File uploaded successfully");

      return {
        key: s3Key,
        url,
        bucket: this.bucketName,
      };
    } catch (error) {
      log.error({ error, filePath, s3Key }, "Failed to upload file to S3");
      throw error;
    }
  }

  /**
   * Upload report files to S3
   */
  async uploadReports(
    testId: string,
    reportPaths: {
      json: string;
      markdown: string;
      html: string;
    },
  ): Promise<{
    json: S3UploadResult;
    markdown: S3UploadResult;
    html: S3UploadResult;
  }> {
    log.info({ testId }, "Uploading reports to S3");

    const [jsonResult, markdownResult, htmlResult] = await Promise.all([
      this.uploadFile(
        reportPaths.json,
        `reports/${testId}/report.json`,
        "application/json",
      ),
      this.uploadFile(
        reportPaths.markdown,
        `reports/${testId}/report.md`,
        "text/markdown",
      ),
      this.uploadFile(
        reportPaths.html,
        `reports/${testId}/report.html`,
        "text/html",
      ),
    ]);

    log.info({ testId }, "All reports uploaded successfully");

    return {
      json: jsonResult,
      markdown: markdownResult,
      html: htmlResult,
    };
  }
}
