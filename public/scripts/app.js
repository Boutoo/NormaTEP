const statsFile = "./public/stats_data.csv";
const covFile = "./public/covariance_data.csv";
const tablePageSize = 25;
const observedValueStep = 0.001;

const referenceContext = Object.freeze({
    studies: 9,
    cohortSize: 164,
    femaleCount: 88,
    meanAge: 30.8,
    ageStdDev: 9.8,
    ageRange: "20-71 years",
    scope: "Left-M1 single-pulse TMS-EEG",
    privacy: "All participant data stay in the browser.",
    ageEffectSummary: "Age influences many features in this reference set.",
    sexEffectSummary: "Sex has limited effect in this reference set.",
    limitations: "Research-use reference; younger-adult skew; not yet generalisable to other targets, protocols, or demographics."
});

const benchmarkFilterColumns = ["Measure", "Time", "Band", "Cluster"];

const columnRenames = {
    Normative_Mean: "Normative Mean",
    Normative_Std: "Normative Std Dev",
    diff: "Difference",
    tCI_5: "Confidence Interval (5%)",
    tCI_95: "Confidence Interval (95%)",
    corr: "Correlation",
    cor_5: "Corr (5%)",
    corr_95: "Corr (95%)",
    cv: "Coeff. of Variation",
    cv_5: "CV (5%)",
    cv_95: "CV (95%)",
    ICC: "Intraclass Corr.",
    ICC_5: "ICC (5%)",
    ICC_95: "ICC (95%)",
    SEM: "Standard Error of Measurement"
};

const appState = {
    globalData: [],
    covMatrix: [],
    featureMap: new Map(),
    meanCol: null,
    stdCol: null,
    idColumns: [],
    selectedFeatures: [],
    table: {
        headers: [],
        visibleColumns: new Set(),
        searchQuery: "",
        filters: {},
        currentPage: 1,
        pageSize: tablePageSize,
        sortHeader: null,
        sortDirection: "asc"
    }
};

const dom = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
    cacheDom();
    bindEvents();
    hydrateSummary();
    updateSelectionInsights();
    setCalculatorMessage("Loading datasets...", "info");
    loadDatasets();
}

function cacheDom() {
    dom.featureSearch = document.getElementById("featureSearch");
    dom.featureOptions = document.getElementById("featureOptions");
    dom.addFeatureButton = document.getElementById("btnAddFeature");
    dom.clearAllButton = document.getElementById("btnClearAll");
    dom.exportReportButton = document.getElementById("btnExportReport");
    dom.calculatorMessage = document.getElementById("calculator-message");
    dom.calculatorEmpty = document.getElementById("calculator-empty");
    dom.calculatorContainer = document.getElementById("calculator-container");
    dom.selectionChip = document.getElementById("selection-chip");
    dom.selectedCount = document.getElementById("selected-count");
    dom.readyCount = document.getElementById("ready-count");
    dom.covarianceStatus = document.getElementById("covariance-status");
    dom.summaryCohort = document.getElementById("summary-cohort");
    dom.summaryTotalFeatures = document.getElementById("summary-total-features");
    dom.summaryMeasures = document.getElementById("summary-measures");
    dom.summaryTimes = document.getElementById("summary-times");
    dom.summaryBands = document.getElementById("summary-bands");
    dom.summaryClusters = document.getElementById("summary-clusters");
    dom.tableRowCount = document.getElementById("table-row-count");
    dom.tableColumnCount = document.getElementById("table-column-count");
    dom.tableSearch = document.getElementById("table-search");
    dom.filterMeasure = document.getElementById("filter-measure");
    dom.filterTime = document.getElementById("filter-time");
    dom.filterBand = document.getElementById("filter-band");
    dom.filterCluster = document.getElementById("filter-cluster");
    dom.clearTableFiltersButton = document.getElementById("btnClearTableFilters");
    dom.columnToggleList = document.getElementById("column-toggle-list");
    dom.tableWrapper = document.getElementById("table-wrapper");
    dom.tableInfo = document.getElementById("table-info");
    dom.prevPage = document.getElementById("prev-page");
    dom.nextPage = document.getElementById("next-page");
    dom.pageIndicator = document.getElementById("page-indicator");
    dom.mahalanobisSection = document.getElementById("mahalanobis-section");
    dom.d2Display = document.getElementById("d2-display");
    dom.d2Marker = document.getElementById("d2-marker");
    dom.pValDisplay = document.getElementById("p-val-display");
}

function bindEvents() {
    dom.addFeatureButton.addEventListener("click", addFeatureRow);
    dom.clearAllButton.addEventListener("click", clearAllFeatures);
    dom.exportReportButton.addEventListener("click", exportStructuredReport);
    dom.featureSearch.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            addFeatureRow();
        }
    });

    dom.calculatorContainer.addEventListener("beforeinput", handleCalculatorBeforeInput);
    dom.calculatorContainer.addEventListener("input", handleCalculatorInput);
    dom.calculatorContainer.addEventListener("click", handleCalculatorActions);

    dom.tableSearch.addEventListener("input", handleTableSearch);
    dom.columnToggleList.addEventListener("change", handleColumnToggle);
    dom.tableWrapper.addEventListener("click", handleTableSort);
    dom.prevPage.addEventListener("click", () => changePage(-1));
    dom.nextPage.addEventListener("click", () => changePage(1));
    dom.clearTableFiltersButton.addEventListener("click", clearTableFilters);

    [
        dom.filterMeasure,
        dom.filterTime,
        dom.filterBand,
        dom.filterCluster
    ].forEach((element) => {
        element.addEventListener("change", handleDimensionFilter);
    });
}

