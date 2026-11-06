// The secrets are listed in wrangler.jsonc (`secrets.required`). DEV_LOGIN is
// local only (.dev.vars) and never set in production, so it is declared here.
interface Env {
  DEV_LOGIN?: string;
}
