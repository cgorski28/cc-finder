# CC-Finder

A tool to look up chemical data from CAS numbers using the PubChem database.

Given a CSV file with CAS numbers, this tool will fetch:
- Chemical name
- SMILES code
- Molecular formula
- Structure image (renders directly in Google Sheets)

## Prerequisites

You need Node.js installed. Download it from https://nodejs.org/ (use the LTS version).

## Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/cgorski28/cc-finder.git
   cd cc-finder
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Create a CSV file with your CAS numbers. The file should have a column named one of:
   - `cas_number`
   - `CAS`
   - `cas`
   - `CAS Number`

   Example `input.csv`:
   ```
   cas_number
   50-00-0
   64-17-5
   67-56-1
   ```

2. Run the tool:
   ```bash
   npm run dev input.csv
   ```

   This will create `input_results.csv` with all the chemical data.

   Or specify a custom output file:
   ```bash
   npm run dev input.csv output.csv
   ```

3. Open the results CSV in Google Sheets. The structure images will render automatically in the `structure_image_url` column.

## Output

The output CSV contains these columns:
| Column | Description |
|--------|-------------|
| cas_number | The original CAS number |
| chemical_name | Chemical name from PubChem |
| smiles_code | SMILES representation |
| molecular_formula | Molecular formula |
| structure_image_url | Image formula for Google Sheets |
| status | `success` or `failed` |
| error | Error message if lookup failed |
