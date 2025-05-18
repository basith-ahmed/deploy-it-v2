import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import express from "express";
import { generateSlug } from "random-word-slugs";
import Redis from "ioredis";
import { Server } from "socket.io";
import cors from "cors";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

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

const prisma = new PrismaClient();

const subscriber = new Redis(process.env.REDIS_URL);

const io = new Server({ cors: "*" });
io.on("connection", (socket) => {
  socket.on("subscribe", (channel) => {
    // channel = build-log:projectSlug
    socket.join(channel);
    socket.emit("message", `Subscribed to ${channel}`);
  });
});
io.listen(9001, () => console.log("Socket server started."));

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
      project_id: projectSlug,
      url: `http://${projectSlug}.locaolhost:8000`,
    },
  });
});

async function initRedisSubscribe() {
  console.log("Subscribed to logs...");
  subscriber.psubscribe("build-log:*");
  subscriber.on("pmessage", (pattern, channel, message) => {
    io.to(channel).emit("message", message);
  });
}
initRedisSubscribe();

app.listen(9000, () => console.log("API server started."));
