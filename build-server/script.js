import { exec } from "child_process";
import { createReadStream, lstatSync, readdirSync } from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import Redis from "ioredis";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const publisher = new Redis(process.env.REDIS_URL);

function publishLog(log) {
  publisher.publish(`build-log:${PROJECT_ID}`, JSON.stringify(log));
}

const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;

async function main() {
  console.log("Build started...");
  publishLog("Build started...");

  const folderPath = path.join(__dirname, "output");

  const buildProcess = exec(`cd ${folderPath} && npm install && npm run build`);

  buildProcess.stdout.on("data", (data) => {
    console.log("stdout: " + data.toString());
    publishLog(data.toString());
  });

  buildProcess.stderr.on("data", (data) => {
    console.error("strerr: " + data.toString());
    publishLog(`Error: ${data.toString()}`);
  });

  buildProcess.on("close", async () => {
    console.log("Build process finished.");
    publishLog("Build process finished.");
    
    const distFolderPath = path.join(__dirname, "output", "dist");
    const distFolderContents = readdirSync(distFolderPath, { recursive: true }); // Get all files in the dist folder
    
    publishLog("Uploading build files...");
    Console.log("Uploading build files...");

    for (const file of distFolderContents) {
      const filePath = path.join(distFolderPath, file);

      if (lstatSync(filePath).isDirectory()) continue;

      publishLog(`Uploading ${file}.`);

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `output/${PROJECT_ID}/${file}`,
        Body: createReadStream(filePath),
        ContentType: mime.lookup(filePath),
      });

      await s3Client.send(command);
      publishLog(`Uploaded ${file}.`);
    }

    publishLog("Uploading done.");
    console.log("All files uploaded to S3.");

    process.exit(0);
  });
}

main();
