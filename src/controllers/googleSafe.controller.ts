import { Request, Response } from "express";
import axios from "axios";
import { virusTotalSchema } from "../types";
import { classifyThreats } from "../utils";
import { GSB_API_KEY, GSB_API_URL } from "../config";

if (!GSB_API_KEY || !GSB_API_URL)
  throw new Error("GSB_API_KEY is not set in the environment variables");

const apiUrl = `${GSB_API_URL}/threatMatches:find?key=${GSB_API_KEY}`;

export async function checkUrlWithGSB(req: Request, res: Response) {
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
    const response = await axios.post(apiUrl, {
      client: {
        clientId: "autofill-extension",
        clientVersion: "1.0",
      },
      threatInfo: {
        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url }],
      },
    });

    const matches = response.data.matches ?? [];

    res.status(200).json({
      status: classifyThreats(matches),
      threats: matches,
    });
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        message: "Error checking URL with Google Safe Browsing",
        error: error.response?.data || error.message,
      });
    } else {
      res.status(500).json({
        message: "Internal server error",
        error: error.message,
      });
    }
  }
}