function hydrateSummary() {
    dom.summaryCohort.textContent = `N = ${referenceContext.cohortSize}`;
}

async function loadDatasets() {
    try {
        const [statsRows, covRows] = await Promise.all([
            loadCsvRows(statsFile),
            loadCsvRows(covFile)
        ]);

        if (statsRows.length < 2) {
            throw new Error("No rows were found in the statistics dataset.");
        }

        const headers = statsRows[0];
        appState.globalData = statsRows.slice(1).map((cells, index) => {
            const row = {};

            headers.forEach((header, cellIndex) => {
                row[header] = cells[cellIndex] ?? "";
            });

            row._originalIndex = index;
            return row;
        });

        appState.covMatrix = normalizeCovarianceData(covRows);

        detectColumns(headers);
        buildFeatureIndex();
        updateDatasetSummary(headers);
        initializeTable(headers);
        renderCalculator();
        setCalculatorMessage("Data loaded. Search and add a feature to start.", "success");
    } catch (error) {
        console.error(error);
        setCalculatorMessage("Could not load the CSV files.", "danger");
        dom.tableWrapper.innerHTML = '<p class="text-danger mb-0">Error loading data. Confirm both CSV files exist in the public folder.</p>';
        dom.tableInfo.textContent = "Data unavailable.";
    }
}

async function loadCsvRows(file) {
    const response = await fetch(file);

    if (!response.ok) {
        throw new Error(`Failed to load ${file}: ${response.status}`);
    }

    const text = await response.text();
    return parseCsv(text);
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];

        if (inQuotes) {
            if (character === '"') {
                if (text[index + 1] === '"') {
                    cell += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += character;
            }

            continue;
        }

        if (character === '"') {
            inQuotes = true;
        } else if (character === ",") {
            row.push(cell);
            cell = "";
        } else if (character === "\n") {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
        } else if (character !== "\r") {
            cell += character;
        }
    }

    if (cell.length || row.length) {
        row.push(cell);
        rows.push(row);
    }

    return rows.filter((currentRow) => currentRow.some((value) => value !== ""));
}

function normalizeCovarianceData(rawCovarianceRows) {
    let normalized = rawCovarianceRows;

    if (normalized.length > 0 && typeof normalized[0][0] === "string") {
        normalized = normalized.slice(1).map((row) => row.slice(1));
    }

    return normalized.map((row) => row.map((value) => Number(value)));
}

function detectColumns(headers) {
    appState.meanCol = headers.find((header) => header.toLowerCase().includes("normative_mean")) ||
        headers.find((header) => header.toLowerCase().match(/^(mean|avg|average)$/));

    appState.stdCol = headers.find((header) => header.toLowerCase().includes("normative_std")) ||
        headers.find((header) => header.toLowerCase().match(/^(std|stdev|sd|standard deviation)$/));

    const targetIds = ["Measure", "Time", "Band", "Cluster", "Region", "Condition"];
    appState.idColumns = headers.filter((header) => targetIds.includes(header) && header !== appState.meanCol && header !== appState.stdCol);

    if (!appState.idColumns.length) {
        appState.idColumns = headers.slice(0, 4);
    }
}

function buildFeatureIndex() {
    appState.featureMap = new Map();
    dom.featureOptions.innerHTML = "";

    appState.globalData.forEach((row) => {
        const compositeKey = createCompositeKey(row);

        if (!compositeKey) {
            return;
        }

        appState.featureMap.set(compositeKey, row);
        const option = document.createElement("option");
        option.value = compositeKey;
        dom.featureOptions.appendChild(option);
    });
}

function createCompositeKey(row) {
    return appState.idColumns
        .map((column) => row[column])
        .filter((value) => value)
        .join(", ");
}

function updateDatasetSummary(headers) {
    hydrateSummary();
    dom.summaryTotalFeatures.textContent = formatCount(appState.globalData.length);
    dom.summaryMeasures.textContent = formatCount(countUniqueValues("Measure"));
    dom.summaryTimes.textContent = formatCount(countUniqueValues("Time"));
    dom.summaryBands.textContent = formatCount(countUniqueValues("Band"));
    dom.summaryClusters.textContent = formatCount(countSpatialClusters());
    dom.tableRowCount.textContent = formatCount(appState.globalData.length);
    dom.tableColumnCount.textContent = formatCount(headers.length);
}

function countUniqueValues(column) {
    if (!appState.globalData.length || !Object.prototype.hasOwnProperty.call(appState.globalData[0], column)) {
        return 0;
    }

    return new Set(
        appState.globalData
            .map((row) => row[column])
            .filter((value) => value !== null && value !== undefined && value !== "")
    ).size;
}

function countSpatialClusters() {
    if (!appState.globalData.length || !Object.prototype.hasOwnProperty.call(appState.globalData[0], "Cluster")) {
        return 0;
    }

    return new Set(
        appState.globalData
            .map((row) => row.Cluster)
            .filter((value) => value && value !== "Global")
    ).size;
}

function initializeTable(headers) {
    appState.table.headers = headers;
    appState.table.visibleColumns = getDefaultVisibleColumns(headers);
    appState.table.filters = createInitialFilters(headers);
    renderColumnToggleList();
    renderDimensionFilters();
    renderTable();
}

function createInitialFilters(headers) {
    return benchmarkFilterColumns.reduce((filters, header) => {
        if (headers.includes(header)) {
            filters[header] = "";
        }

        return filters;
    }, {});
}

