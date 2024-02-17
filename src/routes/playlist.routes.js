import { Router } from "express";
import { verifyJwtToken } from "../middlewares/auth.middlewares.js";
import {
  addVideoToPlaylist,
  createPlaylist,
  removeVideoFromPlaylist,
  togglePublishStatus,
} from "../controllers/playlist.controller.js";

const router = Router();

router.use(verifyJwtToken);

router.route("/").post(createPlaylist);

router.route("/add/:videoId/:playlistId").patch(addVideoToPlaylist);
router.route("/remove/:videoId/:playlistId").patch(removeVideoFromPlaylist);
router.route("/toggle/publish/:playlistId").patch(togglePublishStatus);

export default router;
