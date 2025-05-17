import express from "express";
import httpProxy from "http-proxy";

const BASE_PATH = process.env.BASE_PATH;

const app = express();
const proxy = httpProxy.createProxy();

app.use((req, res) => {
  const hostname = req.hostname;
  const subdomain = hostname.split(".")[0];

  // TODO: Custom domain logic

  const resolvePath = `${BASE_PATH}/${subdomain}`;

  return proxy.web(req, res, { target: resolvePath, changeOrigin: true }, (err) => {
      console.error(err);
      res.status(500).send("Proxy error");
  });
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  const url = req.url;
  if (url === "/") {
    proxyReq.path += "index.html";
  }
  return proxyReq
});

app.listen(8000, () => console.log("Proxy server started."));
