# CC-Finder

A tool to look up chemical data from CAS numbers using the PubChem database.

Given a CSV file with CAS numbers, this tool will fetch:
- Chemical name
- SMILES code
- Molecular formula
- Structure image (renders directly in Google Sheets)

## Prerequisites

### 1. Install Node.js

Node.js is a program that runs this tool. You only need to install it once.

**On Mac:**
1. Go to https://nodejs.org/
2. Click the big green button that says "LTS" (Long Term Support)
3. Open the downloaded file and follow the installer prompts
4. Click "Continue" through all the steps, then "Install"

**On Windows:**
1. Go to https://nodejs.org/
2. Click the big green button that says "LTS" (Long Term Support)
3. Open the downloaded `.msi` file
4. Click "Next" through all the steps, keep all defaults, then "Install"

### 2. Open a Terminal

The terminal is where you'll type commands to run this tool.

**On Mac:**
1. Press `Cmd + Space` to open Spotlight
2. Type `Terminal` and press Enter

**On Windows:**
1. Press the Windows key
2. Type `PowerShell` and press Enter

## Setup

Copy and paste these commands into your terminal, one at a time, pressing Enter after each:

### Step 1: Download this tool

```bash
git clone https://github.com/cgorski28/cc-finder.git
```

### Step 2: Go into the folder

```bash
cd cc-finder
```

### Step 3: Install dependencies

```bash
npm install
```

You should see a progress bar and then a success message. This only needs to be done once.

## Usage

### Step 1: Prepare your CSV file

Create a CSV file (you can use Excel or Google Sheets and export as CSV) with your CAS numbers. The file needs a column with one of these exact names in the header row:
- `cas_number`
- `CAS`
- `cas`
- `CAS Number`

Example:
```
cas_number
50-00-0
64-17-5
67-56-1
```

Save this file somewhere you can find it easily (like your Desktop or Downloads folder).

### Step 2: Run the tool

In your terminal, type:

```bash
npm run dev /path/to/your/file.csv
```

Replace `/path/to/your/file.csv` with the actual location of your file.

**Examples:**

If your file is on your Desktop (Mac):
```bash
npm run dev ~/Desktop/my-chemicals.csv
```

If your file is in Downloads (Mac):
```bash
npm run dev ~/Downloads/my-chemicals.csv
```

If your file is on your Desktop (Windows):
```bash
npm run dev C:\Users\YourName\Desktop\my-chemicals.csv
```

**Tip:** You can also drag and drop the CSV file into the terminal window after typing `npm run dev ` (with a space at the end) - it will automatically fill in the path!

### Step 3: Get your results

The tool will create a new file with `_results` added to the name. For example:
- Input: `my-chemicals.csv`
- Output: `my-chemicals_results.csv`

The output file will be in the same folder as your input file.

### Step 4: View in Google Sheets

1. Open Google Sheets (https://sheets.google.com)
2. Click File > Import
3. Upload your results CSV file
4. The structure images will automatically appear in the `structure_image_url` column

## Output Columns

| Column | Description |
|--------|-------------|
| cas_number | The original CAS number |
| chemical_name | Chemical name from PubChem |
| smiles_code | SMILES representation |
| molecular_formula | Molecular formula |
| structure_image_url | Image formula for Google Sheets |
| status | `success` or `failed` |
| error | Error message if lookup failed |

## Troubleshooting

**"command not found: git"**
- On Mac: Open Terminal and run: `xcode-select --install`
- On Windows: Download and install Git from https://git-scm.com/download/win

**"command not found: npm" or "command not found: node"**
- Node.js didn't install correctly. Try reinstalling from https://nodejs.org/
- After installing, close and reopen your terminal

**"No such file or directory"**
- Double-check the path to your CSV file
- Try dragging the file into the terminal instead of typing the path

## Running Again Later

Once you've done the setup, you only need to:

1. Open Terminal
2. Go to the folder: `cd cc-finder`
3. Run the tool: `npm run dev /path/to/your/file.csv`
