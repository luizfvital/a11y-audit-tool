import express from "express";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const openApiPath = path.join(repoRoot, "openapi.yaml");

const app = express();
const port = Number(process.env.PORT || 3000);

const openApiDocument = YAML.parse(readFileSync(openApiPath, "utf8"));

app.get("/health", (_request, response) => {
  response.json({
    status: "ok"
  });
});

app.get("/openapi.yaml", (_request, response) => {
  response.type("application/yaml").send(readFileSync(openApiPath, "utf8"));
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, {
  explorer: true
}));

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Health endpoint available at http://localhost:${port}/health`);
  console.log(`Swagger UI available at http://localhost:${port}/docs`);
});

