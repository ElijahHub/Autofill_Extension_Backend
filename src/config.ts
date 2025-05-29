import dotenv from "dotenv";

dotenv.config();

export const VIRUS_TOTAL_API_KEY = process.env.VT_API_KEY;

export const VIRUS_TOTAL_API_URL = "https://www.virustotal.com/api/v3/urls";

export const GSB_API_KEY = process.env.GSB_API_KEY;

export const GSB_API_URL = `https://safebrowsing.googleapis.com/v4`;

export const PORT = process.env.PORT || 9500;
