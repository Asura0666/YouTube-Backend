import { Router } from "express";
import { verifyJwtToken } from "../middlewares/auth.middlewares.js"
import { toggleSubscription } from "../controllers/subscription.controller.js";

const router = Router()
router.use(verifyJwtToken)

router.route('/c/:channelId').post(toggleSubscription)

export default router

