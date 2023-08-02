const { Telegraf } = require("telegraf");
const config = require("config");

const bot = new Telegraf(config.get("telegram.bot_token"));

const sendMessage = async (message) => {
    config.get("telegram.channels").forEach(async (channel) => {
        await bot.telegram.sendMessage(channel, message);
    });
}

module.exports = {
    sendMessage
}