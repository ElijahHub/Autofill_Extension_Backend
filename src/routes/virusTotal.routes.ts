import { Router } from "express";
import { checkUrlWithVirusTotal } from "../controllers/virusTotal.controller";

const router = Router();

router.post("/check", checkUrlWithVirusTotal);

export default router;
