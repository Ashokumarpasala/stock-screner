/* -------------------------
  Data + utilities
------------------------- */
let csvData = [],
	filteredData = [],
	headers = []; // headers holds ALL original CSV headers

// --- New Global Variables for Column Filtering ---
let allDataHeaderKeys = []; // Stores the actual column names from the CSV for the desired fields (e.g., ["Symbol", "Opening Price", "High Value", ...])
let displayedHeaderKeys = []; // Stores the headers currently being displayed (subset of allDataHeaderKeys + "Label")
// --- End New Global Variables ---

const normalize = (s) =>
	String(s ?? "")
		.trim()
		.toLowerCase();

function loadCSV() {
	const f = document.getElementById("csvFile").files[0];
	if (!f) return alert("Please select a CSV file");
	const reader = new FileReader();
	reader.onload = (e) => {
		Papa.parse(e.target.result, {
			header: true,
			skipEmptyLines: true,
			complete: (res) => {
				csvData = res.data.map((r) => ({ ...r }));
				headers =
					res.meta.fields || (csvData[0] ? Object.keys(csvData[0]) : []);
				filteredData = [...csvData];

				// --- MODIFICATION START (Determine and Store Display Headers) ---
				// 1. Identify the exact header names for the desired columns based on keywords
				const symbolKey = findHeader(["symbol", "ticker", "scrip", "code"]);
				const openKey = findHeader(["open", "opening"]);
				const highKey = findHeader(["high"]);
				const lowKey = findHeader(["low"]);
				const closeKey = findHeader(["close", "last", "ltp"]);
				const volKey = findHeader(["volume", "vol"]);

				// 2. Create the list of essential data headers (excluding 'Label' for now)
				allDataHeaderKeys = [
					symbolKey,
					openKey,
					highKey,
					lowKey,
					closeKey,
					volKey,
				].filter((key) => key !== null && key !== undefined);

				// 3. Initialize displayedHeaderKeys with the essential data headers
				displayedHeaderKeys = [...allDataHeaderKeys];
				// --- MODIFICATION END ---

				renderTable();
				document.getElementById("downloadBtn").style.display = "inline-block";
				document.getElementById("pdfBtn").style.display = "inline-block";
				document.getElementById(
					"filterInfo"
				).innerText = `Loaded ${csvData.length} rows.`;
			},
			error: (err) => alert("CSV parse error: " + err),
		});
	};
	reader.readAsText(f);
}

function renderTable() {
	const container = document.getElementById("tableContainer");
	if (!filteredData || !filteredData.length) {
		container.innerHTML = "<p>No data loaded.</p>";
		return;
	}

	// --- MODIFICATION START (Use displayedHeaderKeys) ---
	// The columns to display are the essential data columns plus 'Label' if it exists.
	let currentDisplayHeaders = [...displayedHeaderKeys];
	if (!currentDisplayHeaders.some((h) => normalize(h) === "label")) {
		currentDisplayHeaders.push("Label");
	}
	// --- MODIFICATION END ---

	let html = "<table><thead><tr>";
	currentDisplayHeaders.forEach((h) => (html += `<th>${h}</th>`));
	html += "</tr></thead><tbody>";

	filteredData.forEach((r, i) => {
		html += "<tr>";
		currentDisplayHeaders.forEach((h) => {
			const val = r[h] ?? "";
			let cls = "";
			let cell = val;

			if (normalize(h).includes("symbol")) {
				cls = "symbol-cell";
				const sym = String(val).trim().toUpperCase();
				const tvUrl = `https://in.tradingview.com/symbols/NSE-${encodeURIComponent(
					sym
				)}/`;
				cell = `<a href="${tvUrl}" target="_blank" class="symbol-link">${escapeHtml(
					sym
				)}</a>`;
			}

			if (normalize(h) === "label") {
				if (String(val).toLowerCase() === "buy")
					cell = `<span class="label-buy">BUY</span>`;
				if (String(val).toLowerCase() === "sell")
					cell = `<span class="label-sell">SELL</span>`;
			}

			html += `<td class="${cls}" data-row="${i}" data-col="${encodeURIComponent(
				h
			)}">${cell}</td>`;
		});
		html += "</tr>";
	});

	html += "</tbody></table>";
	container.innerHTML = html;
}

