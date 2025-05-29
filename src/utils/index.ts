export const classifyThreat = (
  maliciousCount: number,
  totalEngines: number
) => {
  const maliciousRatio = maliciousCount / totalEngines;

  if (maliciousCount === 0) return "clean";
  if (maliciousRatio > 0.05) return "malicious"; // >5% of engines flagged it
  return "suspicious";
};

export function classifyThreats(
  matches: any[]
): "malicious" | "suspicious" | "clean" {
  if (!matches || matches.length === 0) return "clean";

  const knownMalicious = matches.filter((match) =>
    ["MALWARE", "SOCIAL_ENGINEERING"].includes(match.threatType)
  );

  if (knownMalicious.length > 0) return "malicious";

  return "suspicious";
}
