export interface LookupResult {
  identifier: string;
  casNumber: string;
  chemicalName: string;
  smiles: string;
  molecularFormula: string;
  structureImageUrl: string;
  status: "success" | "failed";
  error?: string;
}

export interface LookupRequest {
  identifiers: string[];
}

export interface LookupResponse {
  results: LookupResult[];
}
