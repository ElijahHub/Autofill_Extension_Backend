import { z } from "zod";

export const urlSchema = z.object({
  url: z.string().url("Invalid URL format"),
});

export type VirusTotalCheckInput = z.infer<typeof urlSchema>;

export const scanSchema = z.object({
  url: z.string().url("Invalid URL format"),
  level: z.string(),
});

export type ScanType = z.infer<typeof scanSchema>;
export interface VirusTotalResponse {
  url: string;
  source: "VirusTotal";
  total_engines: number;
  detected_malicious: number;
  confidence_score: number;
  verdict: "clean" | "malicious" | "suspicious";
}

export interface FieldDetail {
  name: string | null;
  type: string;
  reason: string;
  location?: string;
  selector?: string;
  boundingBox?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface HiddenField {
  name: string | null;
  type: string;
  reason: string;
  location: string;
  selector: string;
}
