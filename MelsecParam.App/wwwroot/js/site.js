"use strict";

(() => {
  const elements = {
    catalogStatus: document.querySelector("#catalogStatus"),
    seriesSelect: document.querySelector("#seriesSelect"),
    modelSelect: document.querySelector("#modelSelect"),
    memorySelect: document.querySelector("#memorySelect"),
    modelMeta: document.querySelector("#modelMeta"),
    allocationFields: document.querySelector("#allocationFields"),
    sharedMemoryPanel: document.querySelector("#sharedMemoryPanel"),
    toolBadge: document.querySelector("#toolBadge"),
    pasteInput: document.querySelector("#pasteInput"),
    applyPasteButton: document.querySelector("#applyPasteButton"),
    clearPasteButton: document.querySelector("#clearPasteButton"),
    excelOutput: document.querySelector("#excelOutput"),
    copyExcelButton: document.querySelector("#copyExcelButton"),
    copyStatus: document.querySelector("#copyStatus"),
    correctUnitsButton: document.querySelector("#correctUnitsButton"),
    deviceActionStatus: document.querySelector("#deviceActionStatus"),
    allocateFileRegisterButton: document.querySelector("#allocateFileRegisterButton"),
    resetButton: document.querySelector("#resetButton"),
    summaryCards: document.querySelector("#summaryCards"),
    errorPanel: document.querySelector("#errorPanel"),
    overallStatus: document.querySelector("#overallStatus"),
    deviceCount: document.querySelector("#deviceCount"),
    deviceFormHost: document.querySelector("#deviceFormHost"),
    specificationPanel: document.querySelector("#specificationPanel"),
    specificationContent: document.querySelector("#specificationContent"),
    sourceContent: document.querySelector("#sourceContent")
  };

  const state = {
    catalog: null,
    model: null,
    ruleSet: null,
    memoryOption: null,
    devices: [],
    capacities: new Map()
  };

  document.addEventListener("DOMContentLoaded", initialise);

  async function initialise() {
    wireEvents();
    try {
      const response = await fetch("/api/catalog", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.catalog = await response.json();
      populateSeries();
      populateModels(elements.seriesSelect.value);
      elements.catalogStatus.textContent = `${state.catalog.models.length} 型式定義 / ${state.catalog.ruleSets.length} 計算ルール`;
      selectModel(elements.modelSelect.value);
    } catch (error) {
      elements.catalogStatus.textContent = "定義の読み込みに失敗";
      showErrors([`JSON定義を読み込めませんでした: ${error.message}`]);
    }
  }

  function wireEvents() {
    elements.seriesSelect.addEventListener("change", () => {
      populateModels(elements.seriesSelect.value);
      selectModel(elements.modelSelect.value);
    });
    elements.modelSelect.addEventListener("change", () => selectModel(elements.modelSelect.value));
    elements.memorySelect.addEventListener("change", () => {
      state.memoryOption = findById(state.catalog.memoryOptions, elements.memorySelect.value);
      renderAllocationFields(false);
      renderModelMeta();
      renderModelSpecifications();
      calculate();
    });
    elements.applyPasteButton.addEventListener("click", () => applyPaste(elements.pasteInput.value));
    elements.clearPasteButton.addEventListener("click", () => { elements.pasteInput.value = ""; });
    elements.copyExcelButton.addEventListener("click", copyExcelOutput);
    elements.correctUnitsButton.addEventListener("click", correctSettingUnits);
    elements.allocateFileRegisterButton.addEventListener("click", allocateAllToFileRegister);
    elements.resetButton.addEventListener("click", resetDefaults);
  }

  function populateSeries() {
    elements.seriesSelect.replaceChildren();
    const seriesNames = [...new Set(state.catalog.models.map(model => model.series))];
    for (const series of seriesNames) elements.seriesSelect.add(new Option(series, series));
    elements.seriesSelect.disabled = seriesNames.length <= 1;
  }

  function populateModels(series) {
    elements.modelSelect.replaceChildren();
    const models = state.catalog.models.filter(model => model.series === series);
    for (const model of models) elements.modelSelect.add(new Option(model.displayName, model.id));
    elements.modelSelect.disabled = models.length === 0;
  }

  function selectModel(id) {
    state.model = findById(state.catalog.models, id);
    state.ruleSet = findById(state.catalog.ruleSets, state.model.ruleSetId);
    state.devices = mergeDevices(state.ruleSet.devices, state.model.deviceOverrides);
    populateMemoryOptions();
    state.capacities = new Map(state.model.areas.map(area => [area.id, area.defaultKWords]));
    renderModelMeta();
    renderAllocationFields(true);
    renderDeviceTable();
    updateFileRegisterButton();
    renderModelSpecifications();
    renderSources();
    calculate();
    elements.deviceActionStatus.textContent = "初期値を設定しました。入力中は自動補正しません。";
  }

  function populateMemoryOptions() {
    elements.memorySelect.replaceChildren();
    const allowed = new Set(state.model.allowedMemoryOptionIds);
    const options = state.catalog.memoryOptions.filter(item => allowed.has(item.id));
    for (const item of options) elements.memorySelect.add(new Option(item.displayName, item.id));
    state.memoryOption = options[0] ?? findById(state.catalog.memoryOptions, "none");
    elements.memorySelect.value = state.memoryOption.id;
    elements.memorySelect.disabled = options.length <= 1;
  }

  function renderModelMeta() {
    const names = state.model.modelNames?.length ? state.model.modelNames.join(" / ") : state.model.displayName;
    const option = state.memoryOption;
    const optionDetails = [];
    if (option.productName) optionDetails.push(option.productName);
    if (option.supersedesProductName) optionDetails.push(`${option.supersedesProductName} の後継`);
    if (option.note) optionDetails.push(option.note);

    elements.toolBadge.textContent = state.model.engineeringTool;
    elements.modelMeta.replaceChildren(
      chip(state.model.series),
      chip(names),
      chip(`ルール: ${state.ruleSet.displayName}`),
      ...(optionDetails.length ? [chip(optionDetails.join(" / "))] : [])
    );
  }

  function renderAllocationFields(reset) {
    elements.allocationFields.replaceChildren();
    const option = state.memoryOption;
    for (const area of state.model.areas) {
      if (area.id === "local") continue;

      const limit = areaLimit(area, option);
      let value = reset ? area.defaultKWords : (state.capacities.get(area.id) ?? area.defaultKWords);
      if (area.capacityFromMemoryOption && option.id !== "none") {
        value = option.fileCapacityOverrideKPoints ?? (area.defaultKWords + option.fileCapacityAddedKPoints);
      }
      value = Math.min(Math.max(value, area.minKWords), limit);
      state.capacities.set(area.id, value);

      const wrapper = document.createElement("label");
      wrapper.className = "field capacity-field";
      wrapper.innerHTML = `<span>${escapeHtml(area.displayName)}</span>`;
      const input = document.createElement("input");
      input.type = "number";
      input.min = String(area.minKWords);
      input.max = String(limit);
      input.step = "1";
      input.value = formatPlain(value);
      input.dataset.areaId = area.id;
      input.disabled = !area.configurable || (area.capacityFromMemoryOption && option.id !== "none");
      input.addEventListener("input", () => {
        state.capacities.set(area.id, Number(input.value));
        calculate();
      });
      wrapper.append(input);
      const limitText = document.createElement("div");
      limitText.className = "limit";
      limitText.textContent = `${formatPlain(area.minKWords)} ～ ${formatPlain(limit)} ${area.unitLabel}`;
      wrapper.append(limitText);
      elements.allocationFields.append(wrapper);
    }
  }

  function renderDeviceTable() {
    const gxWorks2 = state.ruleSet.id === "gxworks2";
    elements.deviceFormHost.className = `gx-form-host ${gxWorks2 ? "gxworks2-form" : "gxworks3-form"}`;
    elements.deviceFormHost.innerHTML = gxWorks2 ? gxWorks2Markup() : gxWorks3Markup();
    for (const device of state.devices) {
      const body = gxWorks2 && device.areaId !== "device"
        ? elements.deviceFormHost.querySelector("[data-device-body='file']")
        : elements.deviceFormHost.querySelector("[data-device-body='main']");
      if (!body) continue;
      body.append(createDeviceRow(device, gxWorks2));
    }
    elements.deviceCount.textContent = `${state.devices.length} デバイス`;
  }

  function gxWorks2Markup() {
    const hasFileDevices = state.devices.some(device => device.areaId !== "device");
    return `
      <div class="gx-dialog-caption">GX Works2形式 ― デバイス設定</div>
      <div class="gx-table-scroll">
        <table class="gx-device-table gx2-table">
          <thead><tr><th></th><th>記号</th><th>進</th><th>デバイス<br>点数</th><th>使用範囲</th><th>ラッチ(1)<br>先頭</th><th>ラッチ(1)<br>最終</th></tr></thead>
          <tbody data-device-body="main"></tbody>
        </table>
        <div class="gx2-device-total"><strong>デバイス合計</strong><output data-gx-total="device">0.0</output><span>Kワード</span><span class="gx-total-kind">ワードデバイス</span></div>
        ${hasFileDevices ? `
          <div class="gx2-subtitle">ファイルレジスタ拡張設定</div>
          <div class="gx2-capacity-line"><span>容量</span><output data-gx-file-capacity>0</output><span>K点</span></div>
          <table class="gx-device-table gx2-table gx2-file-table">
            <thead><tr><th></th><th>記号</th><th>進</th><th>デバイス<br>点数</th><th>使用範囲</th><th>ラッチ(1)<br>先頭</th><th>ラッチ(1)<br>最終</th></tr></thead>
            <tbody data-device-body="file"></tbody>
          </table>` : ""}
      </div>`;
  }

  function gxWorks3Markup() {
    const capacityRows = state.model.areas
      .filter(area => area.id !== "local")
      .map(area => `<tr class="gx3-capacity-row"><th colspan="2">${escapeHtml(area.displayName)} 容量</th><td colspan="2"><output data-area-capacity="${escapeHtml(area.id)}">0</output> Kワード</td><td colspan="2"></td></tr>`)
      .join("");
    return `
      <div class="gx-dialog-caption">GX Works3形式 ― デバイス設定</div>
      <div class="gx-table-scroll">
        <table class="gx-device-table gx3-table">
          <thead>
            <tr><th rowspan="2">項目</th><th rowspan="2">記号</th><th colspan="2">デバイス</th><th colspan="2">ローカルデバイス</th></tr>
            <tr><th>点数</th><th>範囲</th><th>先頭</th><th>最終</th></tr>
          </thead>
          <tbody data-device-body="main"></tbody>
          <tfoot>
            ${capacityRows}
            <tr><th colspan="2">デバイス合計</th><td colspan="2"><output data-gx-total="device">0.0</output> Kワード</td><td colspan="2"></td></tr>
            <tr><th colspan="2">ワードデバイス合計</th><td colspan="2"><output data-gx-total="word">0.0</output> Kワード</td><td colspan="2"></td></tr>
            <tr><th colspan="2">ビットデバイス合計</th><td colspan="2"><output data-gx-total="bit">0.0</output> Kビット</td><td colspan="2"></td></tr>
          </tfoot>
        </table>
      </div>`;
  }

  function createDeviceRow(device, gxWorks2) {
    const row = document.createElement("tr");
    row.dataset.symbol = device.symbol;
    if (gxWorks2) {
      row.innerHTML = `
        <td class="gx-device-name">${escapeHtml(device.name)}</td>
        <td class="device-symbol">${escapeHtml(gx2Symbol(device.symbol))}</td>
        <td class="gx-radix">${device.radix}</td>
        <td class="gx-point-cell"></td>
        <td class="device-range">-</td>
        <td class="gx-latch-cell"></td>
        <td class="gx-latch-cell"></td>`;
    } else {
      row.innerHTML = `
        <td class="gx-device-name">${escapeHtml(device.name)}</td>
        <td class="device-symbol">${escapeHtml(device.symbol)}</td>
        <td class="gx-point-cell"></td>
        <td class="device-range">-</td>
        <td class="gx-local-cell"></td>
        <td class="gx-local-cell"></td>`;
    }

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.value = formatPointInput(device.defaultPoints);
    input.disabled = device.fixed;
    input.dataset.symbol = device.symbol;
    input.setAttribute("aria-label", `${device.symbol} ${device.name} 点数`);
    input.addEventListener("input", () => {
      elements.deviceActionStatus.textContent = device.settingUnit > 1
        ? `編集中: ${device.symbol} は ${formatNumber(device.settingUnit)}点単位（必要なら補正ボタンを押してください）`
        : `編集中: ${device.symbol}`;
      calculate();
    });
    input.addEventListener("blur", () => {
      const value = parsePointText(input.value);
      if (value != null) input.value = formatPointInput(value);
      calculate();
    });
    input.addEventListener("paste", event => pasteIntoTable(event, device.symbol));
    row.querySelector(".gx-point-cell").append(input);
    return row;
  }

  function gx2Symbol(symbol) {
    if (symbol === "ZR") return "ZR(R)";
    if (symbol === "D(拡張)") return "D";
    if (symbol === "W(拡張)") return "W";
    return symbol;
  }

  function renderSources() {
    const notes = state.model.notes ?? [];
    const sources = state.model.sources ?? [];
    const sourceItems = sources.map(source => `<li>${escapeHtml(source.manual)} / 掲載ページ ${source.pages.map(escapeHtml).join(", ")}</li>`).join("");
    const noteItems = notes.map(note => `<li>${escapeHtml(note)}</li>`).join("");
    elements.sourceContent.innerHTML = `
      ${noteItems ? `<h3>注意事項</h3><ul>${noteItems}</ul>` : ""}
      <p><strong>SDメモリーカード:</strong> デバイスデータ置き場には使用せず、バックアップ用途のみとして本画面の選択肢から除外しています。</p>
      <h3>参照マニュアル</h3>
      <ul>${sourceItems || "<li>機種定義JSONの注記を参照してください。</li>"}</ul>`;
  }

  function renderModelSpecifications() {
    const drives = state.model.memoryDrives ?? [];
    const auxiliary = auxiliaryDevices();
    const hasSpecifications = state.model.programCapacityKSteps != null || state.model.programCapacityText || drives.length || auxiliary.length;
    elements.specificationPanel.hidden = !hasSpecifications;
    if (!hasSpecifications) {
      elements.specificationContent.replaceChildren();
      return;
    }

    const programText = programCapacityText();
    const program = !programText ? "" : `
      <div class="spec-block spec-program">
        <h3>プログラム容量</h3>
        <div class="spec-primary-value"><strong>${escapeHtml(programText)}</strong></div>
      </div>`;
    const driveRows = drives.map(drive => {
      const capacity = memoryDriveCapacityText(drive);
      return `<tr>
        <td>${escapeHtml(drive.displayName)}${drive.drive ? `（ドライブ${escapeHtml(drive.drive)}）` : ""}</td>
        <td>${escapeHtml(capacity)}</td>
        <td>${escapeHtml(drive.note ?? "")}</td>
      </tr>`;
    }).join("");
    const auxiliaryRows = auxiliary.map(item => `<tr>
      <td>${escapeHtml(item.displayName)}</td>
      <td class="device-symbol">${escapeHtml(item.symbol)}</td>
      <td>${escapeHtml(item.pointsText ?? (item.points == null ? "－" : `${formatNumber(item.points)} 点`))}</td>
      <td>${escapeHtml(item.range ?? "")}</td>
    </tr>`).join("");

    elements.specificationContent.innerHTML = `
      ${program}
      ${driveRows ? `<div class="spec-block"><h3>メモリ容量</h3><div class="spec-table-scroll"><table class="spec-table"><thead><tr><th>メモリ</th><th>容量</th><th>備考</th></tr></thead><tbody>${driveRows}</tbody></table></div></div>` : ""}
      ${auxiliaryRows ? `<div class="spec-block"><h3>補助・システムデバイス</h3><div class="spec-table-scroll"><table class="spec-table"><thead><tr><th>項目</th><th>記号</th><th>点数</th><th>範囲</th></tr></thead><tbody>${auxiliaryRows}</tbody></table></div></div>` : ""}
      <div class="spec-block"><h3>デバイス使用範囲（K省略なし）</h3><div class="spec-table-scroll"><table class="spec-table"><thead><tr><th>項目</th><th>記号</th><th>設定点数</th><th>実際に使用できる範囲</th></tr></thead><tbody data-device-range-spec></tbody></table></div></div>`;
  }

  function calculate() {
    if (!state.model) return;
    const errors = [];
    const areaUsed = new Map(state.model.areas.map(area => [area.id, Number(area.overheadWords || 0)]));
    const areaWordUsed = new Map(state.model.areas.map(area => [area.id, Number(area.overheadWords || 0)]));
    const areaBitUsed = new Map(state.model.areas.map(area => [area.id, 0]));

    for (const device of state.devices) {
      const input = elements.deviceFormHost.querySelector(`input[data-symbol="${cssEscape(device.symbol)}"]`);
      const row = input.closest("tr");
      const value = parsePointText(input.value);
      const rowErrors = [];
      if (value == null) rowErrors.push("0以上の整数またはK表記");
      const safeValue = value ?? 0;
      if (safeValue > device.maxPoints) rowErrors.push(`最大 ${formatNumber(device.maxPoints)} 点`);
      if (Number.isInteger(safeValue) && safeValue % device.settingUnit !== 0) rowErrors.push(`${formatNumber(device.settingUnit)} 点単位`);
      if (rowErrors.length) errors.push(`${device.symbol}: ${rowErrors.join(" / ")}`);

      const words = safeValue * (device.wordCostPerPoint + device.bitCostPerPoint / 16);
      areaUsed.set(device.areaId, (areaUsed.get(device.areaId) ?? 0) + words);
      areaWordUsed.set(device.areaId, (areaWordUsed.get(device.areaId) ?? 0) + safeValue * device.wordCostPerPoint);
      areaBitUsed.set(device.areaId, (areaBitUsed.get(device.areaId) ?? 0) + safeValue * device.bitCostPerPoint);
      row.classList.toggle("row-error", rowErrors.length > 0);
      row.title = rowErrors.join(" / ");
      const range = row.querySelector(".device-range");
      if (range) range.textContent = deviceRange(device, safeValue);
    }

    updateDeviceRangeSpecification();

    validateAreaCapacities(errors);
    validateSharedMemory(errors);
    updateGxReferenceTotals(areaUsed, areaWordUsed, areaBitUsed);
    renderSummaries(areaUsed, errors);
    showErrors(errors);
    renderExcelOutput(errors, areaUsed);
  }

  function updateDeviceRangeSpecification() {
    const body = elements.specificationContent.querySelector("[data-device-range-spec]");
    if (!body) return;
    const inputMap = deviceInputMap();
    body.innerHTML = state.devices.map(device => {
      const points = parsePointText(inputMap.get(device.symbol)?.value) ?? 0;
      return `<tr>
        <td>${escapeHtml(device.name)}</td>
        <td class="device-symbol">${escapeHtml(rangeDeviceSymbol(device.symbol))}</td>
        <td>${formatNumber(points)} 点</td>
        <td class="device-range">${escapeHtml(deviceRange(device, points))}</td>
      </tr>`;
    }).join("");
  }

  function updateGxReferenceTotals(areaUsed, areaWordUsed, areaBitUsed) {
    const totalWords = [...areaUsed.values()].reduce((sum, value) => sum + value, 0);
    const wordWords = [...areaWordUsed.values()].reduce((sum, value) => sum + value, 0);
    const bitPoints = [...areaBitUsed.values()].reduce((sum, value) => sum + value, 0);
    setOutput("[data-gx-total='device']", formatWords(totalWords / 1024));
    setOutput("[data-gx-total='word']", formatWords(wordWords / 1024));
    setOutput("[data-gx-total='bit']", formatWords(bitPoints / 1024));

    const fileArea = state.model.areas.find(area => area.id !== "device" && area.id !== "local");
    setOutput("[data-gx-file-capacity]", fileArea ? formatWords(Number(state.capacities.get(fileArea.id)) || 0) : "0");
    for (const area of state.model.areas) {
      setOutput(`[data-area-capacity="${cssEscape(area.id)}"]`, formatWords(Number(state.capacities.get(area.id)) || 0));
    }
  }

  function setOutput(selector, value) {
    const output = elements.deviceFormHost.querySelector(selector);
    if (output) output.textContent = value;
  }

  function validateAreaCapacities(errors) {
    for (const area of state.model.areas) {
      if (area.id === "local") continue;
      const value = Number(state.capacities.get(area.id));
      const limit = areaLimit(area, state.memoryOption);
      if (!Number.isFinite(value) || value < area.minKWords || value > limit) {
        errors.push(`${area.displayName}: ${formatPlain(area.minKWords)}～${formatPlain(limit)} Kワードで入力してください。`);
      }
    }
  }

  function validateSharedMemory(errors) {
    const base = state.model.sharedMemoryBaseKWords;
    if (base == null) {
      elements.sharedMemoryPanel.hidden = true;
      return;
    }
    const total = base + (state.memoryOption.sharedMemoryAddedKWords || 0);
    const localArea = state.model.areas.find(area => area.id === "local");
    const allocated = state.model.sharedAreaIds
      .filter(id => id !== "local")
      .reduce((sum, id) => sum + (Number(state.capacities.get(id)) || 0), 0);
    const residual = total - allocated;
    if (localArea) state.capacities.set("local", Math.max(0, residual));
    if (residual < 0) errors.push(`共有メモリ割付が ${formatWords(Math.abs(residual))} Kワード超過しています。`);

    elements.sharedMemoryPanel.hidden = false;
    elements.sharedMemoryPanel.classList.toggle("over", residual < 0);
    elements.sharedMemoryPanel.innerHTML = `<strong>共有メモリ ${formatWords(total)} Kワード</strong>　割付 ${formatWords(allocated)} Kワード　<span>ローカル/未割付 ${formatWords(Math.max(0, residual))} Kワード</span>`;
  }

  function renderSummaries(areaUsed, errors) {
    elements.summaryCards.replaceChildren();
    const statuses = [];
    for (const area of state.model.areas) {
      if (area.id === "local") continue;
      const capacityK = Number(state.capacities.get(area.id)) || 0;
      const capacityWords = capacityK * 1024;
      const usedWords = areaUsed.get(area.id) ?? 0;
      const percent = capacityWords === 0 ? (usedWords === 0 ? 0 : Infinity) : usedWords / capacityWords * 100;
      const status = percent > 100 ? "over" : percent >= 90 ? "warning" : "ok";
      statuses.push(status);

      const card = document.createElement("article");
      card.className = `summary-card ${status}`;
      card.innerHTML = `
        <div class="summary-card-head"><h3>${escapeHtml(area.displayName)}</h3><span class="status-pill status-${status}">${statusLabel(status)}</span></div>
        <div class="summary-numbers"><strong>${formatPercent(percent)}</strong><span>%</span></div>
        <div class="meter"><span style="width:${Math.min(Number.isFinite(percent) ? percent : 100, 100)}%"></span></div>
        <div class="summary-foot">使用 ${formatWords(usedWords / 1024)} / 容量 ${formatWords(capacityK)} Kワード</div>`;
      elements.summaryCards.append(card);
    }
    const overall = errors.length || statuses.includes("over") ? "over" : statuses.includes("warning") ? "warning" : "ok";
    setStatus(elements.overallStatus, overall, overall === "over" ? "容量超過 / 要確認" : statusLabel(overall));
  }

  function auxiliaryDevices() {
    if (state.model.auxiliaryDevices?.length) return state.model.auxiliaryDevices;
    if (!state.model.systemDeviceProfileId) return [];
    return state.catalog.systemDeviceProfiles?.find(item => item.id === state.model.systemDeviceProfileId)?.devices ?? [];
  }

  function programCapacityText() {
    return state.model.programCapacityKSteps == null
      ? (state.model.programCapacityText ?? "")
      : `${formatWords(state.model.programCapacityKSteps)} Kステップ`;
  }

  function memoryDriveCapacityText(drive) {
    if (drive.capacityKBytes == null) return drive.capacityText ?? "－";
    const added = drive.expandWithMemory ? (state.memoryOption.sizeMBytes || 0) * 1024 : 0;
    return `${formatWords(drive.capacityKBytes + added)} Kバイト`;
  }

  function renderExcelOutput(errors, areaUsed) {
    const lines = [];
    const add = (...cells) => lines.push(cells.map(tsvCell).join("\t"));
    const names = state.model.modelNames?.length ? state.model.modelNames.join(" / ") : state.model.displayName;

    add("MELSEC PCパラメータ設定資料");
    add("PLC型式", state.model.displayName);
    add("対象形名", names);
    add("シリーズ", state.model.series);
    add("エンジニアリングツール", state.model.engineeringTool);
    add("メモリ/保持オプション", state.memoryOption.displayName);
    add("総合判定", elements.overallStatus.textContent);
    if (errors.length) add("要確認事項", errors.join(" / "));

    add();
    add("容量判定");
    add("領域", "使用量(Kワード)", "設定容量(Kワード)", "使用率(%)", "判定");
    for (const area of state.model.areas) {
      const capacityK = Number(state.capacities.get(area.id)) || 0;
      if (area.id === "local") {
        add(area.displayName, "", formatPlain(capacityK), "", "自動残容量");
        continue;
      }
      const usedK = (areaUsed.get(area.id) ?? 0) / 1024;
      const percent = capacityK === 0 ? (usedK === 0 ? 0 : Infinity) : usedK / capacityK * 100;
      const status = percent > 100 ? "over" : percent >= 90 ? "warning" : "ok";
      add(area.displayName, formatPlainNumber(usedK), formatPlain(capacityK), Number.isFinite(percent) ? percent.toFixed(1) : "∞", statusLabel(status));
    }

    add();
    add("デバイス設定");
    add("項目", "記号", "進数", "設定単位(点)", "初期点数", "設定点数", "使用範囲", "容量領域", "使用ワード数", "変更");
    const inputMap = deviceInputMap();
    for (const device of state.devices) {
      const input = inputMap.get(device.symbol);
      const points = parsePointText(input?.value) ?? 0;
      const usedWords = points * (device.wordCostPerPoint + device.bitCostPerPoint / 16);
      const areaName = state.model.areas.find(area => area.id === device.areaId)?.displayName ?? device.areaId;
      add(device.name, device.symbol, device.radix, device.settingUnit, device.defaultPoints, points, deviceRange(device, points), areaName, formatPlainNumber(usedWords), device.fixed ? "固定" : "変更可");
    }

    const program = programCapacityText();
    if (program) {
      add();
      add("プログラム容量");
      add("項目", "容量");
      add("プログラム容量", program);
    }

    const drives = state.model.memoryDrives ?? [];
    if (drives.length) {
      add();
      add("メモリ容量");
      add("メモリ", "ドライブ", "容量", "備考");
      for (const drive of drives) add(drive.displayName, drive.drive ? `ドライブ${drive.drive}` : "", memoryDriveCapacityText(drive), drive.note ?? "");
    }

    const auxiliary = auxiliaryDevices();
    if (auxiliary.length) {
      add();
      add("補助・システムデバイス");
      add("項目", "記号", "点数", "範囲");
      for (const item of auxiliary) {
        const points = item.pointsText ?? (item.points == null ? "－" : `${item.points} 点`);
        add(item.displayName, item.symbol, points, item.range ?? "");
      }
    }

    if (state.model.notes?.length) {
      add();
      add("注意事項");
      for (const note of state.model.notes) add(note);
    }

    if (state.model.sources?.length) {
      add();
      add("参照マニュアル", "掲載ページ");
      for (const source of state.model.sources) add(source.manual, source.pages?.join(", ") ?? "");
    }

    elements.excelOutput.value = lines.join("\r\n");
    elements.copyStatus.textContent = "設定変更に合わせて自動更新";
  }

  async function copyExcelOutput() {
    calculate();
    const value = elements.excelOutput.value;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        elements.excelOutput.focus();
        elements.excelOutput.select();
        if (!document.execCommand("copy")) throw new Error("copy command failed");
        elements.excelOutput.setSelectionRange(0, 0);
      }
      elements.copyStatus.textContent = "コピーしました。Excelの左上セルへ貼り付けてください。";
    } catch {
      elements.excelOutput.focus();
      elements.excelOutput.select();
      elements.copyStatus.textContent = "自動コピーできません。プレビューを選択して Ctrl+C してください。";
    }
  }

  function tsvCell(value) {
    let text = String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
    if (/^[=+@]/.test(text)) text = `'${text}`;
    return text;
  }

  function formatPlainNumber(value) {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
  }

  function applyPaste(text) {
    const rows = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!rows.length) return;
    const twoColumn = rows.some(row => /\t/.test(row));
    const inputMap = deviceInputMap();
    const pasteErrors = [];

    if (twoColumn) {
      for (const row of rows) {
        const [key, raw] = row.split("\t");
        const device = state.devices.find(item => normalise(item.symbol) === normalise(key) || normalise(item.name) === normalise(key));
        const value = parsePointText(raw);
        if (!device || value == null) {
          pasteErrors.push(`反映できません: ${row}`);
          continue;
        }
        const input = inputMap.get(device.symbol);
        if (!input.disabled) input.value = formatPointInput(value);
      }
    } else {
      const values = rows.map(parsePointText);
      values.forEach((value, index) => {
        const device = state.devices[index];
        if (value == null || !device) {
          pasteErrors.push(`反映できません: ${rows[index]}`);
          return;
        }
        const input = inputMap.get(device.symbol);
        if (!input.disabled) input.value = formatPointInput(value);
      });
    }
    calculate();
    elements.deviceActionStatus.textContent = pasteErrors.length
      ? `一括入力を反映しました。未反映 ${pasteErrors.length}件` 
      : "一括入力を反映しました。設定単位は補正ボタンで確認できます。";
    if (pasteErrors.length) showErrors(pasteErrors);
  }

  function pasteIntoTable(event, startSymbol) {
    const text = event.clipboardData?.getData("text");
    if (!text || !/[\r\n]/.test(text)) return;
    event.preventDefault();
    const values = text.split(/\r?\n/).map(line => line.split("\t")[0].trim()).filter(Boolean).map(parsePointText);
    const start = state.devices.findIndex(device => device.symbol === startSymbol);
    const inputMap = deviceInputMap();
    values.forEach((value, offset) => {
      const device = state.devices[start + offset];
      if (device && value != null) {
        const input = inputMap.get(device.symbol);
        if (!input.disabled) input.value = formatPointInput(value);
      }
    });
    calculate();
    elements.deviceActionStatus.textContent = "表へ貼り付けました。設定単位は補正ボタンで確認できます。";
  }

  function resetDefaults() {
    state.capacities = new Map(state.model.areas.map(area => [area.id, area.defaultKWords]));
    renderAllocationFields(true);
    renderDeviceTable();
    calculate();
    elements.deviceActionStatus.textContent = "型式の初期値へ戻しました。";
  }

  function correctSettingUnits() {
    const inputMap = deviceInputMap();
    let correctedCount = 0;
    let skippedCount = 0;

    for (const device of state.devices) {
      const input = inputMap.get(device.symbol);
      if (!input || input.disabled || device.settingUnit <= 1) continue;
      const value = parsePointText(input.value);
      if (value == null || value % device.settingUnit === 0) continue;

      const corrected = Math.ceil(value / device.settingUnit) * device.settingUnit;
      if (corrected > device.maxPoints) {
        skippedCount += 1;
        continue;
      }
      input.value = formatPointInput(corrected);
      correctedCount += 1;
    }

    calculate();
    if (correctedCount === 0 && skippedCount === 0) {
      elements.deviceActionStatus.textContent = "補正対象はありません。すべて設定単位に一致しています。";
    } else {
      const skipped = skippedCount ? ` / 最大点数を超えるため未補正 ${skippedCount}件` : "";
      elements.deviceActionStatus.textContent = `設定単位へ切り上げ補正 ${correctedCount}件${skipped}`;
    }
  }

  function fileRegisterDevice() {
    return state.devices.find(device => device.symbol === "ZR")
      ?? state.devices.find(device => device.symbol === "R")
      ?? null;
  }

  function updateFileRegisterButton() {
    const target = fileRegisterDevice();
    elements.allocateFileRegisterButton.hidden = !target;
    elements.allocateFileRegisterButton.disabled = !target || target.fixed;
    elements.allocateFileRegisterButton.title = target?.fixed
      ? `${target.symbol}はこの機種では固定設定です。`
      : "同じ容量領域の他デバイスを0点にし、ファイルレジスタへ可能な最大点数を割り当てます。";
  }

  function allocateAllToFileRegister() {
    const target = fileRegisterDevice();
    if (!target || target.fixed) {
      elements.deviceActionStatus.textContent = target ? `${target.symbol}は固定設定のため変更できません。` : "ファイルレジスタがありません。";
      return;
    }

    const area = state.model.areas.find(item => item.id === target.areaId);
    const capacityWords = (Number(state.capacities.get(target.areaId)) || 0) * 1024;
    const inputMap = deviceInputMap();
    let reservedWords = Number(area?.overheadWords || 0);
    let clearedCount = 0;

    for (const device of state.devices.filter(item => item.areaId === target.areaId && item.symbol !== target.symbol)) {
      const input = inputMap.get(device.symbol);
      if (!input) continue;
      if (input.disabled) {
        const points = parsePointText(input.value) ?? 0;
        reservedWords += points * (device.wordCostPerPoint + device.bitCostPerPoint / 16);
      } else {
        if ((parsePointText(input.value) ?? 0) !== 0) clearedCount += 1;
        input.value = "0";
      }
    }

    const costPerPoint = target.wordCostPerPoint + target.bitCostPerPoint / 16;
    const availableWords = Math.max(0, capacityWords - reservedWords);
    const rawPoints = costPerPoint > 0 ? Math.floor(availableWords / costPerPoint) : 0;
    const limitedPoints = Math.min(rawPoints, target.maxPoints);
    const points = Math.floor(limitedPoints / target.settingUnit) * target.settingUnit;
    inputMap.get(target.symbol).value = formatPointInput(points);

    calculate();
    const usedWords = points * costPerPoint + reservedWords;
    const remainingWords = Math.max(0, capacityWords - usedWords);
    const remaining = remainingWords ? ` / 未割当 ${formatWords(remainingWords / 1024)} Kワード` : " / 全容量割当済み";
    const cleared = clearedCount ? ` / 同一領域の他デバイスを0点化 ${clearedCount}件` : "";
    elements.deviceActionStatus.textContent = `${target.symbol}へ ${formatNumber(points)}点を割り当てました${remaining}${cleared}`;
  }

  function mergeDevices(devices, overrides) {
    return devices.flatMap(device => {
      const override = overrides?.[device.symbol] ?? overrides?.[device.symbol.toLowerCase()] ?? null;
      if (override?.hidden === true) return [];
      return [{ ...device, ...withoutUndefined(override ?? {}) }];
    });
  }

  function areaLimit(area, option) {
    let limit;
    if (area.capacityFromMemoryOption && option.id !== "none") {
      limit = option.fileCapacityOverrideKPoints ?? (area.maxKWords + option.fileCapacityAddedKPoints);
    } else {
      limit = area.maxKWords + (area.expandWithMemory ? (option.sharedMemoryAddedKWords || 0) : 0);
    }
    return area.absoluteMaxKWords == null ? limit : Math.min(limit, area.absoluteMaxKWords);
  }

  function deviceRange(device, points, includeSymbol = true) {
    if (!Number.isFinite(points) || points <= 0) return "なし";
    const last = Math.floor(points - 1);
    const suffix = last.toString(device.radix || 10).toUpperCase();
    const symbol = rangeDeviceSymbol(device.symbol);
    return includeSymbol ? `${symbol}0 ～ ${symbol}${suffix}` : `0 ～ ${suffix}`;
  }

  function rangeDeviceSymbol(symbol) {
    if (symbol === "D(拡張)") return "D";
    if (symbol === "W(拡張)") return "W";
    return symbol;
  }

  function parsePointText(value) {
    if (value == null) return null;
    const cleaned = String(value).trim().replace(/[,_，\s]/g, "");
    const match = cleaned.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))([KkＫｋ])?$/);
    if (!match) return null;
    const parsed = Number(match[1]) * (match[2] ? 1024 : 1);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  function deviceInputMap() {
    return new Map([...elements.deviceFormHost.querySelectorAll("input[data-symbol]")].map(input => [input.dataset.symbol, input]));
  }

  function formatPointInput(value) {
    return value >= 1024 && value % 1024 === 0 ? `${value / 1024}K` : String(value);
  }

  function showErrors(errors) {
    elements.errorPanel.hidden = errors.length === 0;
    elements.errorPanel.innerHTML = errors.length ? `<strong>入力を確認してください</strong><ul>${errors.map(error => `<li>${escapeHtml(error)}</li>`).join("")}</ul>` : "";
  }

  function setStatus(element, status, label) {
    element.className = `status-pill status-${status}`;
    element.textContent = label;
  }

  function statusLabel(status) {
    return status === "over" ? "オーバー" : status === "warning" ? "残り10%未満" : "範囲内";
  }

  function findById(items, id) {
    const value = items.find(item => item.id === id);
    if (!value) throw new Error(`定義IDが見つかりません: ${id}`);
    return value;
  }

  function chip(text) {
    const value = document.createElement("span");
    value.className = "meta-chip";
    value.textContent = text;
    return value;
  }

  function withoutUndefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
  }

  function normalise(value) {
    return String(value ?? "").replace(/[\s　()（）・]/g, "").toUpperCase();
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 3 }).format(value);
  }

  function formatWords(value) {
    return Number.isInteger(value) ? formatNumber(value) : formatNumber(Number(value.toFixed(3)));
  }

  function formatPercent(value) {
    return Number.isFinite(value) ? value.toFixed(1) : "∞";
  }

  function formatPlain(value) {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
  }

  function cssEscape(value) {
    return window.CSS?.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }
})();
