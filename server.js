require("dotenv").config();
require("./cron");

const {
  postgres: { sequelize },
} = require("./lib/databases");
const config = require("config");
const serverConfig = config.get("server");
const { addressService } = require("./lib/services");

console.log(`*** SERVER Info: ENVIRONMENT: ${process.env.NODE_ENV}`);
console.log(`*** SERVER Info: Please wait; Starting...`);

let server;

sequelize
  .sync(config.get("databases.postgres.sync"))
  .then(async () => {
    console.log(`*** POSTGRES Info: Tables are synced!`);

    await require("./lib/databases/postgres/init")();

    server = require("./lib/app").listen(serverConfig.port, async () => {
      console.log(
        `*** SERVER Info: Server is running on port ${serverConfig.port}...`
      );

      setInterval(require("./lib/services").addressService.newCollect, 60000);

      await addressService.subscribe();
    });
  })
  .catch((e) => {
    console.log(e);
    throw e;
  });
