import {
  copilotKitEndpoint,
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
  EmptyAdapter,
} from "@copilotkit/runtime";
import { NextRequest } from "next/server";

const serviceAdapter = new EmptyAdapter();

const remoteEndpoint = copilotKitEndpoint({
  url: "http://localhost:8000/copilotkit",
});

const runtime = new CopilotRuntime({
  remoteEndpoints: [remoteEndpoint],
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
