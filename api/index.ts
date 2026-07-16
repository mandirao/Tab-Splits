import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server/app";

// Built once per lambda instance and reused across invocations.
const appPromise = createApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const { app } = await appPromise;
  app(req as any, res as any);
}
