import express from "express";
import { PORT } from "./config";
import virusTotalRoutes from "./routes/virusTotal.routes";

const app = express();
app.use(express.json());

app.use("/api/virustotal", virusTotalRoutes);

app.get("/health-check", (req, res) => {
  res.send("ok");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
