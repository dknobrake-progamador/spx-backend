const XLSX = require("xlsx");
const wb = XLSX.readFile(String.raw`D:\downloads\38833FF26BA1D.UnigramPreview_g9c9v27vpyspw!App\(1)30-05-2026 DOUGLAS GABRIEL.xlsx`);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
console.log(JSON.stringify(rows.slice(0,5), null, 2));
