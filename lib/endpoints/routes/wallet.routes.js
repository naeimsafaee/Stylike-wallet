const router = require("express").Router();
const { walletController, swapController } = require("./../controllers");
const { inputValidator, authMiddleware } = require("./../../middlewares");
const { walletValidation, swapValidation } = require("./../validations");

router.route("/config").get(authMiddleware, walletController.config);

router
  .route("/address")
  .get(
    authMiddleware,
    inputValidator(walletValidation.getAddress),
    walletController.getAddress
  );

router
  .route("/withdraw")
  .post(
    authMiddleware,
    inputValidator(walletValidation.postWithdraw),
    walletController.postWithraw
  );

router
  .route("/swap")
  .post(
    authMiddleware,
    inputValidator(swapValidation.swap),
    swapController.swap
  );

router
  .route("/swap/price")
  .post(
    authMiddleware,
    inputValidator(swapValidation.swapPrice),
    swapController.price
  );

router
  .route("/nft/:id?")
  // .post(authMiddleware, walletController.createNft)
  .put(authMiddleware, walletController.transferNft);
// .get(authMiddleware, walletController.getNft)
// .delete(authMiddleware, walletController.burnNft);

router
  .route("/token/:id?")
  .post(authMiddleware, walletController.mintToken)
  .delete(authMiddleware, walletController.burnToken);

router.route("/").get(authMiddleware, walletController.read);

module.exports = router;
