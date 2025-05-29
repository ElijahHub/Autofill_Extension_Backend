import { Router } from "express";
import { checkUrlWithGSB } from "../controllers/googleSafe.controller";

const router = Router();

router.post("/check", checkUrlWithGSB);

export default router;
