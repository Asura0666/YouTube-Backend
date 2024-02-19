import { Router } from "express";
import { verifyJwtToken } from "../middlewares/auth.middlewares.js";
import {
  addComment,
  deleteComment,
  getVideoComment,
  updateComment,
} from "../controllers/comment.controller.js";

const router = Router();

router.use(verifyJwtToken);

router.route("/:videoId").post(addComment).get(getVideoComment);

router.route("/c/:commentId").delete(deleteComment).patch(updateComment);

export default router;