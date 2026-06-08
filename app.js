const LAMBDA = 1 / 8267;
const HALF_LIFE_OPTIONS = {
  libby: {
    label: "Libby half-life",
    halfLife: 5568
  },
  cambridge: {
    label: "Cambridge half-life",
    halfLife: 5730
  }
};

const labels = {
  fm: {
    name: "F¹⁴C / Fm",
    unit: "",
    placeholder: "例: 0.9824",
    errorPlaceholder: "例: 0.0021"
  },
  pmc: {
    name: "pMC",
    unit: "%",
    placeholder: "例: 98.24",
    errorPlaceholder: "例: 0.21"
  },
  deltaCorrected: {
    name: "Delta¹⁴C 補正済み",
    unit: "per mil",
    placeholder: "例: -21.5",
    errorPlaceholder: "例: 2.1"
  },
  deltaRaw: {
    name: "Delta¹⁴C 補正前",
    unit: "per mil",
    placeholder: "例: -17.6",
    errorPlaceholder: "例: 2.1"
  },
  age: {
    name: "¹⁴C age",
    unit: "yr BP",
    placeholder: "例: 142",
    errorPlaceholder: "例: 17"
  }
};

const form = document.querySelector("#converter-form");
const sourceType = document.querySelector("#source-type");
const knownValue = document.querySelector("#known-value");
const knownError = document.querySelector("#known-error");
const knownValueLabel = document.querySelector("#known-value-label");
const knownErrorLabel = document.querySelector("#known-error-label");
const collectionYear = document.querySelector("#collection-year");
const collectionYearField = document.querySelector("#collection-year-field");
const halfLifeMode = document.querySelector("#half-life-mode");
const resetButton = document.querySelector("#reset-button");
const resultsBody = document.querySelector("#results-body");
const message = document.querySelector("#message");

function getTarget() {
  return new FormData(form).get("target");
}

function parseNumber(input) {
  if (input.value.trim() === "") {
    return null;
  }

  const value = Number(input.value);
  return Number.isFinite(value) ? value : null;
}

function getYearFactor(year) {
  return Math.exp(LAMBDA * (1950 - year));
}

function getAgeMeanLife() {
  const selected = HALF_LIFE_OPTIONS[halfLifeMode.value] || HALF_LIFE_OPTIONS.libby;
  return selected.halfLife / Math.LN2;
}

function needsCollectionYear() {
  const target = getTarget();
  return target === "deltaCorrected" || sourceType.value === "deltaCorrected";
}

function setMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

function updateInputs() {
  const selected = labels[sourceType.value];
  knownValueLabel.textContent = selected.name;
  knownErrorLabel.textContent = `1 sigma error 任意${selected.unit ? ` (${selected.unit})` : ""}`;
  knownValue.placeholder = selected.placeholder;
  knownError.placeholder = selected.errorPlaceholder;

  const requiresYear = needsCollectionYear();
  collectionYearField.classList.toggle("is-required", requiresYear);
  collectionYear.required = requiresYear;
  collectionYear.disabled = !requiresYear;
  if (!requiresYear) {
    collectionYear.value = "";
  }
}

function fmFromSource(type, value, year) {
  if (type === "fm") {
    return value;
  }

  if (type === "pmc") {
    return value / 100;
  }

  if (type === "deltaRaw") {
    return value / 1000 + 1;
  }

  if (type === "deltaCorrected") {
    return (value / 1000 + 1) / getYearFactor(year);
  }

  if (type === "age") {
    return Math.exp(-value / getAgeMeanLife());
  }

  return Number.NaN;
}

function sigmaFmFromSource(type, sigma, fm, year) {
  if (sigma === null) {
    return null;
  }

  if (sigma < 0) {
    throw new Error("1 sigma errorは0以上で入力してください。");
  }

  if (type === "fm") {
    return sigma;
  }

  if (type === "pmc") {
    return sigma / 100;
  }

  if (type === "deltaRaw") {
    return sigma / 1000;
  }

  if (type === "deltaCorrected") {
    return sigma / (1000 * getYearFactor(year));
  }

  if (type === "age") {
    return Math.abs((fm * sigma) / getAgeMeanLife());
  }

  return null;
}

