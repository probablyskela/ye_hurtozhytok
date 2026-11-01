import { createRequestHandler } from "react-router";

import { SECURITY_HEADERS, newNonce } from "../app/lib/csp";
import { runEveryMinute } from "../app/lib/scheduled.server";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    /** For the Content Security Policy of HTML pages (entry.server.tsx). */
    nonce: string;
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const response = await requestHandler(request, {
      cloudflare: { env, ctx },
      nonce: newNonce(),
    });
    // A copy, because some responses come with read-only headers.
    const secured = new Response(response.body, response);
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      if (!secured.headers.has(name)) secured.headers.set(name, value);
    return secured;
  },
  scheduled(controller, env, ctx) {
    ctx.waitUntil(runEveryMinute(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
