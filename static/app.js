const all = Array.from({ length: 10000 }, (_, i) =>
  String(i).padStart(4, "0")
);

const state = {
  index: 0,
  mode: "sequential",
  currentCode: "",
  results: [],
};

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.pinTester || "{}");
    if (Number.isInteger(saved.index)) {
      state.index = saved.index;
    }
    if (saved.mode === "random") {
      state.mode = "random";
    }
  } catch {
    localStorage.removeItem("pinTester");
  }
}

function triedCodes() {
  return new Set(state.results.map((result) => result.code));
}

function matchCount() {
  return state.results.filter(isMatch).length;
}

function normalizeCode(code) {
  const digits = String(code || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(4, "0").slice(-4);
}

function normalizeResult(result) {
  const value = String(result || "").trim();
  return value || "no";
}

function selectNextCode() {
  const tried = triedCodes();

  if (state.mode === "random") {
    const remaining = all.filter((code) => !tried.has(code));
    state.currentCode = remaining.length
      ? remaining[Math.floor(Math.random() * remaining.length)]
      : "";
    return;
  }

  while (all[state.index] && tried.has(all[state.index])) {
    state.index++;
  }

  state.currentCode = all[state.index] || "";
}

function show() {
  document.getElementById("code").textContent = state.currentCode || "DONE";

  document.getElementById("triedCount").textContent = state.results.length;

  document.getElementById("matchCount").textContent = matchCount();

  document.getElementById("totalCount").textContent = all.length;

  document.getElementById("percent").textContent = (
    (100 * state.results.length) /
    all.length
  ).toFixed(1);

  document.getElementById("modeToggle").checked = state.mode === "random";
  document.getElementById("modeText").textContent =
    state.mode === "random" ? "Random" : "Sequential";

  renderMatches();

  localStorage.pinTester = JSON.stringify(state);
}

function renderMatches() {
  const body = document.getElementById("matchesBody");
  const matches = state.results.filter(isMatch);

  if (!matches.length) {
    body.innerHTML = '<tr><td class="empty" colspan="2">No matches</td></tr>';
    return;
  }

  body.innerHTML = matches
    .map(
      (match) => `
        <tr>
          <td>${escapeHtml(match.code)}</td>
          <td>${escapeHtml(match.result)}</td>
        </tr>
      `
    )
    .join("");
}

function isMatch(result) {
  const value = String(result.result || "").trim();
  return value && value.toLowerCase() !== "no";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

async function load() {
  loadSavedState();

  const response = await fetch("/codes");
  state.results = await response.json();

  selectNextCode();
  show();
}

async function mark(result, code = state.currentCode) {
  if (!code) return;

  const menu = result || "no";

  state.results.push({
    code,
    result: menu,
    time: new Date().toISOString(),
  });

  localStorage.pinTester = JSON.stringify(state);

  try {
    await saveRemote(code, menu);
  } catch (err) {
    alert("Saved locally, but server submit failed");
  }

  if (state.mode === "sequential" && code === state.currentCode) {
    state.index++;
  }

  selectNextCode();
  show();
}

async function markMatch() {
  const menu = prompt("Menu name?");
  if (menu === null) return;

  await mark(menu || "yes");
}

async function markManual() {
  const code = normalizeCode(prompt("Code?"));
  if (!code) return;

  const matched = confirm("Did this code match?");
  if (!matched) {
    await mark("no", code);
    return;
  }

  const menu = prompt("Menu name?");
  if (menu === null) return;

  await mark(menu || "yes", code);
}

function setMode(random) {
  state.mode = random ? "random" : "sequential";
  selectNextCode();
  show();
}

function openImport() {
  document.getElementById("csvFile").click();
}

async function importCsv(file) {
  if (!file) return;

  try {
    const rows = parseCsv(await file.text());
    const imported = rows
      .map(([code, result]) => ({
        code: normalizeCode(code),
        result: normalizeResult(result),
      }))
      .filter((row) => row.code);

    if (!imported.length) {
      alert("No valid rows found. CSV should contain code,result.");
      return;
    }

    await saveImport(imported);
    state.results.push(...imported);
    selectNextCode();
    show();
    alert(`Imported ${imported.length} rows.`);
  } catch (err) {
    alert(err.message || "CSV import failed");
  } finally {
    document.getElementById("csvFile").value = "";
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  if (quoted) {
    throw new Error("CSV has an unterminated quoted field.");
  }

  return rows.filter((items) => items.some(Boolean)).map((items, index) => {
    if (items.length !== 2) {
      throw new Error(`Row ${index + 1} must contain exactly 2 columns.`);
    }
    return items;
  });
}

async function saveRemote(code, result) {
  const response = await fetch("/codes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ code, result }),
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`);
  }
}

async function saveImport(codes) {
  const response = await fetch("/codes/import", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(codes),
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`);
  }
}

load();
