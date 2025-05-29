import express from "express";
import rateLimit from "express-rate-limit";
import { PORT } from "./config";
import virusTotalRoutes from "./routes/virusTotal.routes";
import googleSafeRoutes from "./routes/googleSafe.routes";

const app = express();
app.use(express.json());

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});

app.use("/api", limiter);

app.use("/api/virustotal", virusTotalRoutes);

app.use("/api/google-safe", googleSafeRoutes);

// Health check endpoint
app.get("/health-check", (req, res) => {
  res.send("ok");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
