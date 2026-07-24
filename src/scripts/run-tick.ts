import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { runTick } from "../lib/tick";

async function main() {
  const result = await runTick();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
