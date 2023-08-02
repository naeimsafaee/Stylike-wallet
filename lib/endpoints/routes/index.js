const router = require("express").Router();

module.exports = (app) => {
  router.use("/hook", require("./hook.routes"));
  router.use("/wallet", require("./wallet.routes"));

  app.use("/api/v1", router);
};
