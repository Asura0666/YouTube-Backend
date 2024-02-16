import { Router } from "express";
import { verifyJwtToken } from "../middlewares/auth.middlewares.js";
import { upload } from "../middlewares/multer.middlewares.js";
import {
  getAllVideos,
  getVideoById,
  togglePublishStatus,
  updateVideo,
  uploadVideo,
} from "../controllers/video.controller.js";

const router = Router();

router.use(verifyJwtToken);

router
  .route("/")
  .get(getAllVideos)
  .post(
    upload.fields([
      {
        name: "videoFile",
        maxCount: 1,
      },
      {
        name: "thumbnailFile",
        maxCount: 1,
      },
    ]),
    uploadVideo
  );

router
  .route("/:videoId")
  .get(getVideoById)
  .patch(
    upload.fields([
      {
        name: "thumbnailFile",
        maxCount: 1,
      },
    ]),
    updateVideo
  );

router.route('/toggle/publish/:videoId').patch(togglePublishStatus)

export default router;
