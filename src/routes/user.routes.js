import { Router } from "express";
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJwtToken } from "../middlewares/auth.middlewares.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

// secured Routes
router.route("/logout").post(verifyJwtToken, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJwtToken, changeCurrentPassword);
router.route("/current-user").get(verifyJwtToken, getCurrentUser);

router.route("/update-account").patch(verifyJwtToken, updateAccountDetails);
router
  .route("/update-avatar")
  .patch(
    upload.fields([{ name: "avatar", maxCount: 1 }]),
    verifyJwtToken,
    updateUserAvatar
  );
router
  .route("/update-coverImage")
  .patch(
    upload.fields([{ name: "coverImage", maxCount: 1 }]),
    verifyJwtToken,
    updateUserCoverImage
  );

export default router;
