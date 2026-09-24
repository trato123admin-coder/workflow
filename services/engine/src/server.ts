import { buildApp } from './app.js';
import { getEngineEnv } from './config/env.js';

async function main() {
  const env = getEngineEnv();
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Engine server listening on ${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
