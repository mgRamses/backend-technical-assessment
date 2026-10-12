import express, { type Express, type Request, type Response } from "express";

export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_request: Request, response: Response) => {
    response.status(200).json({ status: "ok" });
  });

  return app;
}