function getDefaultVisibleColumns(headers) {
    if (headers.length <= 8) {
        return new Set(headers);
    }

    const preferred = new Set([
        ...appState.idColumns,
        appState.meanCol,
        appState.stdCol,
        "ICC",
        "SEM"
    ]);

    const visibleHeaders = headers.filter((header) => preferred.has(header));
    return new Set(visibleHeaders.length ? visibleHeaders : headers.slice(0, Math.min(headers.length, 8)));
}

function renderDimensionFilters() {
    const filterElements = [
        [dom.filterMeasure, "Measure", "All measures"],
        [dom.filterTime, "Time", "All time windows"],
        [dom.filterBand, "Band", "All frequency bands"],
        [dom.filterCluster, "Cluster", "All spatial clusters"]
    ];

    filterElements.forEach(([element, header, label]) => {
        if (!element) {
            return;
        }

        if (!appState.table.headers.includes(header)) {
            element.innerHTML = '<option value="">Not available</option>';
            element.disabled = true;
            return;
        }

        const selectedValue = appState.table.filters[header] || "";
        const options = getSortedUniqueValues(header)
            .map((value) => `<option value="${escapeHtmlAttribute(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(value)}</option>`)
            .join("");

        element.innerHTML = `<option value="">${label}</option>${options}`;
        element.disabled = false;
    });
}

function getSortedUniqueValues(header) {
    return [...new Set(
        appState.globalData
            .map((row) => row[header])
            .filter((value) => value !== null && value !== undefined && value !== "")
    )].sort((valueA, valueB) => String(valueA).localeCompare(String(valueB), undefined, {
        numeric: true,
        sensitivity: "base"
    }));
}

function renderColumnToggleList() {
    dom.columnToggleList.innerHTML = appState.table.headers.map((header, index) => {
        const checked = appState.table.visibleColumns.has(header) ? "checked" : "";
        return `
            <label class="column-toggle-item">
                <input type="checkbox" data-column-index="${index}" ${checked}>
                <span>${escapeHtml(columnRenames[header] || header)}</span>
            </label>
        `;
    }).join("");
}

function handleTableSearch(event) {
    appState.table.searchQuery = event.target.value.trim().toLowerCase();
    appState.table.currentPage = 1;
    renderTable();
}

function handleDimensionFilter(event) {
    const filterKey = event.target.dataset.filterKey;

    if (!filterKey || !(filterKey in appState.table.filters)) {
        return;
    }

    appState.table.filters[filterKey] = event.target.value;
    appState.table.currentPage = 1;
    renderTable();
}

function clearTableFilters() {
    appState.table.searchQuery = "";
    dom.tableSearch.value = "";

    Object.keys(appState.table.filters).forEach((key) => {
        appState.table.filters[key] = "";
    });

    [
        dom.filterMeasure,
        dom.filterTime,
        dom.filterBand,
        dom.filterCluster
    ].forEach((element) => {
        if (element) {
            element.value = "";
        }
    });

    appState.table.currentPage = 1;
    renderTable();
}

function handleColumnToggle(event) {
    if (!(event.target instanceof HTMLInputElement) || event.target.dataset.columnIndex === undefined) {
        return;
    }

    const header = appState.table.headers[Number(event.target.dataset.columnIndex)];

    if (!header) {
        return;
    }

    if (event.target.checked) {
        appState.table.visibleColumns.add(header);
    } else {
        if (appState.table.visibleColumns.size === 1) {
            event.target.checked = true;
            return;
        }

        appState.table.visibleColumns.delete(header);
    }

    renderTable();
}

function handleTableSort(event) {
    const addButton = event.target.closest("[data-add-feature]");

    if (addButton) {
        const compositeKey = addButton.dataset.addFeature;

        if (compositeKey) {
            addFeatureByKey(compositeKey);
        }

        return;
    }

    const button = event.target.closest("[data-sort-header]");

    if (!button) {
        return;
    }

    const header = button.dataset.sortHeader;

    if (!header) {
        return;
    }

    if (appState.table.sortHeader === header) {
        appState.table.sortDirection = appState.table.sortDirection === "asc" ? "desc" : "asc";
    } else {
        appState.table.sortHeader = header;
        appState.table.sortDirection = "asc";
    }

    appState.table.currentPage = 1;
    renderTable();
}

function changePage(direction) {
    const filteredRows = getFilteredRows();
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / appState.table.pageSize));
    const nextPage = clamp(appState.table.currentPage + direction, 1, totalPages);

    if (nextPage === appState.table.currentPage) {
        return;
    }

    appState.table.currentPage = nextPage;
    renderTable();
}

function getFilteredRows() {
    let rows = appState.globalData;

    Object.entries(appState.table.filters).forEach(([header, value]) => {
        if (value) {
            rows = rows.filter((row) => String(row[header] ?? "") === value);
        }
    });

    if (appState.table.searchQuery) {
        rows = rows.filter((row) => (
            appState.table.headers.some((header) => String(row[header] ?? "").toLowerCase().includes(appState.table.searchQuery))
        ));
    }

    const sortedRows = [...rows];

    if (!appState.table.sortHeader) {
        return sortedRows.sort((rowA, rowB) => rowA._originalIndex - rowB._originalIndex);
    }

    const direction = appState.table.sortDirection === "asc" ? 1 : -1;
    const sortHeader = appState.table.sortHeader;

    return sortedRows.sort((rowA, rowB) => {
        const valueA = rowA[sortHeader] ?? "";
        const valueB = rowB[sortHeader] ?? "";

        if (isFiniteNumber(valueA) && isFiniteNumber(valueB)) {
            const difference = Number(valueA) - Number(valueB);
            return difference === 0 ? rowA._originalIndex - rowB._originalIndex : difference * direction;
        }

        const comparison = String(valueA).localeCompare(String(valueB), undefined, {
            numeric: true,
            sensitivity: "base"
        });

        return comparison === 0 ? rowA._originalIndex - rowB._originalIndex : comparison * direction;
    });
}

