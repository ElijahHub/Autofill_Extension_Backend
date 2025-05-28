export const classifyThreat = (
  maliciousCount: number,
  totalEngines: number
) => {
  const maliciousRatio = maliciousCount / totalEngines;

  if (maliciousCount === 0) return "clean";
  if (maliciousRatio > 0.05) return "malicious"; // >5% of engines flagged it
  return "suspicious";
};
