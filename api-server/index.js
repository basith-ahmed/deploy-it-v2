import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import express from "express";
import { generateSlug } from "random-word-slugs";
import cors from "cors";
import { z } from "zod";
import Prisma from "@prisma/client";
import { createClient } from "@clickhouse/client";
import { Kafka } from "kafkajs";
import { v4 as uuid } from "uuid";
import { readFileSync } from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const ecsClient = new ECSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const config = {
  CLUSTER: process.env.ECS_CLUSTER,
  TASK: process.env.ECS_TASK,
  SUBNET: process.env.ECS_SUBNET,
};

const { PrismaClient } = Prisma;
const prisma = new PrismaClient();

//  // ClickHouse client
const client = createClient({
  host: process.env.CLICKHOUSE_HOST,
  database: process.env.CLICKHOUSE_DB,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
});

const kafka = new Kafka({
  clientId: "api-server",
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
const consumer = kafka.consumer({ groupId: "api-server-logs-consumer" });

const app = express();

app.use(express.json());
app.use(cors());

app.post("/project", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    gitRepoURL: z.string().url(),
  });

  const safeParse = schema.safeParse(req.body);

  if (!safeParse.success) {
    return res.status(400).json({
      error: safeParse.error,
    });
  }

  const { name, gitRepoURL } = safeParse.data;

  const project = await prisma.project.create({
    data: {
      name,
      gitRepoURL,
      sumDomain: generateSlug(),
    },
  });

  return res.json({
    status: "success",
    data: {
      project,
    },
  });
});

app.post("/deploy", async (req, res) => {
  const { projectId } = req.body;

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });

  if (!project) return res.status(404).json({ error: "Project not found" });

  const deployment = await prisma.deployment.create({
    data: {
      project: { connect: { id: projectId } },
      status: "QUEUED",
    },
  });

  const command = new RunTaskCommand({
    cluster: config.CLUSTER,
    taskDefinition: config.TASK,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: config.SUBNET,
        assignPublicIp: "ENABLED",
        securityGroups: [process.env.SECURITY_GROUP],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "builder-image",
          environment: [
            { name: "GIT_REPO_URL", value: project.gitRepoURL },
            { name: "PROJECT_ID", value: projectId },
            { name: "DEPLOYMENT_ID", value: deployment.id },
          ],
        },
      ],
    },
  });

  await ecsClient.send(command);

  return res.json({
    status: "queued",
    data: {
      project_id: projectId,
      deployment_id: deployment.id,
      subdomain: project.subdomain,
    },
  });
});

app.get("/logs/:id", async (req, res) => {
  // deploymet id
  const { id } = req.params;

  // clickhouse client
  const logs = await client.query({
    query: `SELECT event_id, deployment_id, log, timestamp from log_events where deployment_id = {deployment_id:String}`,
    query_params: {
      deployment_id: id,
    },
    format: "JSONEachRow",
  });

  const rawLogs = await logs.json();

  return res.json({ logs: rawLogs });
});

app.get("/analytics/:projectId", async (req, res) => {
  const { projectId } = req.params;

  try {
    const analytics = await prisma.analytics.findMany({
      where: { projectId },
    });

    if (!analytics.length)
      return res.status(404).json({ error: "No analytics found" });

    const result = {
      totalRequests: analytics.length,
      requestsByPath: {},
      requestsByMethod: {},
      userAgents: {},
      ipAddresses: {},
    };

    for (const entry of analytics) {
      // path  count
      result.requestsByPath[entry.path] =
        (result.requestsByPath[entry.path] || 0) + 1;

      // method count
      result.requestsByMethod[entry.method] =
        (result.requestsByMethod[entry.method] || 0) + 1;

      // user agent count
      if (entry.userAgent)
        result.userAgents[entry.userAgent] =
          (result.userAgents[entry.userAgent] || 0) + 1;

      // ip count
      if (entry.ip)
        result.ipAddresses[entry.ip] = (result.ipAddresses[entry.ip] || 0) + 1;
    }

    return res.json({ analytics: result });
  } catch (error) {
    console.error("Analytics error:", error);
    return res.status(500).json({ error: "Failed to process analytics" });
  }
});

// middleware 
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword },
    });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    res.json({ token });
  } catch (error) {
    res.status(400).json({ error: "User already exists" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
  res.json({ token });
});

app.get("/projects", authenticate, async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.user.userId },
  });
  res.json({ projects });
});

app.get("/deployments/:projectId", authenticate, async (req, res) => {
  const deployments = await prisma.deployment.findMany({
    where: { projectId: req.params.projectId },
  });
  res.json({ deployments });
});

// kafka consumer
async function initKafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: ["build-log"], fromBeginning: true });

  await consumer.run({
    autoCommit: false,
    eachBatch: async function ({
      batch,
      resolveOffset,
      heartbeat,
      commitOffsetsIfNecessary,
    }) {
      const messages = batch.messages;
      console.log(`Received ${messages.length} messages`);

      for (const message of messages) {
        const messageString = message.value.toString();

        const { PROJECT_ID, DEPLOYMENT_ID, log } = JSON.parse(messageString);

        try {
          // insert log into ClickHouse
          const { query_id } = await client.insert({
            table: "log_events",
            values: [{ event_id: uuid(), deployment_id: DEPLOYMENT_ID, log }],
            format: "JSONEachRow",
          });

          resolveOffset(message.offset);
          await commitOffsetsIfNecessary(message.offset);
          await heartbeat();
        } catch (error) {
          console.log("Error parsing message:", error);
        }
      }
    },
  });
}
initKafkaConsumer();

app.listen(9000, () => console.log("API server started."));
