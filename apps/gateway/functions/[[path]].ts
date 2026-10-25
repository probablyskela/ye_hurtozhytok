interface Env {
  APP: { fetch(request: Request): Promise<Response> };
}

/** Forwards every request to the app Worker unchanged. */
export const onRequest = ({ request, env }: { request: Request; env: Env }) =>
  env.APP.fetch(request);
