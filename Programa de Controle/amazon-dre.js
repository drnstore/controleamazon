/* Amazon data stays separate from all original manual records. */
let amazonDreImports = [];
let amazonPending = null;
let amazonEditorDraft = null;

function addAmazonDreLine(line) {
  const row = document.createElement("div");
  row.className = "dre-line-row";
  row.dataset.amazonSource = "amazon_csv";
  row.innerHTML = `<label>Descrição<input value="${escapeAttribute(line.label)}" readonly /></label><label>Valor<input value="${amazonMoney(line.cents)}" readonly /></label><span>Amazon CSV</span>`;
  (line.side === "income" ? dom.dreIncomeRows : dom.dreExpenseRows).appendChild(row);
}

function importAmazonIntoEditor() {
  dom.dreError.textContent = "";
  const month = dom.dreMonth.value;
  if (!month) { dom.dreError.textContent = "Selecione o mês antes de importar o CSV."; return; }
  const existing = dreRecords.find((r) => (r.monthKey || r.month) === month);
  if (existing && existing.id !== dom.dreRecordId.value) {
    dom.dreError.textContent = "Já existe um DRE para este mês. Abra Editar fechamento para importar mantendo seus lançamentos.";
    return;
  }
  amazonEditorDraft = buildDreFromForm();
  if (existing && (JSON.stringify(amazonEditorDraft.incomes) !== JSON.stringify(existing.incomes) || JSON.stringify(amazonEditorDraft.expenses) !== JSON.stringify(existing.expenses))) {
    dom.dreError.textContent = "Salve primeiro as alterações manuais deste fechamento e depois importe o CSV para conferir os valores atualizados.";
    amazonEditorDraft = null;
    return;
  }
  openAmazonImport(month, amazonFor({month}));
}

function amazonFor(record) {
  return record && amazonDreImports.find((item) => item.month === (record.monthKey || record.month));
}

function amazonDreRecords() {
  const records = dreRecords.slice();
  for (const imported of amazonDreImports) {
    if (!records.some((record) => (record.monthKey || record.month) === imported.month)) {
      records.push({ id: `amazon-${imported.month}`, month: imported.month, monthKey: imported.month,
        revenue: 0, incomes: [{ id: `manual-income-${imported.month}`, label: "Outras entradas", value: 0 }],
        expenses: [{ id: `manual-cmv-${imported.month}`, label: "Custo de produtos", value: 0 }], createdAt: imported.imported_at });
    }
  }
  return records;
}

function amazonEffective(record) {
  const imported = amazonFor(record);
  if (!imported || record.amazonEffective) return record;
  const result = { ...record, amazonEffective: true, revenue: imported.totals.gross / 100 };
  for (const [field, side] of [["incomes", "income"], ["expenses", "expense"]]) {
    result[field] = (record[field] || []).filter((line, index) => !(imported.excludedManual || []).includes(`${field}:${line.id ?? index}`));
    result[field] = result[field].concat(imported.lines.filter((line) => line.side === side).map((line) => ({ ...line, value: line.cents / 100 })));
  }
  return result;
}

function amazonMoney(value) { return currency.format(value / 100); }

