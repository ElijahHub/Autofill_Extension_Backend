import { Request, Response } from "express";
import {
  detectHiddenFormsWithJSDOM,
  detectHiddenFormsWithPuppeteer,
} from "../services/scanPage.service";
import { scanSchema } from "../types";

export async function scanPageHandler(req: Request, res: Response) {
  const parsed = scanSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid request body",
      error: parsed.error.errors,
    });
    return;
  }

  const { url, level } = parsed.data;

  try {
    let result;

    switch (level) {
      case "simple":
        result = await detectHiddenFormsWithJSDOM(url);
        break;
      case "advanced":
        result = await detectHiddenFormsWithPuppeteer(url, true);
        break;
      default:
        res.status(400).json({ error: "Invalid scan level" });
    }

    res.json({ scanLevel: level, ...result });
  } catch (error: any) {
    res.status(500).json({ error: "Scan failed", details: error.message });
  }
}
