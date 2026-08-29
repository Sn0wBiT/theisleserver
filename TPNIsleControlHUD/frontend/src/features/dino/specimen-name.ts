export function specimenName(species: string) {
  const classPath = species.trim().replace(/^(?:BlueprintGeneratedClass|Class)\s+/i, "").replace(/["']/g, "");
  const assetName = classPath.split("/").at(-1)?.split(".")[0] ?? classPath;
  const name = assetName
    .replace(/^BP_?/i, "")
    .replace(/(?:Character|Dinosaur|Pawn)(?:_BP)?(?:_C)?$/i, "")
    .replace(/_C$/i, "")
    .replace(/_/g, " ")
    .trim();
  return name || "Unknown specimen";
}