/* click on symbol opens TradingView */
function cellClick(e) {
	const td = e.currentTarget;
	const header = decodeURIComponent(td.dataset.col);
	const rowIndex = Number(td.dataset.row);
	if (normalize(header).includes("symbol")) {
		const sym =
			filteredData[rowIndex][header] ?? filteredData[rowIndex]["Symbol"] ?? "";
		openTradingView(sym);
	}
}
function openTradingView(symbol) {
	if (!symbol) return alert("Symbol empty");
	let s = String(symbol).trim();
	if (!s.includes(":")) s = "NSE:" + s;
	const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(
		s
	)}`;
	window.open(url, "_blank");
}

/* header-finders */
function findHeader(keywords) {
	for (let h of headers) {
		const nh = normalize(h);
		for (let kw of keywords) if (nh.includes(kw)) return h;
	}
	return null;
}

/* numeric parse */
function cleanNumber(v) {
	if (v === null || v === undefined) return NaN;
	let s = String(v).trim();
	if (!s) return NaN;
	s = s.replace(/,/g, "");
	const m = s.match(/[-+]?\d*\.?\d+(e[-+]?\d+)?/i);
	if (!m) return NaN;
	return Number(m[0]);
}

/* marketcap -> crores */
function parseMarketCapToCrores(raw) {
	if (raw === null || raw === undefined) return NaN;
	const s = String(raw).trim().toLowerCase();
	if (!s) return NaN;
	if (/^[\d,\.]+$/.test(s.replace(/\s/g, "")))
		return Number(s.replace(/,/g, ""));
	const m = s.match(/([\d,.]*\d(?:\.\d+)?)[\s]*([a-zA-Z]+)/);
	if (!m) return NaN;
	let num = Number(m[1].replace(/,/g, ""));
	if (isNaN(num)) return NaN;
	const suf = m[2];
	if (/cr|crore/.test(suf)) return num;
	if (/lakh|lac|l/.test(suf)) return num * 0.01;
	if (/m|mn|million/.test(suf)) return num * 0.1;
	if (/b|bn|billion/.test(suf)) return num * 100;
	if (/k/.test(suf)) return num * 0.00001;
	return NaN;
}

/* approx equal */
function approxEqual(a, b, tol = 0.000001) {
	if (isNaN(a) || isNaN(b)) return false;
	return Math.abs(a - b) <= tol;
}

/* Parse date */
function parseDateString(s) {
	if (!s) return null;
	s = String(s).trim();
	const iso = new Date(s);
	if (!isNaN(iso)) return iso;
	const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
	if (m) {
		const d = Number(m[1]),
			mo = Number(m[2]) - 1,
			y = Number(m[3]);
		return new Date(y, mo, d);
	}
	return null;
}

/* time to minutes */
function timeToMinutes(t) {
	if (!t) return NaN;
	const s = String(t).trim();
	const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
	if (!m) return NaN;
	const hh = Number(m[1]),
		mm = Number(m[2]);
	return hh * 60 + mm;
}

/* -------------------------
  Main filter + 5min-entry logic
------------------------- */
function applyPredefinedFilter(type) {
	if (!csvData || !csvData.length) return alert("Upload CSV first");

	// detect headers
	const openKey = findHeader(["open", "opening"]);
	const highKey = findHeader(["high"]);
	const lowKey = findHeader(["low"]);
	const closeKey = findHeader(["close", "last", "ltp"]);
	const volKey = findHeader(["volume", "vol"]);
	const avgVolKey = findHeader([
		"avg volume",
		"average volume",
		"avgvol",
		"5 day",
		"5day",
	]);
	const mcapKey = findHeader([
		"market cap",
		"mcap",
		"market capitalization",
		"marketcap",
	]);
	const symbolKey = findHeader(["symbol", "ticker", "scrip", "code"]);
	const dateKey = findHeader(["date"]);
	const timeKey = findHeader(["time", "datetime"]);

	if (!openKey || !highKey || !lowKey)
		return alert("CSV must include Open, High and Low columns.");

	const needFull = type === "full";
	if (needFull && (!volKey || !avgVolKey || !closeKey || !mcapKey)) {
		return alert(
			"Full screener requires Volume, Avg Volume (5d), Close and Market Cap columns."
		);
	}

	const minGain = Number(document.getElementById("minGain").value || 0) / 100;

	// Reset filteredData and Label
	filteredData = csvData.map((r) => ({ ...r, Label: "" }));

	// Filter by open high/low/basic
	filteredData = filteredData.filter((r) => {
		const open = cleanNumber(r[openKey]),
			high = cleanNumber(r[highKey]),
			low = cleanNumber(r[lowKey]);
		if (isNaN(open) || isNaN(high) || isNaN(low)) return false;
		const oeqh = approxEqual(open, high),
			oeql = approxEqual(open, low);
		if (type === "openHigh") return oeqh;
		if (type === "openLow") return oeql;
		if (type === "openHighLow") return oeqh && oeql;
		if (type === "full") return oeqh || oeql;
		return false;
	});

	// If full screener apply vol/price/mcap/gain
	if (needFull) {
		filteredData = filteredData.filter((r) => {
			const vol = cleanNumber(r[volKey]),
				avgVol = cleanNumber(r[avgVolKey]),
				close = cleanNumber(r[closeKey]);
			if (isNaN(vol) || isNaN(avgVol) || isNaN(close)) return false;
			if (!(vol > 1.5 * avgVol)) return false;
			if (!(close > 200)) return false;
			const mc = parseMarketCapToCrores(r[mcapKey]);
			if (isNaN(mc) || !(mc > 10000)) return false;

			// optional gain %
			if (minGain > 0) {
				const open = cleanNumber(r[openKey]);
				const oeqh = approxEqual(open, cleanNumber(r[highKey]));
				const oeql = approxEqual(open, cleanNumber(r[lowKey]));
				if (oeql && !(close >= open * (1 + minGain))) return false;
				if (oeqh && !(close <= open * (1 - minGain))) return false;
			}
			return true;
		});
	}

	// group by symbol
	const symbolToRows = {};
	for (const r of filteredData) {
		const sym = (symbolKey ? r[symbolKey] ?? "" : r["Symbol"] ?? "") || "";
		if (!sym) continue;
		if (!symbolToRows[sym]) symbolToRows[sym] = [];
		symbolToRows[sym].push(r);
	}

	function getFirstCandleOfLatestDate(rows) {
		const dateMap = {};
		for (const r of rows) {
			const dateRaw = (dateKey ? r[dateKey] : r["Date"]) ?? "";
			const parsed = parseDateString(dateRaw);
			const dateKeyStr = parsed ? parsed.toISOString().slice(0, 10) : "nodate";
			if (!dateMap[dateKeyStr]) dateMap[dateKeyStr] = [];
			dateMap[dateKeyStr].push(r);
		}
		const keys = Object.keys(dateMap);
		if (!keys.length) return null;
		if (keys.includes("nodate")) {
			const all = dateMap["nodate"];
			return pickEarliestByTime(all);
		}
		const chosenKey = keys
			.filter((k) => k !== "nodate")
			.sort()
			.pop();
		const rowsOnDate = dateMap[chosenKey] || [];
		return pickEarliestByTime(rowsOnDate);
	}

	function pickEarliestByTime(rows) {
		if (!rows || !rows.length) return null;
		if (!timeKey) return rows[0];
		let best = null,
			bestMin = Infinity;
		for (const r of rows) {
			const tRaw = r[timeKey] ?? r["Time"] ?? "";
			const mins = timeToMinutes(tRaw);
			if (isNaN(mins)) continue;
			if (mins < bestMin) {
				bestMin = mins;
				best = r;
			}
		}
		return best || rows[0];
	}

	const openLowCandidates = [],
		openHighCandidates = [];
	for (const sym in symbolToRows) {
		const rows = symbolToRows[sym];
		const firstCandle = getFirstCandleOfLatestDate(rows);
		if (!firstCandle) continue;
		const open = cleanNumber(firstCandle[openKey]),
			high = cleanNumber(firstCandle[highKey]),
			low = cleanNumber(firstCandle[lowKey]);
		if (isNaN(open) || isNaN(high) || isNaN(low)) continue;
		if (approxEqual(open, low))
			openLowCandidates.push({
				sym,
				row: firstCandle,
				vol: cleanNumber(firstCandle[volKey] ?? firstCandle["Volume"] ?? 0),
			});
		if (approxEqual(open, high))
			openHighCandidates.push({
				sym,
				row: firstCandle,
				vol: cleanNumber(firstCandle[volKey] ?? firstCandle["Volume"] ?? 0),
			});
	}

	function pickBestByVol(list) {
		if (!list.length) return null;
		list.sort((a, b) => cleanNumber(b.vol) - cleanNumber(a.vol));
		return list[0];
	}

	const bestOpenLow = pickBestByVol(openLowCandidates);
	const bestOpenHigh = pickBestByVol(openHighCandidates);

	if (bestOpenLow) {
		for (let r of filteredData) {
			if (r === bestOpenLow.row) {
				r["Label"] = "BUY";
				break;
			}
		}
	}
	if (bestOpenHigh) {
		for (let r of filteredData) {
			if (r === bestOpenHigh.row) {
				r["Label"] = "SELL";
				break;
			}
		}
	}

	// --- MODIFICATION START (Ensure Label is in displayedHeaderKeys) ---
	// If we apply a filter that adds a 'Label', we must make sure it is in our display list
	if (!displayedHeaderKeys.some((h) => normalize(h) === "label")) {
		displayedHeaderKeys.push("Label");
	}
	// --- MODIFICATION END ---

	renderTable();
	document.getElementById(
		"filterInfo"
	).innerText = `Filter: ${type} — results ${
		filteredData.length
	}. Selected BUY: ${bestOpenLow ? bestOpenLow.sym : "None"} | SELL: ${
		bestOpenHigh ? bestOpenHigh.sym : "None"
	}`;

	computeAndShowPL(
		bestOpenLow ? bestOpenLow.row : null,
		bestOpenHigh ? bestOpenHigh.row : null,
		{ openKey, highKey, lowKey, closeKey }
	);
}

/* Clear filter */
function clearFilter() {
	filteredData = [...csvData];

	// --- MODIFICATION START (Reset displayedHeaderKeys) ---
	// On clear, revert the display back to the essential data headers (removing "Label")
	displayedHeaderKeys = [...allDataHeaderKeys];
	// --- MODIFICATION END ---

	renderTable();
	document.getElementById("filterInfo").innerText = "";
	document.getElementById("plPanel").style.display = "none";
}

/* compute trade entry, stop and target using percentage-based risk/reward and show PL */
function computeAndShowPL(buyRow, sellRow, keys) {
	const { openKey, highKey, lowKey, closeKey } = keys;
	const plDiv = document.getElementById("plContent");
	plDiv.innerHTML = "";
	document.getElementById("plPanel").style.display = "block";

	function computeForRow(row, side) {
		if (!row) return null;
		const symbolHeader =
			findHeader(["symbol", "ticker", "scrip", "code"]) ||
			headers.find((h) => normalize(h).includes("symbol")) ||
			Object.keys(row)[0];
		const sym = row[symbolHeader] ?? "";
		const open = cleanNumber(row[openKey]),
			high = cleanNumber(row[highKey]),
			low = cleanNumber(row[lowKey]);
		if (isNaN(open) || isNaN(high) || isNaN(low)) return null;
		const range = high - low;
		if (range <= 0) return null;

		// entry = retrace 40% of the first 5-min candle
		let entry;
		if (side === "BUY") entry = high - 0.4 * range;
		else entry = low + 0.4 * range;

		// percentage-based risk/reward
		const riskPct = 0.01; // 1%
		const rewardPct = 0.015; // 1.5%

		let stop, target;
		if (side === "BUY") {
			stop = entry - riskPct * entry;
			target = entry + rewardPct * entry;
		} else {
			stop = entry + riskPct * entry;
			target = entry - rewardPct * entry;
		}

		const riskPerShare = round(Math.abs(entry - stop));
		const rewardPerShare = round(Math.abs(target - entry));
		const rr =
			riskPerShare > 0 ? round(rewardPerShare / riskPerShare, 2) : "N/A";
		const entryRounded = round(entry),
			stopRounded = round(stop),
			targetRounded = round(target);
		const riskPctDisplay = round((riskPerShare / entryRounded) * 100, 2);
		const rewardPctDisplay = round((rewardPerShare / entryRounded) * 100, 2);

		return {
			symbol: sym,
			side,
			entry: entryRounded,
			stop: stopRounded,
			target: targetRounded,
			riskPerShare,
			rewardPerShare,
			rr,
			riskPct: riskPctDisplay,
			rewardPct: rewardPctDisplay,
		};
	}

	const buyTrade = computeForRow(buyRow, "BUY");
	const sellTrade = computeForRow(sellRow, "SELL");

	if (!buyTrade && !sellTrade) {
		plDiv.innerHTML =
			"<div>No BUY or SELL candidate selected by the screener.</div>";
		return;
	}

	let html =
		"<table style='width:100%;border-collapse:collapse'><thead><tr style='background:#f1f1f1'><th>Symbol</th><th>Side</th><th>Entry</th><th>Stop</th><th>Target</th><th>Risk/share</th><th>Reward/share</th><th>R:R</th><th>Risk %</th><th>Reward %</th></tr></thead><tbody>";
	if (buyTrade) {
		html += `<tr><td>${escapeHtml(
			buyTrade.symbol
		)}</td><td style="color:#0b6623;font-weight:700">BUY</td><td>${
			buyTrade.entry
		}</td><td>${buyTrade.stop}</td><td>${buyTrade.target}</td><td>${
			buyTrade.riskPerShare
		}</td><td>${buyTrade.rewardPerShare}</td><td>${buyTrade.rr}</td><td>${
			buyTrade.riskPct
		}%</td><td>${buyTrade.rewardPct}%</td></tr>`;
	}
	if (sellTrade) {
		html += `<tr><td>${escapeHtml(
			sellTrade.symbol
		)}</td><td style="color:#b71c1c;font-weight:700">SELL</td><td>${
			sellTrade.entry
		}</td><td>${sellTrade.stop}</td><td>${sellTrade.target}</td><td>${
			sellTrade.riskPerShare
		}</td><td>${sellTrade.rewardPerShare}</td><td>${sellTrade.rr}</td><td>${
			sellTrade.riskPct
		}%</td><td>${sellTrade.rewardPct}%</td></tr>`;
	}
	html += "</tbody></table>";
	plDiv.innerHTML = html;
}

/* helpers */
function round(v, d = 2) {
	if (isNaN(v)) return v;
	const p = Math.pow(10, d);
	return Math.round(v * p) / p;
}
function escapeHtml(s) {
	if (s === null || s === undefined) return "";
	return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/* download/export */
function downloadCSV() {
	if (!filteredData || !filteredData.length)
		return alert("No data to download");

	// --- MODIFICATION START (Use displayedHeaderKeys for unparse) ---
	// Ensure 'Label' is included if it was added by a filter
	const currentDisplayHeaders = [...displayedHeaderKeys];
	if (!currentDisplayHeaders.some((h) => normalize(h) === "label")) {
		currentDisplayHeaders.push("Label");
	}

	// Create an array of data that only includes the currentDisplayHeaders columns
	const dataToExport = filteredData.map((row) => {
		const newRow = {};
		currentDisplayHeaders.forEach((h) => {
			newRow[h] = row[h];
		});
		return newRow;
	});

	const csv = Papa.unparse(dataToExport, {
		columns: currentDisplayHeaders, // Specify the columns to ensure correct order
	});
	// --- MODIFICATION END ---

	const blob = new Blob([csv], { type: "text/csv" });
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = "filtered_stocks.csv";
	a.click();
}

function downloadPDF() {
	if (!filteredData || !filteredData.length) return alert("No data to export");
	const { jsPDF } = window.jspdf;
	const doc = new jsPDF();

	// --- MODIFICATION START (Use displayedHeaderKeys for PDF) ---
	// Ensure 'Label' is included if it was added by a filter
	const currentDisplayHeaders = [...displayedHeaderKeys];
	if (!currentDisplayHeaders.some((h) => normalize(h) === "label")) {
		currentDisplayHeaders.push("Label");
	}

	const rows = filteredData.map((r) =>
		currentDisplayHeaders.map((h) => r[h] ?? "")
	);
	doc.text("Filtered Stocks", 14, 15);
	doc.autoTable({ head: [currentDisplayHeaders], body: rows, startY: 20 });
	// --- MODIFICATION END ---

	doc.save("filtered_stocks.pdf");
}