function buildResults(fm, sigmaFm, year) {
  const hasYear = year !== null;
  const yearFactor = hasYear ? getYearFactor(year) : null;
  const ageMeanLife = getAgeMeanLife();
  const age = -ageMeanLife * Math.log(fm);

  return {
    fm: {
      label: labels.fm.name,
      value: fm,
      sigma: sigmaFm,
      unit: labels.fm.unit
    },
    pmc: {
      label: labels.pmc.name,
      value: fm * 100,
      sigma: sigmaFm === null ? null : sigmaFm * 100,
      unit: labels.pmc.unit
    },
    deltaCorrected: {
      label: labels.deltaCorrected.name,
      value: hasYear ? (fm * yearFactor - 1) * 1000 : null,
      sigma: hasYear && sigmaFm !== null ? sigmaFm * yearFactor * 1000 : null,
      unit: labels.deltaCorrected.unit
    },
    deltaRaw: {
      label: labels.deltaRaw.name,
      value: (fm - 1) * 1000,
      sigma: sigmaFm === null ? null : sigmaFm * 1000,
      unit: labels.deltaRaw.unit
    },
    age: {
      label: labels.age.name,
      value: age,
      sigma: sigmaFm === null ? null : Math.abs((ageMeanLife * sigmaFm) / fm),
      unit: labels.age.unit
    }
  };
}

function formatNumber(value, key) {
  if (value === null || !Number.isFinite(value)) {
    return "Ycが必要";
  }

  const abs = Math.abs(value);

  if (key === "fm") {
    return value.toLocaleString("ja-JP", {
      maximumFractionDigits: 6,
      minimumFractionDigits: abs < 0.01 ? 6 : 4
    });
  }

  if (abs >= 10000) {
    return value.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
  }

  if (abs >= 100) {
    return value.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
  }

  return value.toLocaleString("ja-JP", { maximumFractionDigits: 3 });
}

function formatValue(result, key) {
  const value = formatNumber(result.value, key);
  return result.unit && result.value !== null ? `${value} ${result.unit}` : value;
}

function formatSigma(result, key) {
  if (result.sigma === null || !Number.isFinite(result.sigma)) {
    return "--";
  }

  const value = formatNumber(result.sigma, key);
  return result.unit ? `± ${value} ${result.unit}` : `± ${value}`;
}

function validate(value, year) {
  if (value === null) {
    throw new Error("既知値を入力してください。");
  }

  if (needsCollectionYear() && year === null) {
    throw new Error("Delta¹⁴C 補正済みの計算には形成年 / 採取年 Yc が必要です。");
  }

  if (sourceType.value === "age" && value < 0) {
    throw new Error("¹⁴C ageは0以上で入力してください。");
  }
}

function render(results) {
  const rows = Object.entries(results)
    .map(([key, result]) => {
      return `
        <tr>
          <th scope="row">${result.label}</th>
          <td>${formatValue(result, key)}</td>
          <td>${formatSigma(result, key)}</td>
        </tr>
      `;
    })
    .join("");

  resultsBody.innerHTML = rows;
}

function calculate() {
  try {
    const value = parseNumber(knownValue);
    const sigma = parseNumber(knownError);
    const year = parseNumber(collectionYear);

    validate(value, year);

    const fm = fmFromSource(sourceType.value, value, year);
    if (!Number.isFinite(fm) || fm <= 0) {
      throw new Error("計算後のF¹⁴C / Fmが0以下です。入力値を確認してください。");
    }

    const sigmaFm = sigmaFmFromSource(sourceType.value, sigma, fm, year);
    const results = buildResults(fm, sigmaFm, year);
    render(results);
    setMessage("");
  } catch (error) {
    setMessage(error.message);
  }
}

sourceType.addEventListener("change", () => {
  updateInputs();
  calculate();
});

form.addEventListener("change", () => {
  updateInputs();
  calculate();
});

form.addEventListener("input", () => {
  calculate();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculate();
});

resetButton.addEventListener("click", () => {
  form.reset();
  updateInputs();
  setMessage("");
  resultsBody.innerHTML = '<tr><td colspan="3">測定後情報を入力してください。</td></tr>';
  knownValue.focus();
});

updateInputs();
