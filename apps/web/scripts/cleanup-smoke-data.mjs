import { cleanupSmokeData } from "./smoke-artifacts.mjs";

cleanupSmokeData()
  .then((summary) => {
    console.log(JSON.stringify(summary));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
