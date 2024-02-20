import { Router } from "express";
import { verifyJwtToken } from "../middlewares/auth.middlewares.js";
import { createTweet, deleteTweet, getUsertweets, updateTweet } from "../controllers/tweet.controller.js";

const router = Router();
router.use(verifyJwtToken);

router.route("/").post(createTweet);
router.route('/user/:userId').get(getUsertweets)
router.route('/t/:tweetId').patch(updateTweet).delete(deleteTweet)

export default router;
