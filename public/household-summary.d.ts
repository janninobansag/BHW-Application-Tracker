import type { HouseholdProfile } from "../backend/src/household-profile";

export type HouseholdSummaryRow = { label: string; value: number };
export type FamilyPlanningRow = HouseholdSummaryRow & { groups: number[] };
export const summarySectionGroups: Array<{ title: string; indices: number[] }>;
export type HouseholdSummaryResult = {
  households: number;
  members: number;
  asOf: string;
  sections: Array<{ title: string; items: HouseholdSummaryRow[]; total: number }>;
  familyPlanning: FamilyPlanningRow[];
  familyPlanningTotal: number;
};

export function buildHouseholdSummary(profiles: HouseholdProfile[], options?: {
  barangayId?: string;
  purokId?: string;
  sitioId?: string;
  year?: string;
  quarter?: string;
  today?: string;
}): HouseholdSummaryResult;
