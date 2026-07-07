import { getDatabaseInfraConfig } from "../../config";

export function isDualWriteEnabled(): boolean {
  return getDatabaseInfraConfig().dualWriteEnabled;
}

export function getReadSource(): "postgres" {
  return "postgres";
}
