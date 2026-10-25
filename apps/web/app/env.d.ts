// Secrets come from .dev.vars locally and `wrangler secret put` in production.
// Declared here so type checks pass even where .dev.vars does not exist (CI).
declare namespace Cloudflare {
  interface Env {
    SESSION_SECRET: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    VAPID_PRIVATE_KEY?: string;
    DEV_LOGIN?: string;
  }
}
