import { exec } from "child_process";
import { createReadStream, lstatSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import { Kafka } from "kafkajs";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const kafka = new Kafka({
  clientId: `docker-build-server-${DEPLOYMENT_ID}`,
  brokers: [process.env.KAFKA_BROKER],
  ssl: {
    ca: [readFileSync(path.join(__dirname, "kafka.pem"), "utf-8")],
  },
  sasl: {
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
    mechanism: "plain",
  },
});

const producer = kafka.producer();

async function publishLog(log) {
  producer.send({
    topic: `build-log`,
    messages: [
      { key: "log", value: JSON.stringify(PROJECT_ID, DEPLOYMENT_ID, log) },
    ],
  });
}

const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;

async function main() {
  producer.connect();

  console.log("Build started...");
  await publishLog("Build started...");

  const folderPath = path.join(__dirname, "output");

  const buildProcess = exec(`cd ${folderPath} && npm install && npm run build`);

  buildProcess.stdout.on("data", async (data) => {
    console.log("stdout: " + data.toString());
    await publishLog(data.toString());
  });

  buildProcess.stderr.on("data", async (data) => {
    console.error("strerr: " + data.toString());
    await publishLog(`Error: ${data.toString()}`);
  });

  buildProcess.on("close", async () => {
    console.log("Build process finished.");
    await publishLog("Build process finished.");

    const distFolderPath = path.join(__dirname, "output", "dist");
    const distFolderContents = readdirSync(distFolderPath, { recursive: true }); // Get all files in the dist folder

    publishLog("Uploading build files...");
    Console.log("Uploading build files...");

    for (const file of distFolderContents) {
      const filePath = path.join(distFolderPath, file);

      if (lstatSync(filePath).isDirectory()) continue;

      await publishLog(`Uploading ${file}.`);

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `output/${PROJECT_ID}/${file}`,
        Body: createReadStream(filePath),
        ContentType: mime.lookup(filePath),
      });

      await s3Client.send(command);
      await publishLog(`Uploaded ${file}.`);
    }

    await publishLog("Uploading done.");
    console.log("All files uploaded to S3.");

    process.exit(0);
  });
}

main();
