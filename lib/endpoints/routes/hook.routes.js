const router = require("express").Router();
const { webHookController } = require('./../controllers');

router
  .route('/incoming')
  .post(
    webHookController.incoming
  );

router
  .route('/outgoing')
  .post(
    webHookController.outgoing
  );

module.exports = router;
