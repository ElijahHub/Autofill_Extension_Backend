import { Router } from "express";
import { scanPageHandler } from "../controllers/scanPage.controller";

const router = Router();

router.post("/scan", scanPageHandler);

export default router;
