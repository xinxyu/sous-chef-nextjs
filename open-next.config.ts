import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every route is dynamic (auth, DB, scraping), so no incremental cache is needed.
export default defineCloudflareConfig({});
