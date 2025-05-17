import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import express from "express";
import { generateSlug } from "random-word-slugs";

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

const app = express();

app.use(express.json());

app.post("/project", async (req, res) => {
  const { githubUrl } = req.body;
  const projectSlug = generateSlug();

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
            { name: "GIT_REPO_URL", value: githubUrl },
            { name: "PROJECT_ID", value: projectSlug },
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

app.listen(9000, () => console.log("API server started."));
