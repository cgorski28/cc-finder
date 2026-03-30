"use client";

import { useState, useCallback, useRef } from "react";
import { LookupResult } from "@/lib/types";

type AppState = "idle" | "preview" | "loading" | "results";

function parseCSVColumn1(text: string): string[] {
  const lines = text.split(/\r?\n/);
  return lines
    .slice(1)
    .map((line) => {
      if (line.startsWith('"')) {
        const endQuote = line.indexOf('"', 1);
        if (endQuote > 0) return line.slice(1, endQuote).trim();
      }
      return line.split(",")[0]?.trim() ?? "";
    })
    .filter((v) => v.length > 0);
}

function exportToCSV(results: LookupResult[]) {
  const headers = [
    "chemical_name",
    "cas_number",
    "smiles",
    "molecular_formula",
    "structure_image_url",
  ];

  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = results
    .filter((r) => r.status === "success")
    .map((r) =>
      [
        r.chemicalName,
        r.casNumber,
        r.smiles,
        r.molecularFormula,
        r.structureImageUrl,
      ]
        .map(escape)
        .join(",")
    );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cc-finder-results.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function copyToClipboard(results: LookupResult[]) {
  const headers = ["Input", "Chemical Name", "CAS Number", "SMILES", "Molecular Formula", "Structure Image URL"];
  const rows = results
    .filter((r) => r.status === "success")
    .map((r) =>
      [r.identifier, r.chemicalName, r.casNumber, r.smiles, r.molecularFormula, r.structureImageUrl].join("\t")
    );
  const text = [headers.join("\t"), ...rows].join("\n");
  navigator.clipboard.writeText(text);
}

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [identifiers, setIdentifiers] = useState<string[]>([]);
  const [results, setResults] = useState<LookupResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSVColumn1(text);
      if (parsed.length === 0) {
        setError(
          "No identifiers found. Make sure your CSV has a header row and data in column 1."
        );
        return;
      }
      setIdentifiers(parsed);
      setState("preview");
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleLookup = async () => {
    setState("loading");
    setError(null);

    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Lookup failed");
      }

      const data = await response.json();
      setResults(data.results);
      setState("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setState("preview");
    }
  };

  const reset = () => {
    setState("idle");
    setIdentifiers([]);
    setResults([]);
    setError(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const successCount = results.filter((r) => r.status === "success").length;

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          CC-Finder
        </h1>
        <p className="mt-2 text-lg text-slate-500">
          Look up chemical compound data from names or CAS numbers
        </p>
      </div>

      {/* Upload Section */}
      {(state === "idle" || state === "preview") && (
        <div className="w-full max-w-2xl">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`
              border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
              transition-colors duration-200
              ${
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
              }
            `}
          >
            <svg
              className="mx-auto h-10 w-10 text-slate-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-slate-600 font-medium">
              {fileName || "Drop a CSV file here, or click to browse"}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              First column should contain chemical names or CAS numbers
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Preview */}
          {state === "preview" && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-600">
                  Found{" "}
                  <span className="font-semibold">{identifiers.length}</span>{" "}
                  identifier{identifiers.length !== 1 && "s"}
                </p>
                <button
                  onClick={reset}
                  className="text-sm text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                <ul className="text-sm text-slate-700 space-y-0.5 font-mono">
                  {identifiers.slice(0, 20).map((id, i) => (
                    <li key={i}>{id}</li>
                  ))}
                  {identifiers.length > 20 && (
                    <li className="text-slate-400">
                      ...and {identifiers.length - 20} more
                    </li>
                  )}
                </ul>
              </div>

              <button
                onClick={handleLookup}
                className="mt-4 w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg
                           hover:bg-blue-700 transition-colors duration-200"
              >
                Look Up Compounds
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {state === "loading" && (
        <div className="text-center py-16">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="mt-4 text-slate-500">
            Looking up {identifiers.length} compound
            {identifiers.length !== 1 && "s"}...
          </p>
        </div>
      )}

      {/* Results */}
      {state === "results" && (
        <div className="w-full max-w-7xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{successCount}</span> of{" "}
                <span className="font-semibold">{results.length}</span> compounds
                found
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100
                           rounded-lg hover:bg-slate-200 transition-colors duration-200"
              >
                New Search
              </button>
              <button
                onClick={() => {
                  copyToClipboard(results);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100
                           rounded-lg hover:bg-slate-200 transition-colors duration-200
                           flex items-center gap-2"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z"
                  />
                </svg>
                {copied ? "Copied!" : "Copy Table"}
              </button>
              <button
                onClick={() => exportToCSV(results)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600
                           rounded-lg hover:bg-blue-700 transition-colors duration-200
                           flex items-center gap-2"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    #
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Input
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Chemical Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    CAS Number
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    SMILES
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Formula
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Structure
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-b border-slate-100 ${
                      r.status === "failed"
                        ? "bg-red-50"
                        : i % 2 === 0
                          ? "bg-white"
                          : "bg-slate-50/50"
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {r.identifier}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.status === "failed" ? (
                        <span className="text-red-500 text-xs">{r.error}</span>
                      ) : (
                        r.chemicalName
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {r.casNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 max-w-48 truncate">
                      {r.smiles}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.molecularFormula}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "success" && r.structureImageUrl && (
                        <img
                          src={r.structureImageUrl}
                          alt={r.chemicalName}
                          width={150}
                          height={150}
                          loading="lazy"
                          className="rounded"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
