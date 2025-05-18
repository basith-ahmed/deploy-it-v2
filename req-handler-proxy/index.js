import express from "express";
import httpProxy from "http-proxy";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE_PATH = process.env.BASE_PATH;

const app = express();
const proxy = httpProxy.createProxy();

app.use((req, res) => {
  const hostname = req.hostname;
  const subdomain = hostname.split(".")[0];

  const project = prisma.project.findFirst({
    where: {
      OR: [
        {
          subdomain: subdomain,
        },
        {
          customDomain: subdomain,
        },
      ],
    },
  });

  if (!project) {
    return res.status(404).send("Page not found");
  }

  const { id } = project;

  const resolvePath = `${BASE_PATH}/${id}`;

  return proxy.web(
    req,
    res,
    { target: resolvePath, changeOrigin: true },
    (err) => {
      console.error(err);
      res.status(500).send("Proxy error");
    }
  );
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  const url = req.url;
  if (url === "/") {
    proxyReq.path += "index.html";
  }
  return proxyReq;
});

app.listen(8000, () => console.log("Proxy server started."));
