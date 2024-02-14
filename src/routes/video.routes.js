import { Router } from "express";
import { verifyJwtToken } from "../middlewares/auth.middlewares.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { uploadVideo } from "../controllers/video.controller.js";

const router  = Router()

router.use(verifyJwtToken)

router.route('/').post(upload.fields([
  {
    name: 'videoFile',
    maxCount: 1
  },
  {
    name: 'thumbnailFile',
    maxCount: 1
  }
]), uploadVideo)

export default router