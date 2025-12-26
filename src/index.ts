import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import * as fs from "fs";
import * as path from "path";

const PUBCHEM_BASE_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const CONCURRENCY_LIMIT = 5; // Number of parallel requests

interface ChemicalData {
  chemical_name: string;
  smiles_code: string;
  molecular_formula: string;
  structure_image_url: string;
}

interface OutputRow {
  cas_number: string;
  chemical_name: string;
  smiles_code: string;
  molecular_formula: string;
  structure_image_url: string;
  status: string;
  error?: string;
}

interface PubChemCompoundResponse {
  PC_Compounds: Array<{
    id: { id: { cid: number } };
    props: Array<{
      urn: { label: string; name?: string };
      value: { sval?: string; ival?: number };
    }>;
  }>;
}

interface PubChemPropertyResponse {
  PropertyTable: {
    Properties: Array<{
      CID: number;
      IUPACName?: string;
      Title?: string;
      MolecularFormula?: string;
      CanonicalSMILES?: string;
      ConnectivitySMILES?: string;
    }>;
  };
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

    // PubChem rate limiting - wait and retry
    if (response.status === 503 || response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
      continue;
    }

    // Not found or other error - don't retry
    if (response.status === 404) {
      throw new Error(`Compound not found in PubChem`);
    }

    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  throw new Error("Max retries exceeded");
}

async function getCompoundByCas(
  casNumber: string
): Promise<{ data: ChemicalData | null; error: string | null }> {
  try {
    // Step 1: Search for compound by CAS number to get CID
    const searchUrl = `${PUBCHEM_BASE_URL}/compound/name/${encodeURIComponent(casNumber)}/cids/JSON`;
    const searchResponse = await fetchWithRetry(searchUrl);
    const searchData = (await searchResponse.json()) as {
      IdentifierList: { CID: number[] };
    };

    const cid = searchData.IdentifierList?.CID?.[0];
    if (!cid) {
      return { data: null, error: "No compound found for this CAS number" };
    }

    // Step 2: Get compound properties
    const propsUrl = `${PUBCHEM_BASE_URL}/compound/cid/${cid}/property/IUPACName,Title,MolecularFormula,CanonicalSMILES/JSON`;
    const propsResponse = await fetchWithRetry(propsUrl);
    const propsData = (await propsResponse.json()) as PubChemPropertyResponse;

    const props = propsData.PropertyTable?.Properties?.[0];
    if (!props) {
      return { data: null, error: "Could not retrieve compound properties" };
    }

    // Structure image URL wrapped in Google Sheets IMAGE function
    const structureImageUrl = `=IMAGE("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG")`;

    return {
      data: {
        chemical_name: props.Title || props.IUPACName || "",
        smiles_code: props.CanonicalSMILES || props.ConnectivitySMILES || "",
        molecular_formula: props.MolecularFormula || "",
        structure_image_url: structureImageUrl,
      },
      error: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { data: null, error: errorMessage };
  }
}

function readCasNumbersFromCsv(inputPath: string): string[] {
  const fileContent = fs.readFileSync(inputPath, "utf-8");
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const casNumbers: string[] = [];
  for (const record of records) {
    const casNumber =
      record.cas_number || record.CAS || record.cas || record["CAS Number"];
    if (casNumber) {
      casNumbers.push(casNumber.trim());
    }
  }

  return casNumbers;
}

function writeResultsToCsv(results: OutputRow[], outputPath: string): void {
  const csvContent = stringify(results, {
    header: true,
    columns: [
      "cas_number",
      "chemical_name",
      "smiles_code",
      "molecular_formula",
      "structure_image_url",
      "status",
      "error",
    ],
  });

  fs.writeFileSync(outputPath, csvContent);
  console.log(`Results written to: ${outputPath}`);
}

async function processInParallel<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await processor(items[index], index);
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

async function processChemicals(
  inputPath: string,
  outputPath: string
): Promise<void> {
  console.log(`Reading CAS numbers from: ${inputPath}`);
  const casNumbers = readCasNumbersFromCsv(inputPath);
  console.log(`Found ${casNumbers.length} CAS numbers to process`);
  console.log(`Processing with ${CONCURRENCY_LIMIT} parallel requests...\n`);

  const startTime = Date.now();

  const results = await processInParallel(
    casNumbers,
    async (casNumber, index) => {
      console.log(
        `Processing ${index + 1}/${casNumbers.length}: ${casNumber}`
      );

      const { data, error } = await getCompoundByCas(casNumber);

      if (data) {
        return {
          cas_number: casNumber,
          chemical_name: data.chemical_name,
          smiles_code: data.smiles_code,
          molecular_formula: data.molecular_formula,
          structure_image_url: data.structure_image_url,
          status: "success",
        } as OutputRow;
      } else {
        return {
          cas_number: casNumber,
          chemical_name: "",
          smiles_code: "",
          molecular_formula: "",
          structure_image_url: "",
          status: "failed",
          error: error || "Unknown error",
        } as OutputRow;
      }
    },
    CONCURRENCY_LIMIT
  );

  writeResultsToCsv(results, outputPath);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const successCount = results.filter((r) => r.status === "success").length;
  console.log(
    `\nCompleted: ${successCount}/${casNumbers.length} compounds processed successfully`
  );
  console.log(`Time elapsed: ${elapsed}s`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log("Usage: npm run dev <input.csv> [output.csv]");
    console.log("\nInput CSV should have a column named one of:");
    console.log("  - cas_number");
    console.log("  - CAS");
    console.log("  - cas");
    console.log('  - "CAS Number"');
    console.log("\nExample:");
    console.log("  npm run dev compounds.csv results.csv");
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = args[1]
    ? path.resolve(args[1])
    : inputPath.replace(/\.csv$/i, "_results.csv");

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  await processChemicals(inputPath, outputPath);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
