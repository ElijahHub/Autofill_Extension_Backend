import { z } from "zod";

export const virusTotalSchema = z.object({
  url: z.string().url("Invalid URL format"),
});

export type VirusTotalCheckInput = z.infer<typeof virusTotalSchema>;

export interface VirusTotalResponse {
  url: string;
  source: "VirusTotal";
  total_engines: number;
  detected_malicious: number;
  confidence_score: number;
  verdict: "clean" | "malicious" | "suspicious";
}
