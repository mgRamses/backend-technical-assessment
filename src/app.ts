import express, { type ErrorRequestHandler, type Express, type Request, type Response } from "express";

import { createInquiryHandler, type InquiryDependencies } from "./routes/inquiry.js";

export interface AppOptions {
  inquiryDependencies?: InquiryDependencies;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_request: Request, response: Response) => {
    response.status(200).json({ status: "ok" });
  });

  if (options.inquiryDependencies) {
    app.post("/secure-inquiry", createInquiryHandler(options.inquiryDependencies));
  }

  const invalidJsonHandler: ErrorRequestHandler = (_error, _request, response, _next) => {
    response.status(400).json({ error: "Invalid request payload" });
  };
  app.use(invalidJsonHandler);

  return app;
}
