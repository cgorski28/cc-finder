import { LookupResult } from "./types";

const PUBCHEM_BASE_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const CONCURRENCY_LIMIT = 5;
const CAS_REGEX = /^\d{2,7}-\d{2}-\d$/;

function isCasNumber(input: string): boolean {
  return CAS_REGEX.test(input.trim());
}

async function fetchWithRetry(
  url: string,
  retries = 3,
  delay = 1000
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);

    if (response.ok) {
      return response;
    }

    if (response.status === 503 || response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
      continue;
    }

    if (response.status === 404) {
      throw new Error("Compound not found in PubChem");
    }

    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  throw new Error("Max retries exceeded");
}

async function getCasFromSynonyms(cid: number): Promise<string> {
  try {
    const url = `${PUBCHEM_BASE_URL}/compound/cid/${cid}/synonyms/JSON`;
    const response = await fetchWithRetry(url);
    const data = (await response.json()) as {
      InformationList: {
        Information: Array<{ Synonym: string[] }>;
      };
    };

    const synonyms = data.InformationList?.Information?.[0]?.Synonym ?? [];
    const cas = synonyms.find((s) => CAS_REGEX.test(s));
    return cas ?? "";
  } catch {
    return "";
  }
}

export async function lookupCompound(
  identifier: string
): Promise<LookupResult> {
  const trimmed = identifier.trim();

  try {
    // Step 1: Resolve identifier to CID
    const searchUrl = `${PUBCHEM_BASE_URL}/compound/name/${encodeURIComponent(trimmed)}/cids/JSON`;
    const searchResponse = await fetchWithRetry(searchUrl);
    const searchData = (await searchResponse.json()) as {
      IdentifierList: { CID: number[] };
    };

    const cid = searchData.IdentifierList?.CID?.[0];
    if (!cid) {
      return {
        identifier: trimmed,
        casNumber: "",
        chemicalName: "",
        smiles: "",
        molecularFormula: "",
        structureImageUrl: "",
        status: "failed",
        error: "No compound found for this identifier",
      };
    }

    // Step 2: Get compound properties
    const propsUrl = `${PUBCHEM_BASE_URL}/compound/cid/${cid}/property/IUPACName,Title,MolecularFormula,CanonicalSMILES,IsomericSMILES/JSON`;
    const propsResponse = await fetchWithRetry(propsUrl);
    const propsData = (await propsResponse.json()) as {
      PropertyTable: {
        Properties: Array<{
          CID: number;
          IUPACName?: string;
          Title?: string;
          MolecularFormula?: string;
          CanonicalSMILES?: string;
          IsomericSMILES?: string;
          ConnectivitySMILES?: string;
        }>;
      };
    };

    const props = propsData.PropertyTable?.Properties?.[0];
    if (!props) {
      return {
        identifier: trimmed,
        casNumber: "",
        chemicalName: "",
        smiles: "",
        molecularFormula: "",
        structureImageUrl: "",
        status: "failed",
        error: "Could not retrieve compound properties",
      };
    }

    // Step 3: Determine CAS number
    const casNumber = isCasNumber(trimmed)
      ? trimmed
      : await getCasFromSynonyms(cid);

    return {
      identifier: trimmed,
      casNumber,
      chemicalName: props.Title || props.IUPACName || "",
      smiles: props.CanonicalSMILES || props.IsomericSMILES || props.ConnectivitySMILES || "",
      molecularFormula: props.MolecularFormula || "",
      structureImageUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG`,
      status: "success",
    };
  } catch (error) {
    return {
      identifier: trimmed,
      casNumber: "",
      chemicalName: "",
      smiles: "",
      molecularFormula: "",
      structureImageUrl: "",
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = CONCURRENCY_LIMIT
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await processor(items[index]);
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}
