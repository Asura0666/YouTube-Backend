import { Router } from "express";
import {verifyJwtToken} from '../middlewares/auth.middlewares.js'
import { addComment } from "../controllers/comment.controller.js";

const router = Router()

router.use(verifyJwtToken)

router.route('/:videoId').post(addComment)

export default router