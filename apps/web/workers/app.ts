import { createRequestHandler } from "react-router";

import { runEveryMinute } from "../app/lib/scheduled.server";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  fetch(request, env, ctx) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
  scheduled(controller, env, ctx) {
    ctx.waitUntil(runEveryMinute(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
