import { Request, Response } from "express";
import axios from "axios";
import { type VirusTotalResponse, virusTotalSchema } from "../types";
import { VIRUS_TOTAL_API_KEY, VIRUS_TOTAL_API_URL } from "../config";
import { classifyThreat } from "../utils";

if (!VIRUS_TOTAL_API_KEY || !VIRUS_TOTAL_API_URL)
  throw new Error(
    "VIRUS_TOTAL_API_KEY is not set in the environment variables"
  );

export async function checkUrlWithVirusTotal(
  req: Request,
  res: Response
): Promise<void> {
  const parsed = virusTotalSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid request body",
      error: parsed.error.errors,
    });
    return;
  }

  const { url } = parsed.data;

  try {
    const urlEncoded = Buffer.from(url).toString("base64url");

    const response = await axios.get(`${VIRUS_TOTAL_API_URL}/${urlEncoded}`, {
      headers: {
        "x-apikey": VIRUS_TOTAL_API_KEY,
      },
    });

    const data = response.data.data;
    const stats = data.attributes.last_analysis_stats;
    const results = data.attributes.last_analysis_results;

    const detectedMalicious = Object.values(results).filter(
      (result: any) => result.category === "malicious"
    ).length;

    const total = Object.keys(results).length;
    const score = (detectedMalicious / total) * 100;

    const result: VirusTotalResponse = {
      url: data.attributes.url,
      source: "VirusTotal",
      total_engines: total,
      detected_malicious: detectedMalicious,
      confidence_score: score,
      verdict: classifyThreat(detectedMalicious, total),
    };

    res.status(200).json(result);
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        message: "Error fetching data from VirusTotal",
        error: error.response?.data || error.message,
      });
    } else {
      res.status(500).json({
        message: "Internal server error",
        error: (error as Error).message,
      });
    }
  }
}