function renderTable() {
    const visibleHeaders = appState.table.headers.filter((header) => appState.table.visibleColumns.has(header));
    const filteredRows = getFilteredRows();
    const totalRows = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / appState.table.pageSize));
    appState.table.currentPage = clamp(appState.table.currentPage, 1, totalPages);

    const startIndex = totalRows ? (appState.table.currentPage - 1) * appState.table.pageSize : 0;
    const endIndex = Math.min(startIndex + appState.table.pageSize, totalRows);
    const pageRows = filteredRows.slice(startIndex, endIndex);

    dom.tableRowCount.textContent = formatCount(totalRows);
    dom.tableColumnCount.textContent = `${visibleHeaders.length} / ${appState.table.headers.length}`;
    dom.pageIndicator.textContent = `Page ${appState.table.currentPage} of ${totalPages}`;
    dom.prevPage.disabled = appState.table.currentPage === 1;
    dom.nextPage.disabled = appState.table.currentPage === totalPages || totalRows === 0;

    if (!visibleHeaders.length) {
        dom.tableWrapper.innerHTML = '<div class="table-empty">Select at least one column to render the table.</div>';
        dom.tableInfo.textContent = "No columns visible.";
        return;
    }

    if (!pageRows.length) {
        dom.tableWrapper.innerHTML = '<div class="table-empty">No rows match the current exploration filters.</div>';
        dom.tableInfo.textContent = `0 matching rows out of ${formatCount(appState.globalData.length)} total.`;
        return;
    }

    const headerMarkup = [
        '<th class="table-action-header">Benchmark</th>',
        ...visibleHeaders.map((header) => (
            `<th><button class="table-sort" type="button" data-sort-header="${escapeHtmlAttribute(header)}">${escapeHtml(columnRenames[header] || header)}<span class="sort-indicator">${getSortIndicator(header)}</span></button></th>`
        ))
    ].join("");

    const bodyMarkup = pageRows.map((row) => {
        const compositeKey = createCompositeKey(row);
        const canAdd = Boolean(compositeKey) && appState.featureMap.has(compositeKey);
        const isSelected = canAdd && appState.selectedFeatures.some((feature) => feature.key === compositeKey);
        const actionLabel = isSelected ? "Added" : "Add";
        const actionAttributes = canAdd
            ? `data-add-feature="${escapeHtmlAttribute(compositeKey)}"`
            : "disabled";

        return `
            <tr class="${isSelected ? "table-row-selected" : ""}">
                <td class="table-action-cell">
                    <button class="table-action-button" type="button" ${actionAttributes} ${isSelected ? "disabled" : ""}>
                        ${actionLabel}
                    </button>
                </td>
                ${visibleHeaders.map((header) => `<td>${escapeHtml(formatCellValue(row[header]))}</td>`).join("")}
            </tr>
        `;
    }).join("");

    dom.tableWrapper.innerHTML = `
        <div class="table-frame">
            <table class="table-grid">
                <thead>
                    <tr>${headerMarkup}</tr>
                </thead>
                <tbody>
                    ${bodyMarkup}
                </tbody>
            </table>
        </div>
    `;

    dom.tableInfo.textContent = `Showing ${formatCount(startIndex + 1)}-${formatCount(endIndex)} of ${formatCount(totalRows)} matching rows (${formatCount(appState.globalData.length)} total).`;
}

function getSortIndicator(header) {
    if (appState.table.sortHeader !== header) {
        return "Sort";
    }

    return appState.table.sortDirection === "asc" ? "Asc" : "Desc";
}

function formatCellValue(value) {
    if (isFiniteNumber(value)) {
        return Number(value).toFixed(3);
    }

    return String(value ?? "");
}

function addFeatureRow() {
    addFeatureByKey(dom.featureSearch.value.trim(), { focusSearchOnError: true });
}

function addFeatureByKey(compositeKey, options = {}) {
    const { focusSearchOnError = false } = options;

    if (!compositeKey) {
        setCalculatorMessage("Choose a feature before adding it.", "warning");

        if (focusSearchOnError) {
            dom.featureSearch.focus();
        }

        return false;
    }

    if (!appState.featureMap.has(compositeKey)) {
        setCalculatorMessage("Select an exact feature from the list.", "warning");

        if (focusSearchOnError) {
            dom.featureSearch.focus();
        }

        return false;
    }

    if (appState.selectedFeatures.some((feature) => feature.key === compositeKey)) {
        setCalculatorMessage("That feature is already added.", "warning");
        return false;
    }

    const rowData = appState.featureMap.get(compositeKey);
    const meanValue = Number(rowData[appState.meanCol]);
    const stdValue = Number(rowData[appState.stdCol]);

    if (!Number.isFinite(meanValue) || !Number.isFinite(stdValue) || stdValue === 0) {
        setCalculatorMessage("This feature has invalid normative statistics.", "danger");
        return false;
    }

    appState.selectedFeatures.push({
        key: compositeKey,
        rowId: generateRowId(),
        rowIndex: rowData._originalIndex,
        mean: meanValue,
        std: stdValue,
        userValue: null,
        userInput: "",
        badges: appState.idColumns
            .filter((column) => rowData[column])
            .map((column) => ({
                label: column,
                value: rowData[column]
            }))
    });

    dom.featureSearch.value = "";
    renderCalculator();
    renderTable();
    setCalculatorMessage(`Added: ${compositeKey}`, "success");
    return true;
}