function amazonReportHtml(report, costs = {}) {
  const groups = (title, rows) => `<details><summary>${title} (${rows.length}) — ${amazonMoney(rows.reduce((sum, row) => sum + row.total, 0))}</summary><table class="mini-table"><thead><tr><th>Tipo / descrição</th><th>Valor</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.type)} — ${escapeHtml(row.description)}</td><td>${amazonMoney(row.total)}</td></tr>`).join("")}</tbody></table></details>`;
  const lines = (side) => report.lines.filter((line) => line.side === side).map((line) => ({ label: line.label, value: line.cents / 100 }));
  return `<section class="amazon-report">
    <h3>Amazon — ${escapeHtml(formatMonth(report.month))}</h3>
    <p>${escapeHtml(report.file)} · ${report.transactions} transações · ${escapeHtml(report.timezone)}</p>
    <p>Período no arquivo: ${escapeHtml(report.dateRange.join(" a "))}. O mês considera o horário de Brasília.</p>
    ${report.imported_at ? `<p>Importado em ${escapeHtml(new Date(report.imported_at).toLocaleString("pt-BR"))} · Revisão ${report.revision}</p>` : ""}
    <div class="dre-details-columns">${dreDetailsTable("Entradas Amazon", lines("income"))}${dreDetailsTable("Saídas Amazon", lines("expense"))}</div>
    <div class="details-grid">
      <div class="details-item"><span>Taxas Amazon + FBA (informativo)</span><strong>${amazonMoney(report.amazonFees)}</strong></div>
      <div class="details-item"><span>Receita líquida Amazon</span><strong>${amazonMoney(report.netRevenue)}</strong></div>
      <div class="details-item"><span>Resultado Amazon antes do CMV e gastos manuais</span><strong>${amazonMoney(report.beforeCogs)}</strong></div>
    </div>
    <details><summary>Memória de cálculo — cobranças e créditos</summary><table class="mini-table"><thead><tr><th>Categoria</th><th>Cobranças</th><th>Créditos</th></tr></thead><tbody>${report.lines.map((line) => {
      const b = report.breakdown[line.id.replace("amazon:", "")];
      return `<tr><td>${escapeHtml(line.label)}</td><td>${amazonMoney(b.charges)}</td><td>${amazonMoney(b.credits)}</td></tr>`;
    }).join("")}</tbody></table></details>
    ${groups("Transações não classificadas — fora do DRE", report.unknown)}
    ${groups("Transferências bancárias — fora do resultado do DRE", report.transfers)}
    <details><summary>CMV — quantidades por SKU</summary><p>O DRE atual utiliza custo de produtos lançado manualmente. Esse valor foi preservado. Os custos médios atuais abaixo são apenas referência: não representam necessariamente o custo histórico das vendas. Nenhum estoque é movimentado.</p>
      <table class="mini-table"><thead><tr><th>SKU</th><th>Vendas</th><th>Devoluções</th><th>Líquido</th><th>Custo médio atual</th></tr></thead><tbody>${report.skuUnits.map((row) => `<tr><td>${escapeHtml(row.sku || "Sem SKU")}</td><td>${row.sold}</td><td>${row.refunded}</td><td>${row.net}</td><td>${costs[row.sku] != null ? currency.format(costs[row.sku]) : "Consultar estoque / histórico"}</td></tr>`).join("")}</tbody></table>
    </details>
    ${report.manualSnapshot ? `<details><summary>Lançamentos originais preservados</summary><p>Faturamento original: ${currency.format(report.originalRevenue || 0)}. No fechamento importado, o faturamento utilizado é o do CSV.</p><table class="mini-table"><thead><tr><th>Descrição</th><th>Valor original</th><th>Tratamento no cálculo</th></tr></thead><tbody>${report.manualSnapshot.map((line) => `<tr><td>${escapeHtml(line.label)}</td><td>${currency.format(line.value)}</td><td>${report.excludedManual.includes(line.key) ? "Já contemplado pelo CSV (original preservado)" : "Mantido no cálculo"}</td></tr>`).join("")}</tbody></table></details>` : ""}
    <details><summary>Identificação do arquivo</summary><p class="amazon-hash">SHA-256: ${escapeHtml(report.hash)}</p><p>Origem: amazon_csv · Versão do importador: ${report.parserVersion}</p></details>
  </section>`;
}

function openAmazonImport(month = "", imported = null) {
  if (imported && !dom.dreDialog.open) {
    dom.detailsTitle.textContent = `Importação Amazon — ${formatMonth(month)}`;
    dom.detailsContent.innerHTML = amazonReportHtml(imported);
    dom.detailsDialog.showModal();
    return;
  }
  const dialog = document.getElementById("amazonImportDialog");
  amazonPending = null;
  document.getElementById("amazonCsvFile").value = "";
  document.getElementById("amazonImportMonth").value = month;
  document.getElementById("amazonImportMonth").readOnly = Boolean(month);
  document.getElementById("amazonImportError").textContent = "";
  document.getElementById("amazonImportPreview").innerHTML = imported ? amazonReportHtml(imported) : "";
  document.getElementById("confirmAmazonImport").hidden = true;
  dialog.showModal();
}

function invalidateAmazonPreview() {
  amazonPending = null;
  document.getElementById("confirmAmazonImport").hidden = true;
  document.getElementById("amazonImportPreview").innerHTML = "";
}

async function previewAmazonImport() {
  const button = document.getElementById("previewAmazonImport");
  const error = document.getElementById("amazonImportError");
  error.textContent = "";
  invalidateAmazonPreview();
  button.disabled = true;
  try {
    if (!backendEnabled) throw new Error("Conecte-se ao servidor para importar o CSV com segurança.");
    const file = document.getElementById("amazonCsvFile").files[0];
    if (!file) throw new Error("Selecione o arquivo CSV da Amazon.");
    if (file.size > 12000000) throw new Error("O CSV deve ter no máximo 12 MB.");
    const bytes = await file.arrayBuffer();
    let content;
    try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { content = new TextDecoder("windows-1252").decode(bytes); }
    const request = { content, file: file.name, month: document.getElementById("amazonImportMonth").value };
    const preview = await apiRequest("/api/dre/amazon/preview", { method: "POST", body: request });
    if (document.getElementById("amazonCsvFile").files[0] !== file || document.getElementById("amazonImportMonth").value !== request.month) {
      throw new Error("A seleção mudou. Gere uma nova prévia do arquivo selecionado.");
    }
    document.getElementById("amazonImportMonth").value = preview.report.month;
    amazonPending = { request: { ...request, month: preview.report.month }, preview };
    document.getElementById("amazonImportPreview").innerHTML = `${preview.revision ? `<p><strong>Já existem dados Amazon importados para ${escapeHtml(formatMonth(preview.report.month))}.</strong> A reimportação cria uma nova revisão, sem duplicar valores.</p>` : ""}
      ${amazonReportHtml(preview.report, preview.costReferences)}
      ${preview.manual.length ? `<section><h3>Conferir lançamentos já cadastrados</h3><p>Todos os originais serão preservados. Para cada valor, escolha se ele continua somado ou se já está contemplado pelo CSV. Por exemplo, “Líquido marketplace” não deve ser somado novamente às vendas e taxas importadas. Impostos, CMV e outros gastos continuam no cálculo.</p><p>Faturamento original: ${currency.format(preview.existingRevenue)}. O fechamento importado usará o faturamento do CSV.</p>
        ${preview.manual.map((line, index) => `<label class="amazon-manual-choice">${escapeHtml(line.label)} — ${currency.format(line.value)} (${line.side === "income" ? "entrada" : "saída"})<select data-amazon-manual="${index}" required>
          <option value="">Selecione o tratamento</option><option value="keep" ${preview.revision && !preview.previousExclusions.includes(line.key) || !line.value ? "selected" : ""}>Manter no cálculo</option><option value="covered" ${preview.previousExclusions.includes(line.key) ? "selected" : ""}>Já contemplado pelo CSV — preservar original</option>
        </select></label>`).join("")}</section>` : ""}
      <p id="amazonCombinedResult"></p>
      <label class="amazon-ack"><input type="checkbox" id="amazonReviewed" /> Conferi o mês, os valores, o CMV e os lançamentos manuais. Confirmo somente esta importação.</label>`;
    document.querySelectorAll("[data-amazon-manual]").forEach((select) => select.addEventListener("change", updateAmazonCombined));
    updateAmazonCombined();
    const confirmButton = document.getElementById("confirmAmazonImport");
    confirmButton.textContent = preview.revision ? "Reimportar dados Amazon" : "Confirmar Importação";
    confirmButton.hidden = false;
  } catch (err) { error.textContent = err.message; }
  finally { button.disabled = false; }
}

function updateAmazonCombined() {
  if (!amazonPending) return;
  let total = amazonPending.preview.report.beforeCogs;
  let incomplete = false;
  document.querySelectorAll("[data-amazon-manual]").forEach((select) => {
    if (!select.value) incomplete = true;
    if (select.value === "keep") {
      const line = amazonPending.preview.manual[Number(select.dataset.amazonManual)];
      total += Math.round(line.value * 100) * (line.side === "income" ? 1 : -1);
    }
  });
  document.getElementById("amazonCombinedResult").textContent = incomplete ? "Selecione o tratamento de todos os lançamentos para conferir o resultado final." : `Resultado com os lançamentos manuais mantidos: ${amazonMoney(total)}. Confira se o CMV já está preenchido.`;
}

async function confirmAmazonImport() {
  const error = document.getElementById("amazonImportError");
  const button = document.getElementById("confirmAmazonImport");
  error.textContent = "";
  if (!amazonPending) return;
  button.disabled = true;
  try {
    if (!document.getElementById("amazonReviewed").checked) throw new Error("Marque a confirmação após conferir a prévia.");
    const selections = [...document.querySelectorAll("[data-amazon-manual]")];
    if (selections.some((select) => !select.value)) throw new Error("Confira o tratamento de todos os lançamentos manuais.");
    const { request, preview } = amazonPending;
    const excludedManual = selections.filter((s) => s.value === "covered").map((s) => preview.manual[Number(s.dataset.amazonManual)].key);
    await apiRequest("/api/dre/amazon/confirm", { method: "POST", body: { ...request, token: preview.token, reimport: preview.revision > 0, excludedManual } });
    amazonPending = null;
    document.getElementById("amazonImportDialog").close();
    await refreshData();
    if (amazonEditorDraft && dom.dreDialog.open) {
      openDreModal(amazonEditorDraft);
      amazonEditorDraft = null;
    }
    showToast("Importação Amazon salva. Lançamentos originais preservados.");
  } catch (err) { error.textContent = err.message; }
  finally { button.disabled = false; }
}

document.getElementById("openAmazonImport").addEventListener("click", importAmazonIntoEditor);
document.getElementById("previewAmazonImport").addEventListener("click", previewAmazonImport);
document.getElementById("confirmAmazonImport").addEventListener("click", confirmAmazonImport);
for (const id of ["closeAmazonImport", "cancelAmazonImport"]) document.getElementById(id).addEventListener("click", () => document.getElementById("amazonImportDialog").close());
for (const id of ["amazonCsvFile", "amazonImportMonth"]) document.getElementById(id).addEventListener("change", invalidateAmazonPreview);
