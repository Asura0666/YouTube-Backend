import { Router } from "express";
import { verifyJwtToken } from "../middlewares/auth.middlewares.js";
import { createTweet } from "../controllers/tweet.controller.js";

const router = Router();
router.use(verifyJwtToken);

router.route("/").post(createTweet);

export default router;
