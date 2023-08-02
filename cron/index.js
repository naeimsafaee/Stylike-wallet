const CronJob = require("cron").CronJob;
const config = require("config");
const swap = require("./swap");
const notification = require("./notification");

const defaultTime = "* * * * * *";

const swapTransactionHandler = new CronJob(
    config.get("cron.swap_transaction_handler.executionـtime") || defaultTime,
    async () => swap.swapTransactionHandler(),
);

const zeroBalanceNotification = new CronJob(
    config.get("cron.zero_balance_notification.executionـtime") || defaultTime,
    async () => notification.zeroBalanceNotification(),
);

swapTransactionHandler.start();
zeroBalanceNotification.start();