function clearAllFeatures() {
    if (!appState.selectedFeatures.length) {
        setCalculatorMessage("No features to clear.", "info");
        return;
    }

    appState.selectedFeatures = [];
    renderCalculator();
    renderTable();
    setCalculatorMessage("Cleared all features.", "info");
}

function exportStructuredReport() {
    if (!appState.selectedFeatures.length) {
        setCalculatorMessage("Add at least one feature before exporting.", "warning");
        return;
    }

    const report = buildStructuredReport();

    if (typeof Blob === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
        console.log(report);
        setCalculatorMessage("Report generated, but this browser cannot download files.", "info");
        return;
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replaceAll(":", "-");

    link.href = url;
    link.download = `normatep-report-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setCalculatorMessage("Report exported.", "success");
}

function buildStructuredReport() {
    const multivariateResult = calculateMahalanobisResult();

    return {
        generatedAt: new Date().toISOString(),
        platform: {
            name: "NormaTEP",
            scope: referenceContext.scope,
            privacy: referenceContext.privacy,
            limitations: referenceContext.limitations
        },
        normativeReference: {
            harmonizedStudies: referenceContext.studies,
            cohortSize: referenceContext.cohortSize,
            femaleCount: referenceContext.femaleCount,
            meanAge: referenceContext.meanAge,
            ageStdDev: referenceContext.ageStdDev,
            ageRange: referenceContext.ageRange,
            totalFeatures: appState.globalData.length,
            measures: countUniqueValues("Measure"),
            timeWindows: countUniqueValues("Time"),
            frequencyBands: countUniqueValues("Band"),
            spatialClusters: countSpatialClusters(),
            globalFeatureLabelsIncluded: true
        },
        demographicContext: {
            ageEffectSummary: referenceContext.ageEffectSummary,
            sexEffectSummary: referenceContext.sexEffectSummary
        },
        activeNormativeFilters: {
            ...appState.table.filters,
            searchQuery: appState.table.searchQuery
        },
        selectedFeatures: appState.selectedFeatures.map((feature) => {
            const zScore = getZScoreData(feature);

            return {
                key: feature.key,
                rowIndex: feature.rowIndex,
                normativeMean: feature.mean,
                normativeStd: feature.std,
                observedValue: feature.userValue,
                zScore: zScore.text === "-" ? null : Number(zScore.text),
                zScoreBand: zScore.caption,
                identifiers: Object.fromEntries(feature.badges.map((badge) => [badge.label, badge.value]))
            };
        }),
        multivariateBenchmark: multivariateResult.ready
            ? {
                d2: multivariateResult.d2,
                pValue: multivariateResult.pValue,
                significant: multivariateResult.significant
            }
            : null
    };
}

function handleCalculatorInput(event) {
    const rowId = event.target.dataset.valueInput;

    if (!rowId) {
        return;
    }

    const feature = appState.selectedFeatures.find((item) => item.rowId === rowId);

    if (!feature) {
        return;
    }

    const observedInputValue = sanitizeObservedInputValue(event.target.value);

    if (event.target.value !== observedInputValue) {
        event.target.value = observedInputValue;
    }

    setObservedValue(feature, observedInputValue);
    updateCalculatorRowOutput(feature);
    updateSelectionInsights();
    renderMahalanobis();
}

function handleCalculatorBeforeInput(event) {
    const input = event.target.closest("[data-value-input]");

    if (!input || !event.data || event.inputType.startsWith("delete") || event.inputType.startsWith("history")) {
        return;
    }

    const selectionStart = input.selectionStart ?? input.value.length;
    const selectionEnd = input.selectionEnd ?? input.value.length;
    const nextValue = `${input.value.slice(0, selectionStart)}${event.data}${input.value.slice(selectionEnd)}`;

    if (!isPotentialObservedFloatInput(nextValue)) {
        event.preventDefault();
    }
}

function handleCalculatorActions(event) {
    const stepButton = event.target.closest("[data-value-step]");

    if (stepButton) {
        handleObservedValueStep(stepButton);
        return;
    }

    const button = event.target.closest("[data-remove-row]");

    if (!button) {
        return;
    }

    const rowId = button.dataset.removeRow;
    const feature = appState.selectedFeatures.find((item) => item.rowId === rowId);
    appState.selectedFeatures = appState.selectedFeatures.filter((item) => item.rowId !== rowId);
    renderCalculator();
    renderTable();

    if (feature) {
        setCalculatorMessage(`Removed: ${feature.key}`, "info");
    }
}

function renderCalculator() {
    renderCalculatorRows();
    updateSelectionInsights();
    renderMahalanobis();
}

function renderCalculatorRows() {
    if (!appState.selectedFeatures.length) {
        dom.calculatorEmpty.hidden = false;
        dom.calculatorContainer.innerHTML = "";
        return;
    }

    dom.calculatorEmpty.hidden = true;
    dom.calculatorContainer.innerHTML = appState.selectedFeatures.map(renderCalculatorRow).join("");
}

function renderCalculatorRow(feature) {
    const zScore = getZScoreData(feature);
    const inputId = `${feature.rowId}-input`;
    const observedInputValue = getObservedInputValue(feature);
    const observedInputInvalid = isObservedInputInvalid(observedInputValue);
    const badgesMarkup = feature.badges.length
        ? feature.badges.map((badge) => (
            `<span class="feature-badge">${escapeHtml(badge.label)}: ${escapeHtml(badge.value)}</span>`
        )).join("")
        : `<span class="feature-badge">${escapeHtml(feature.key)}</span>`;

    return `
        <article class="calculator-row" id="${feature.rowId}">
            <div class="calculator-row-head">
                <div>
                    <div class="calc-label">${badgesMarkup}</div>
                    <div class="calc-meta">Mean: <strong>${feature.mean.toFixed(3)}</strong> | SD: <strong>${feature.std.toFixed(3)}</strong></div>
                </div>
                <button class="remove-feature" type="button" data-remove-row="${feature.rowId}" aria-label="Remove ${escapeHtml(feature.key)}">
                    Remove
                </button>
            </div>

            <div class="calculator-row-body">
                <div class="value-field">
                    <label for="${inputId}">Observed value</label>
                    <div class="observed-input-shell">
                        <input
                            type="text"
                            inputmode="decimal"
                            autocomplete="off"
                            class="form-control observed-value-input"
                            id="${inputId}"
                            data-value-input="${feature.rowId}"
                            value="${escapeHtmlAttribute(observedInputValue)}"
                            placeholder="Enter value"
                            pattern="[+-]?([0-9]+([.,][0-9]*)?|[.,][0-9]+)"
                            aria-invalid="${observedInputInvalid ? "true" : "false"}"
                        >
                        <div class="observed-stepper" role="group" aria-label="Adjust observed value">
                            <button
                                class="observed-step-button observed-step-button-up"
                                type="button"
                                data-value-step="${feature.rowId}"
                                data-step-direction="up"
                                aria-label="Increase observed value"
                            >
                                <span aria-hidden="true"></span>
                            </button>
                            <button
                                class="observed-step-button observed-step-button-down"
                                type="button"
                                data-value-step="${feature.rowId}"
                                data-step-direction="down"
                                aria-label="Decrease observed value"
                            >
                                <span aria-hidden="true"></span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="viz-wrapper">
                    <div class="viz-header">
                        <span>Z-score position</span>
                        <strong data-z-caption="${feature.rowId}">${zScore.caption}</strong>
                    </div>
                    <div class="viz-bar-bg viz-z-gradient">
                        <div class="viz-marker" data-z-marker="${feature.rowId}" style="${zScore.markerStyle}"></div>
                    </div>
                    <div class="viz-scale">
                        <span>&le; -3 SD</span>
                        <span>0</span>
                        <span>&ge; +3 SD</span>
                    </div>
                </div>

                <div class="score-panel">
                    <span>Z-score</span>
                    <strong class="z-score-display ${zScore.className}" data-z-score="${feature.rowId}">${zScore.text}</strong>
                </div>
            </div>
        </article>
    `;
}

function handleObservedValueStep(button) {
    const rowId = button.dataset.valueStep;
    const feature = appState.selectedFeatures.find((item) => item.rowId === rowId);

    if (!feature) {
        return;
    }

    const direction = button.dataset.stepDirection === "down" ? -1 : 1;
    const currentValue = isFiniteNumber(feature.userValue) ? Number(feature.userValue) : 0;
    const nextValue = roundObservedStep(currentValue + (direction * observedValueStep));
    const nextInputValue = formatObservedStepValue(nextValue);
    const input = button.closest(".calculator-row")?.querySelector("[data-value-input]");

    setObservedValue(feature, nextInputValue);

    if (input) {
        input.value = nextInputValue;
        input.focus();
    }

    updateCalculatorRowOutput(feature);
    updateSelectionInsights();
    renderMahalanobis();
}

function setObservedValue(feature, rawValue) {
    feature.userInput = rawValue;
    feature.userValue = parseObservedFloat(rawValue);
}

function updateCalculatorRowOutput(feature) {
    const row = document.getElementById(feature.rowId);

    if (!row) {
        return;
    }

    const zScore = getZScoreData(feature);
    const caption = row.querySelector("[data-z-caption]");
    const marker = row.querySelector("[data-z-marker]");
    const score = row.querySelector("[data-z-score]");
    const input = row.querySelector("[data-value-input]");

    if (caption) {
        caption.textContent = zScore.caption;
    }

    if (marker) {
        marker.setAttribute("style", zScore.markerStyle);
    }

    if (score) {
        score.textContent = zScore.text;
        score.className = `z-score-display ${zScore.className}`;
    }

    if (input) {
        input.setAttribute("aria-invalid", isObservedInputInvalid(input.value) ? "true" : "false");
    }
}

function getZScoreData(feature) {
    if (!isFiniteNumber(feature.userValue)) {
        return {
            text: "-",
            caption: "Add a value",
            className: "is-neutral",
            markerStyle: "display:none;"
        };
    }

    const z = (Number(feature.userValue) - feature.mean) / feature.std;
    const isAlert = Math.abs(z) > 1.96;
    const percent = clamp(((z + 3) / 6) * 100, 0, 100);

    return {
        text: z.toFixed(2),
        caption: isAlert ? "Outside 95%" : "Within 95%",
        className: isAlert ? "is-alert" : "is-good",
        markerStyle: `left:${percent}%; display:block;`
    };
}

function renderMahalanobis() {
    const shouldShow = appState.covMatrix.length > 0 && appState.selectedFeatures.length > 1;
    dom.mahalanobisSection.hidden = !shouldShow;

    if (!shouldShow) {
        dom.d2Marker.style.display = "none";
        dom.d2Display.textContent = "-";
        dom.d2Display.className = "d2-result is-neutral";
        dom.pValDisplay.textContent = "Add at least two complete rows.";
        return;
    }

    const result = calculateMahalanobisResult();

    if (result.error) {
        dom.d2Display.textContent = "Error";
        dom.d2Display.className = "d2-result is-alert";
        dom.pValDisplay.textContent = result.error;
        dom.d2Marker.style.display = "none";
        return;
    }

    if (!result.ready) {
        dom.d2Display.textContent = "-";
        dom.d2Display.className = "d2-result is-neutral";
        dom.pValDisplay.textContent = "Enter a value for every selected feature to compute D2.";
        dom.d2Marker.style.display = "none";
        return;
    }

    const pText = result.pValue < 0.001 ? "p < 0.001" : `p = ${result.pValue.toFixed(3)}`;
    const badgeClass = result.significant ? "status-badge-danger" : "status-badge-ok";
    const badgeLabel = result.significant ? "Significant" : "Within range";

    dom.d2Display.textContent = result.d2.toFixed(3);
    dom.d2Display.className = `d2-result ${result.significant ? "is-alert" : "is-good"}`;
    dom.pValDisplay.innerHTML = `${pText} <span class="status-badge ${badgeClass}">${badgeLabel}</span>`;
    dom.d2Marker.style.left = `${result.percent}%`;
    dom.d2Marker.style.display = "block";
}

function calculateMahalanobisResult() {
    const validFeatures = appState.selectedFeatures.filter((feature) => isFiniteNumber(feature.userValue));

    if (validFeatures.length < 2 || validFeatures.length !== appState.selectedFeatures.length) {
        return { ready: false };
    }

    try {
        const diff = validFeatures.map((feature) => Number(feature.userValue) - feature.mean);
        const k = validFeatures.length;
        const subCovariance = validFeatures.map((featureA) => (
            validFeatures.map((featureB) => {
                const covarianceValue = appState.covMatrix[featureA.rowIndex]?.[featureB.rowIndex];

                if (!Number.isFinite(covarianceValue)) {
                    throw new Error("Covariance index out of bounds.");
                }

                return covarianceValue;
            })
        ));

        const inverseCovariance = invertMatrix(subCovariance);
        const d2 = quadraticForm(diff, inverseCovariance);
        const pValue = 1 - chiSquareCdf(d2, k);
        const criticalValue = chiSquareInv(0.95, k);
        const percent = clamp((d2 / (criticalValue * 1.5)) * 100, 0, 100);

        return {
            ready: true,
            d2,
            pValue,
            significant: pValue < 0.05,
            percent
        };
    } catch (error) {
        console.error(error);
        return {
            ready: false,
            error: "Unable to evaluate the covariance sub-matrix for the current feature set."
        };
    }
}

function invertMatrix(matrix) {
    const size = matrix.length;
    const augmented = matrix.map((row, rowIndex) => {
        if (row.length !== size) {
            throw new Error("Matrix must be square.");
        }

        return [
            ...row.map((value) => Number(value)),
            ...Array.from({ length: size }, (_, columnIndex) => (rowIndex === columnIndex ? 1 : 0))
        ];
    });

    for (let column = 0; column < size; column += 1) {
        let pivotRow = column;

        for (let rowIndex = column + 1; rowIndex < size; rowIndex += 1) {
            if (Math.abs(augmented[rowIndex][column]) > Math.abs(augmented[pivotRow][column])) {
                pivotRow = rowIndex;
            }
        }

        if (Math.abs(augmented[pivotRow][column]) < 1e-12) {
            throw new Error("Matrix is singular.");
        }

        if (pivotRow !== column) {
            [augmented[column], augmented[pivotRow]] = [augmented[pivotRow], augmented[column]];
        }

        const pivotValue = augmented[column][column];

        for (let currentColumn = 0; currentColumn < size * 2; currentColumn += 1) {
            augmented[column][currentColumn] /= pivotValue;
        }

        for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
            if (rowIndex === column) {
                continue;
            }

            const factor = augmented[rowIndex][column];

            for (let currentColumn = 0; currentColumn < size * 2; currentColumn += 1) {
                augmented[rowIndex][currentColumn] -= factor * augmented[column][currentColumn];
            }
        }
    }

    return augmented.map((row) => row.slice(size));
}

function quadraticForm(vector, matrix) {
    return vector.reduce((total, value, rowIndex) => {
        const rowTotal = matrix[rowIndex].reduce((sum, coefficient, columnIndex) => (
            sum + coefficient * vector[columnIndex]
        ), 0);

        return total + value * rowTotal;
    }, 0);
}

function chiSquareCdf(value, degreesOfFreedom) {
    if (value <= 0) {
        return 0;
    }

    return regularizedGammaP(degreesOfFreedom / 2, value / 2);
}

function chiSquareInv(probability, degreesOfFreedom) {
    if (probability <= 0) {
        return 0;
    }

    if (probability >= 1) {
        return Number.POSITIVE_INFINITY;
    }

    let lower = 0;
    let upper = Math.max(1, degreesOfFreedom);

    while (chiSquareCdf(upper, degreesOfFreedom) < probability) {
        upper *= 2;

        if (upper > 1e6) {
            break;
        }
    }

    for (let iteration = 0; iteration < 80; iteration += 1) {
        const midpoint = (lower + upper) / 2;
        const cdf = chiSquareCdf(midpoint, degreesOfFreedom);

        if (cdf < probability) {
            lower = midpoint;
        } else {
            upper = midpoint;
        }
    }

    return (lower + upper) / 2;
}

function regularizedGammaP(a, x) {
    if (x <= 0) {
        return 0;
    }

    if (x < a + 1) {
        return gammaSeries(a, x);
    }

    return 1 - gammaContinuedFraction(a, x);
}

function gammaSeries(a, x) {
    let sum = 1 / a;
    let term = sum;

    for (let iteration = 1; iteration < 200; iteration += 1) {
        term *= x / (a + iteration);
        sum += term;

        if (Math.abs(term) < Math.abs(sum) * 1e-12) {
            break;
        }
    }

    return sum * Math.exp(-x + a * Math.log(x) - gammaLog(a));
}

function gammaContinuedFraction(a, x) {
    let b = x + 1 - a;
    let c = 1 / 1e-30;
    let d = 1 / b;
    let h = d;

    for (let iteration = 1; iteration < 200; iteration += 1) {
        const an = -iteration * (iteration - a);
        b += 2;
        d = an * d + b;

        if (Math.abs(d) < 1e-30) {
            d = 1e-30;
        }

        c = b + an / c;

        if (Math.abs(c) < 1e-30) {
            c = 1e-30;
        }

        d = 1 / d;
        const delta = d * c;
        h *= delta;

        if (Math.abs(delta - 1) < 1e-12) {
            break;
        }
    }

    return Math.exp(-x + a * Math.log(x) - gammaLog(a)) * h;
}

function gammaLog(value) {
    const coefficients = [
        676.5203681218851,
        -1259.1392167224028,
        771.3234287776531,
        -176.6150291621406,
        12.507343278686905,
        -0.13857109526572012,
        9.984369578019572e-6,
        1.5056327351493116e-7
    ];

    if (value < 0.5) {
        return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - gammaLog(1 - value);
    }

    const adjusted = value - 1;
    let accumulator = 0.9999999999998099;

    coefficients.forEach((coefficient, index) => {
        accumulator += coefficient / (adjusted + index + 1);
    });

    const t = adjusted + coefficients.length - 0.5;
    return 0.9189385332046727 + (adjusted + 0.5) * Math.log(t) - t + Math.log(accumulator);
}

function updateSelectionInsights() {
    const selectedCount = appState.selectedFeatures.length;
    const readyCount = appState.selectedFeatures.filter((feature) => isFiniteNumber(feature.userValue)).length;
    const readyForMahalanobis = selectedCount > 1 && readyCount === selectedCount && appState.covMatrix.length > 0;

    dom.selectionChip.textContent = `${selectedCount} feature${selectedCount === 1 ? "" : "s"} selected`;
    dom.selectedCount.textContent = String(selectedCount);
    dom.readyCount.textContent = `${readyCount} / ${selectedCount}`;
    dom.covarianceStatus.textContent = selectedCount < 2
        ? "Need 2+"
        : readyForMahalanobis
            ? "Ready"
            : appState.covMatrix.length
                ? "Partial"
                : "Unavailable";
    dom.exportReportButton.disabled = selectedCount === 0;
}

function setCalculatorMessage(message, tone) {
    dom.calculatorMessage.textContent = message;
    dom.calculatorMessage.className = `inline-message inline-message-${tone}`;
}

function formatCount(value) {
    return Number(value || 0).toLocaleString();
}

function generateRowId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return `calc-${window.crypto.randomUUID()}`;
    }

    return `calc-${Math.random().toString(36).slice(2, 11)}`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeHtmlAttribute(value) {
    return escapeHtml(value);
}

function formatInputValue(value) {
    return value === null || value === undefined || Number.isNaN(value) ? "" : String(value);
}

function getObservedInputValue(feature) {
    return typeof feature.userInput === "string" ? feature.userInput : formatInputValue(feature.userValue);
}

function parseObservedFloat(value) {
    const normalizedValue = normalizeObservedNumber(value);

    if (!normalizedValue || !isObservedFloat(normalizedValue)) {
        return null;
    }

    const numericValue = Number(normalizedValue);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeObservedNumber(value) {
    return String(value ?? "").trim().replace(",", ".");
}

function sanitizeObservedInputValue(value) {
    return String(value ?? "").split("").reduce((cleanValue, character) => {
        if ((character === "+" || character === "-") && cleanValue === "") {
            return character;
        }

        if ((character === "." || character === ",") && !cleanValue.includes(".") && !cleanValue.includes(",")) {
            return `${cleanValue}${character}`;
        }

        if (/\d/.test(character)) {
            return `${cleanValue}${character}`;
        }

        return cleanValue;
    }, "");
}

function isObservedFloat(value) {
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value);
}

function isPotentialObservedFloatInput(value) {
    const normalizedValue = normalizeObservedNumber(value);
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d*|\d*)$/.test(normalizedValue);
}

function isObservedInputInvalid(value) {
    const normalizedValue = normalizeObservedNumber(value);
    return normalizedValue !== "" && !isPotentialObservedFloatInput(normalizedValue);
}

function roundObservedStep(value) {
    return Math.round((value + Number.EPSILON) / observedValueStep) * observedValueStep;
}

function formatObservedStepValue(value) {
    return String(Number(value.toFixed(6)));
}

function isFiniteNumber(value) {
    if (value === null || value === undefined) {
        return false;
    }

    if (typeof value === "string" && value.trim() === "") {
        return false;
    }

    return Number.isFinite(Number(value));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
