const DB_NAME = "controleAmazonEstoque";
const DB_VERSION = 7;
const PRODUCT_STORE = "products";
const MOVEMENT_STORE = "movements";
const SHIPMENT_STORE = "shipments";
const PURCHASE_STORE = "purchases";
const DRE_STORE = "dreRecords";
const CASH_STORE = "cashState";
const ACCOUNT_STORE = "accountEntries";
const ACCOUNT_MONTH_STORE = "accountMonths";
const PURCHASE_STATUSES = ["Comprar", "Pedido", "Pago", "Retirar", "Entregue", "Recebido"];
const ACCOUNT_TYPES = ["Entrada", "Saida"];
const PAYMENT_METHODS = ["Pix", "Boleto", "Transferencia"];
const DEFAULT_DRE_INCOMES = ["Liquido marketplace", "Seller rewards"];
const DEFAULT_DRE_EXPENSES = [
  "Custo de produtos",
  "Reembolsos",
  "Imposto DAS",
  "Custo de ADS",
  "Fretes",
  "Cartao de credito",
  "Contabilidade",
  "Dividendos",
  "Prolabore",
  "DARF",
];

let db;
let products = [];
let movements = [];
let shipments = [];
let purchases = [];
let dreRecords = [];
let cashState = { id: "main", accountValue: 0, amazonReceivable: 0, updatedAt: 0 };
let accountEntries = [];
let accountMonths = [];
let currentSimpleAction = null;
let currentSimpleProductId = null;
let pendingImportRows = [];
let currentProductPhoto = "";
let currentPurchaseAttachment = "";
let backendEnabled = false;
let currentUser = null;
let activeTab = "dashboard";
let dashboardMoneyVisible = localStorage.getItem("dashboardMoneyVisible") !== "false";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const number = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const dom = {
  body: document.getElementById("inventoryBody"),
  dashboardView: document.getElementById("dashboardView"),
  inventoryView: document.getElementById("inventoryView"),
  shipmentsView: document.getElementById("shipmentsView"),
  purchasesView: document.getElementById("purchasesView"),
  dreView: document.getElementById("dreView"),
  cashView: document.getElementById("cashView"),
  accountView: document.getElementById("accountView"),
  loginOverlay: document.getElementById("loginOverlay"),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginError: document.getElementById("loginError"),
  userPanel: document.getElementById("userPanel"),
  currentUserName: document.getElementById("currentUserName"),
  logoutButton: document.getElementById("logoutButton"),
  emptyState: document.getElementById("emptyState"),
  navTabs: document.querySelector(".nav-tabs"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  productDialog: document.getElementById("productDialog"),
  productForm: document.getElementById("productForm"),
  productDialogTitle: document.getElementById("productDialogTitle"),
  productError: document.getElementById("productError"),
  productId: document.getElementById("productId"),
  asin: document.getElementById("asin"),
  sku: document.getElementById("sku"),
  productName: document.getElementById("productName"),
  productPhoto: document.getElementById("productPhoto"),
  photoPreview: document.getElementById("photoPreview"),
  removePhoto: document.getElementById("removePhoto"),
  warehouseStock: document.getElementById("warehouseStock"),
  fbaStock: document.getElementById("fbaStock"),
  last15Sales: document.getElementById("last15Sales"),
  batchRows: document.getElementById("batchRows"),
  simpleDialog: document.getElementById("simpleDialog"),
  simpleForm: document.getElementById("simpleForm"),
  simpleEyebrow: document.getElementById("simpleEyebrow"),
  simpleTitle: document.getElementById("simpleTitle"),
  simpleContent: document.getElementById("simpleContent"),
  simpleError: document.getElementById("simpleError"),
  simpleSubmit: document.getElementById("simpleSubmit"),
  importDialog: document.getElementById("importDialog"),
  importForm: document.getElementById("importForm"),
  importFile: document.getElementById("importFile"),
  importPreview: document.getElementById("importPreview"),
  importError: document.getElementById("importError"),
  applyImport: document.getElementById("applyImport"),
  downloadTemplate: document.getElementById("downloadTemplate"),
  shipmentsBody: document.getElementById("shipmentsBody"),
  emptyShipmentsState: document.getElementById("emptyShipmentsState"),
  openShipmentModal: document.getElementById("openShipmentModal"),
  shipmentDialog: document.getElementById("shipmentDialog"),
  shipmentForm: document.getElementById("shipmentForm"),
  shipmentDialogTitle: document.getElementById("shipmentDialogTitle"),
  shipmentRecordId: document.getElementById("shipmentRecordId"),
  shipmentScheduleId: document.getElementById("shipmentScheduleId"),
  shipmentDate: document.getElementById("shipmentDate"),
  shipmentTime: document.getElementById("shipmentTime"),
  shipmentLocation: document.getElementById("shipmentLocation"),
  shipmentProductRows: document.getElementById("shipmentProductRows"),
  addShipmentItem: document.getElementById("addShipmentItem"),
  shipmentError: document.getElementById("shipmentError"),
  shipmentDateFilter: document.getElementById("shipmentDateFilter"),
  metricShipments: document.getElementById("metricShipments"),
  metricShipmentItems: document.getElementById("metricShipmentItems"),
  metricNextShipment: document.getElementById("metricNextShipment"),
  metricShipmentProducts: document.getElementById("metricShipmentProducts"),
  purchasesBody: document.getElementById("purchasesBody"),
  emptyPurchasesState: document.getElementById("emptyPurchasesState"),
  openPurchaseModal: document.getElementById("openPurchaseModal"),
  purchaseDialog: document.getElementById("purchaseDialog"),
  purchaseForm: document.getElementById("purchaseForm"),
  purchaseDialogTitle: document.getElementById("purchaseDialogTitle"),
  purchaseRecordId: document.getElementById("purchaseRecordId"),
  exportRetiradaPdf: document.getElementById("exportRetiradaPdf"),
  selectAllRetiradaPurchases: document.getElementById("selectAllRetiradaPurchases"),
  purchaseSupplierSelect: document.getElementById("purchaseSupplierSelect"),
  purchaseSupplierName: document.getElementById("purchaseSupplierName"),
  purchaseAddress: document.getElementById("purchaseAddress"),
  purchaseValue: document.getElementById("purchaseValue"),
  purchaseBoxes: document.getElementById("purchaseBoxes"),
  purchaseBoxSize: document.getElementById("purchaseBoxSize"),
  purchaseOrderNumber: document.getElementById("purchaseOrderNumber"),
  purchaseStatus: document.getElementById("purchaseStatus"),
  purchaseStatusFilter: document.getElementById("purchaseStatusFilter"),
  purchaseItemRows: document.getElementById("purchaseItemRows"),
  addPurchaseItem: document.getElementById("addPurchaseItem"),
  purchaseAttachment: document.getElementById("purchaseAttachment"),
  purchaseAttachmentPreview: document.getElementById("purchaseAttachmentPreview"),
  removePurchaseAttachment: document.getElementById("removePurchaseAttachment"),
  purchaseError: document.getElementById("purchaseError"),
  metricPurchases: document.getElementById("metricPurchases"),
  metricPurchaseValue: document.getElementById("metricPurchaseValue"),
  metricPurchasePickup: document.getElementById("metricPurchasePickup"),
  metricPurchaseSuppliers: document.getElementById("metricPurchaseSuppliers"),
  dreBody: document.getElementById("dreBody"),
  emptyDreState: document.getElementById("emptyDreState"),
  openDreModal: document.getElementById("openDreModal"),
  dreDialog: document.getElementById("dreDialog"),
  dreForm: document.getElementById("dreForm"),
  dreDialogTitle: document.getElementById("dreDialogTitle"),
  dreRecordId: document.getElementById("dreRecordId"),
  dreMonth: document.getElementById("dreMonth"),
  dreRevenue: document.getElementById("dreRevenue"),
  dreIncomeRows: document.getElementById("dreIncomeRows"),
  dreExpenseRows: document.getElementById("dreExpenseRows"),
  addDreIncome: document.getElementById("addDreIncome"),
  addDreExpense: document.getElementById("addDreExpense"),
  dreIncomeTotal: document.getElementById("dreIncomeTotal"),
  dreExpenseTotal: document.getElementById("dreExpenseTotal"),
  dreNetProfit: document.getElementById("dreNetProfit"),
  dreMargin: document.getElementById("dreMargin"),
  dreError: document.getElementById("dreError"),
  metricDreRevenue: document.getElementById("metricDreRevenue"),
  metricDreIncome: document.getElementById("metricDreIncome"),
  metricDreExpense: document.getElementById("metricDreExpense"),
  metricDreProfit: document.getElementById("metricDreProfit"),
  metricDreMargin: document.getElementById("metricDreMargin"),
  cashForm: document.getElementById("cashForm"),
  cashAccountValue: document.getElementById("cashAccountValue"),
  cashAmazonReceivable: document.getElementById("cashAmazonReceivable"),
  cashError: document.getElementById("cashError"),
  metricCashStock: document.getElementById("metricCashStock"),
  metricCashAccount: document.getElementById("metricCashAccount"),
  metricCashAmazon: document.getElementById("metricCashAmazon"),
  metricCashTotal: document.getElementById("metricCashTotal"),
  accountMonthFilter: document.getElementById("accountMonthFilter"),
  accountOpeningBalance: document.getElementById("accountOpeningBalance"),
  accountOpeningForm: document.getElementById("accountOpeningForm"),
  exportAccountPdf: document.getElementById("exportAccountPdf"),
  openAccountBulkModal: document.getElementById("openAccountBulkModal"),
  openAccountEntryModal: document.getElementById("openAccountEntryModal"),
  accountBody: document.getElementById("accountBody"),
  emptyAccountState: document.getElementById("emptyAccountState"),
  metricAccountOpening: document.getElementById("metricAccountOpening"),
  metricAccountIn: document.getElementById("metricAccountIn"),
  metricAccountOut: document.getElementById("metricAccountOut"),
  metricAccountBalance: document.getElementById("metricAccountBalance"),
  metricAccountEntries: document.getElementById("metricAccountEntries"),
  accountEntryDialog: document.getElementById("accountEntryDialog"),
  accountEntryForm: document.getElementById("accountEntryForm"),
  accountEntryDialogTitle: document.getElementById("accountEntryDialogTitle"),
  accountEntryRecordId: document.getElementById("accountEntryRecordId"),
  accountEntryDate: document.getElementById("accountEntryDate"),
  accountEntryDescription: document.getElementById("accountEntryDescription"),
  accountEntryType: document.getElementById("accountEntryType"),
  accountEntryValue: document.getElementById("accountEntryValue"),
  accountEntryPayment: document.getElementById("accountEntryPayment"),
  accountEntryInvoiceNumber: document.getElementById("accountEntryInvoiceNumber"),
  accountEntryInvoiceDate: document.getElementById("accountEntryInvoiceDate"),
  accountEntryInstallments: document.getElementById("accountEntryInstallments"),
  accountEntryNotes: document.getElementById("accountEntryNotes"),
  accountEntryError: document.getElementById("accountEntryError"),
  accountBulkDialog: document.getElementById("accountBulkDialog"),
  accountBulkForm: document.getElementById("accountBulkForm"),
  accountBulkDate: document.getElementById("accountBulkDate"),
  accountBulkDescription: document.getElementById("accountBulkDescription"),
  accountBulkType: document.getElementById("accountBulkType"),
  accountBulkPayment: document.getElementById("accountBulkPayment"),
  accountBulkInvoiceNumber: document.getElementById("accountBulkInvoiceNumber"),
  accountBulkInvoiceDate: document.getElementById("accountBulkInvoiceDate"),
  accountBulkInstallments: document.getElementById("accountBulkInstallments"),
  accountBulkNotes: document.getElementById("accountBulkNotes"),
  accountBulkRows: document.getElementById("accountBulkRows"),
  addAccountBulkRow: document.getElementById("addAccountBulkRow"),
  accountBulkError: document.getElementById("accountBulkError"),
  dashboardCashTotal: document.getElementById("dashboardCashTotal"),
  dashboardStockValue: document.getElementById("dashboardStockValue"),
  dashboardSendQty: document.getElementById("dashboardSendQty"),
  dashboardBuyQty: document.getElementById("dashboardBuyQty"),
  dashboardInventoryList: document.getElementById("dashboardInventoryList"),
  dashboardPurchasesList: document.getElementById("dashboardPurchasesList"),
  dashboardShipmentsList: document.getElementById("dashboardShipmentsList"),
  dashboardDreList: document.getElementById("dashboardDreList"),
  toggleDashboardMoney: document.getElementById("toggleDashboardMoney"),
  detailsDialog: document.getElementById("detailsDialog"),
  detailsTitle: document.getElementById("detailsTitle"),
  detailsContent: document.getElementById("detailsContent"),
  metricProducts: document.getElementById("metricProducts"),
  metricValue: document.getElementById("metricValue"),
  metricSend: document.getElementById("metricSend"),
  metricBuy: document.getElementById("metricBuy"),
  toast: document.getElementById("toast"),
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

async function init() {
  db = await openDatabaseWithTimeout();
  bindEvents();
  backendEnabled = await checkBackend();

  if (backendEnabled) {
    currentUser = await loadCurrentUser();
    if (!currentUser) {
      showLogin();
      return;
    }
    await setupBackend();
  }

  await refreshData();
}

function openDatabaseWithTimeout() {
  return Promise.race([
    openDatabase(),
    new Promise((resolve) => setTimeout(() => resolve(null), 1200)),
  ]);
}

async function setupBackend() {
  try {
    const serverData = await apiRequest("/api/data");
    const localProducts = await getAll(PRODUCT_STORE);
    const localMovements = await getAll(MOVEMENT_STORE);
    const localShipments = await getAll(SHIPMENT_STORE);
    const localPurchases = await getAll(PURCHASE_STORE);
    const localDreRecords = await getAll(DRE_STORE);
    const localCashState = await getAll(CASH_STORE);
    const localAccountEntries = await getAll(ACCOUNT_STORE);
    const localAccountMonths = await getAll(ACCOUNT_MONTH_STORE);

    if (!serverData.products.length && localProducts.length) {
      await apiRequest("/api/bootstrap", {
        method: "POST",
        body: {
          products: localProducts,
          movements: localMovements,
          shipments: localShipments,
          purchases: localPurchases,
          dreRecords: localDreRecords,
          cashState: localCashState[0] || cashState,
          accountEntries: localAccountEntries,
          accountMonths: localAccountMonths,
        },
      });
    }

    return true;
  } catch (error) {
    return false;
  }
}

async function checkBackend() {
  try {
    const response = await fetch("/health", { credentials: "same-origin" });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !options.skipAuthRedirect) {
      currentUser = null;
      renderAuthState();
      showLogin(payload.error || "Entre novamente para continuar.");
    }
    throw new Error(payload.error || "Nao foi possivel acessar o banco local.");
  }
  return payload;
}

async function loadCurrentUser() {
  try {
    const payload = await apiRequest("/api/auth/me", { skipAuthRedirect: true });
    currentUser = payload.user || null;
    renderAuthState();
    if (currentUser) hideLogin();
    return currentUser;
  } catch (error) {
    currentUser = null;
    renderAuthState();
    return null;
  }
}

function showLogin(message = "") {
  if (!dom.loginOverlay) return;
  dom.loginError.textContent = message;
  dom.loginOverlay.hidden = false;
  setTimeout(() => dom.loginEmail.focus(), 0);
}

function hideLogin() {
  if (!dom.loginOverlay) return;
  dom.loginOverlay.hidden = true;
  dom.loginError.textContent = "";
  dom.loginPassword.value = "";
}

function renderAuthState() {
  if (!dom.userPanel) return;
  dom.userPanel.hidden = !currentUser;
  dom.currentUserName.textContent = currentUser
    ? `${currentUser.name || currentUser.email} - ${currentUser.role}`
    : "";
}

async function handleLogin(event) {
  event.preventDefault();
  dom.loginError.textContent = "";

  try {
    const payload = await apiRequest("/api/auth/login", {
      method: "POST",
      body: {
        email: dom.loginEmail.value.trim(),
        password: dom.loginPassword.value,
      },
      skipAuthRedirect: true,
    });
    currentUser = payload.user;
    renderAuthState();
    hideLogin();
    backendEnabled = true;
    await setupBackend();
    await refreshData();
    showToast("Login realizado com sucesso.");
  } catch (error) {
    dom.loginError.textContent = error.message || "Nao foi possivel entrar.";
  }
}

async function handleLogout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST", skipAuthRedirect: true });
  } catch (error) {
    // Mesmo que a sessao ja tenha expirado no servidor, limpamos a tela local.
  }
  currentUser = null;
  renderAuthState();
  showLogin("Voce saiu do sistema.");
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PRODUCT_STORE)) {
        const store = database.createObjectStore(PRODUCT_STORE, { keyPath: "id" });
        store.createIndex("asinKey", "asinKey", { unique: true });
        store.createIndex("skuKey", "skuKey", { unique: true });
      }
      if (!database.objectStoreNames.contains(MOVEMENT_STORE)) {
        const store = database.createObjectStore(MOVEMENT_STORE, { keyPath: "id" });
        store.createIndex("productId", "productId", { unique: false });
      }
      if (!database.objectStoreNames.contains(SHIPMENT_STORE)) {
        const store = database.createObjectStore(SHIPMENT_STORE, { keyPath: "id" });
        store.createIndex("scheduleIdKey", "scheduleIdKey", { unique: true });
      }
      if (!database.objectStoreNames.contains(PURCHASE_STORE)) {
        const store = database.createObjectStore(PURCHASE_STORE, { keyPath: "id" });
        store.createIndex("orderNumberKey", "orderNumberKey", { unique: true });
        store.createIndex("productId", "productId", { unique: false });
      }
      if (!database.objectStoreNames.contains(DRE_STORE)) {
        const store = database.createObjectStore(DRE_STORE, { keyPath: "id" });
        store.createIndex("monthKey", "monthKey", { unique: true });
      }
      if (!database.objectStoreNames.contains(CASH_STORE)) {
        database.createObjectStore(CASH_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(ACCOUNT_STORE)) {
        const store = database.createObjectStore(ACCOUNT_STORE, { keyPath: "id" });
        store.createIndex("monthKey", "monthKey", { unique: false });
      }
      if (!database.objectStoreNames.contains(ACCOUNT_MONTH_STORE)) {
        database.createObjectStore(ACCOUNT_MONTH_STORE, { keyPath: "monthKey" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve(null);
  });
}

function transaction(storeName, mode = "readonly") {
  if (!db) return null;
  if (!db.objectStoreNames.contains(storeName)) return null;
  return db.transaction(storeName, mode).objectStore(storeName);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function writeStores(storeNames, handler) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }
    const tx = db.transaction(storeNames, "readwrite");
    const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]));
    handler(stores);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAll(storeName) {
  const store = transaction(storeName);
  if (!store) return [];
  return requestToPromise(store.getAll());
}

async function refreshData() {
  if (backendEnabled) {
    const data = await apiRequest("/api/data");
    products = data.products.sort((a, b) => a.name.localeCompare(b.name));
    movements = data.movements.sort((a, b) => b.createdAt - a.createdAt);
    shipments = (data.shipments || []).sort(compareShipments);
    purchases = (data.purchases || []).sort(comparePurchases);
    dreRecords = (data.dreRecords || []).sort(compareDreRecords);
    cashState = normalizeCashState(data.cashState);
    accountEntries = (data.accountEntries || []).sort(compareAccountEntries);
    accountMonths = (data.accountMonths || []).sort(compareAccountMonths);
    await mirrorServerDataLocally(
      data.products,
      data.movements,
      data.shipments || [],
      data.purchases || [],
      data.dreRecords || [],
      cashState,
      data.accountEntries || [],
      data.accountMonths || [],
    );
  } else {
    products = (await getAll(PRODUCT_STORE)).sort((a, b) => a.name.localeCompare(b.name));
    movements = (await getAll(MOVEMENT_STORE)).sort((a, b) => b.createdAt - a.createdAt);
    shipments = (await getAll(SHIPMENT_STORE)).sort(compareShipments);
    purchases = (await getAll(PURCHASE_STORE)).sort(comparePurchases);
    dreRecords = (await getAll(DRE_STORE)).sort(compareDreRecords);
    cashState = normalizeCashState((await getAll(CASH_STORE))[0]);
    accountEntries = (await getAll(ACCOUNT_STORE)).sort(compareAccountEntries);
    accountMonths = (await getAll(ACCOUNT_MONTH_STORE)).sort(compareAccountMonths);
  }
  renderInventory();
  renderShipments();
  renderPurchases();
  renderDre();
  renderCash();
  renderAccount();
  renderDashboard();
}

async function mirrorServerDataLocally(serverProducts, serverMovements, serverShipments, serverPurchases, serverDreRecords, serverCashState, serverAccountEntries, serverAccountMonths) {
  await writeStores([PRODUCT_STORE, MOVEMENT_STORE, SHIPMENT_STORE, PURCHASE_STORE, DRE_STORE, CASH_STORE, ACCOUNT_STORE, ACCOUNT_MONTH_STORE], ({ products: productStore, movements: movementStore, shipments: shipmentStore, purchases: purchaseStore, dreRecords: dreStore, cashState: cashStore, accountEntries: accountStore, accountMonths: accountMonthStore }) => {
    productStore.clear();
    movementStore.clear();
    shipmentStore.clear();
    purchaseStore.clear();
    dreStore.clear();
    cashStore.clear();
    accountStore.clear();
    accountMonthStore.clear();
    serverProducts.forEach((product) => productStore.put(product));
    serverMovements.forEach((movement) => movementStore.put(movement));
    serverShipments.forEach((shipment) => shipmentStore.put(shipment));
    serverPurchases.forEach((purchase) => purchaseStore.put(purchase));
    serverDreRecords.forEach((record) => dreStore.put(record));
    cashStore.put(normalizeCashState(serverCashState));
    serverAccountEntries.forEach((entry) => accountStore.put(entry));
    serverAccountMonths.forEach((monthState) => accountMonthStore.put(monthState));
  });
}

function bindEvents() {
  if (dom.loginForm) dom.loginForm.addEventListener("submit", handleLogin);
  if (dom.logoutButton) dom.logoutButton.addEventListener("click", handleLogout);
  dom.navTabs.addEventListener("click", handleTabClick);
  dom.toggleDashboardMoney.addEventListener("click", toggleDashboardMoneyVisibility);
  document.getElementById("openProductModal").addEventListener("click", () => openProductModal());
  document.getElementById("openImportModal").addEventListener("click", openImportModal);
  document.getElementById("addBatchRow").addEventListener("click", () => addBatchRow());
  dom.productForm.addEventListener("submit", saveProduct);
  dom.productPhoto.addEventListener("change", handleProductPhoto);
  dom.removePhoto.addEventListener("click", clearProductPhoto);
  dom.simpleForm.addEventListener("submit", saveSimpleAction);
  dom.importForm.addEventListener("submit", applyImportUpdates);
  dom.importFile.addEventListener("change", handleImportFile);
  dom.downloadTemplate.addEventListener("click", downloadTemplateCsv);
  dom.searchInput.addEventListener("input", renderInventory);
  dom.statusFilter.addEventListener("change", renderInventory);
  dom.openShipmentModal.addEventListener("click", () => openShipmentModal());
  dom.addShipmentItem.addEventListener("click", () => addShipmentProductRow());
  dom.shipmentForm.addEventListener("submit", saveShipment);
  dom.shipmentDateFilter.addEventListener("change", renderShipments);
  dom.shipmentsBody.addEventListener("click", handleShipmentTableClick);
  dom.openPurchaseModal.addEventListener("click", () => openPurchaseModal());
  dom.purchaseForm.addEventListener("submit", savePurchase);
  dom.purchaseStatusFilter.addEventListener("change", renderPurchases);
  dom.addPurchaseItem.addEventListener("click", () => addPurchaseItemRow());
  dom.purchaseSupplierSelect.addEventListener("change", handlePurchaseSupplierChange);
  dom.purchasesBody.addEventListener("click", handlePurchaseTableClick);
  dom.purchasesBody.addEventListener("change", handlePurchaseSelectionChange);
  dom.exportRetiradaPdf.addEventListener("click", exportSelectedRetiradaPurchasesPdf);
  dom.selectAllRetiradaPurchases.addEventListener("change", toggleRetiradaPurchaseSelection);
  dom.purchaseAttachment.addEventListener("change", handlePurchaseAttachment);
  dom.removePurchaseAttachment.addEventListener("click", clearPurchaseAttachment);
  dom.openDreModal.addEventListener("click", () => openDreModal());
  dom.dreForm.addEventListener("submit", saveDreRecord);
  dom.addDreIncome.addEventListener("click", () => addDreLine("income"));
  dom.addDreExpense.addEventListener("click", () => addDreLine("expense"));
  dom.dreIncomeRows.addEventListener("input", updateDrePreview);
  dom.dreExpenseRows.addEventListener("input", updateDrePreview);
  dom.dreRevenue.addEventListener("input", updateDrePreview);
  dom.dreBody.addEventListener("click", handleDreTableClick);
  dom.cashForm.addEventListener("submit", saveCashState);
  dom.accountMonthFilter.addEventListener("change", renderAccount);
  dom.accountOpeningForm.addEventListener("submit", saveAccountOpeningBalance);
  dom.exportAccountPdf.addEventListener("click", exportAccountMonthPdf);
  dom.openAccountBulkModal.addEventListener("click", openAccountBulkModal);
  dom.addAccountBulkRow.addEventListener("click", () => addAccountBulkRow());
  dom.accountBulkForm.addEventListener("submit", saveAccountBulkEntries);
  dom.accountBulkRows.addEventListener("click", handleAccountBulkRowsClick);
  dom.openAccountEntryModal.addEventListener("click", () => openAccountEntryModal());
  dom.accountEntryForm.addEventListener("submit", saveAccountEntry);
  dom.accountBody.addEventListener("click", handleAccountTableClick);

  document.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-dialog]")) {
      event.target.closest("dialog").close();
    }

    if (!event.target.closest(".actions")) {
      document.querySelectorAll(".actions.open").forEach((item) => item.classList.remove("open"));
    }
  });

  dom.body.addEventListener("click", handleTableClick);
}

function handleTabClick(event) {
  const button = event.target.closest("[data-tab]");
  if (!button) {
    const navButton = event.target.closest("button");
    if (navButton) showToast("Esta aba ainda nao foi implementada.");
    return;
  }

  setActiveTab(button.dataset.tab);
}

function setActiveTab(tabName) {
  activeTab = tabName;
  dom.dashboardView.hidden = tabName !== "dashboard";
  dom.inventoryView.hidden = tabName !== "inventory";
  dom.shipmentsView.hidden = tabName !== "shipments";
  dom.purchasesView.hidden = tabName !== "purchases";
  dom.dreView.hidden = tabName !== "dre";
  dom.cashView.hidden = tabName !== "cash";
  dom.accountView.hidden = tabName !== "account";
  dom.navTabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
}

function compareShipments(a, b) {
  return `${a.date || ""} ${a.time || ""}`.localeCompare(`${b.date || ""} ${b.time || ""}`);
}

function shipmentDateTimeKey(shipment) {
  return `${shipment.date || ""} ${shipment.time || "00:00"}`;
}

function isPastShipment(shipment) {
  return shipmentDateTimeKey(shipment) < currentDateTimeKey();
}

function getFilteredShipments() {
  const filter = dom.shipmentDateFilter.value || "upcoming";
  if (filter === "past") return shipments.filter(isPastShipment);
  if (filter === "all") return shipments;
  return shipments.filter((shipment) => !isPastShipment(shipment));
}

function comparePurchases(a, b) {
  return (b.createdAt || 0) - (a.createdAt || 0);
}

function compareDreRecords(a, b) {
  return String(b.month || "").localeCompare(String(a.month || ""));
}

function compareAccountEntries(a, b) {
  return String(b.date || "").localeCompare(String(a.date || "")) || (b.createdAt || 0) - (a.createdAt || 0);
}

function compareAccountMonths(a, b) {
  return String(b.monthKey || "").localeCompare(String(a.monthKey || ""));
}

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

function toInt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function toMoneyNumber(value) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyInputValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed).toFixed(2) : "0.00";
}

function parseIntegerCell(value) {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return NaN;
  let normalized = raw;
  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) {
    normalized = raw.replace(/[.,]/g, "");
  } else if (raw.includes(",") && raw.includes(".")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (raw.includes(",")) {
    normalized = raw.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function calculateProduct(product) {
  const warehouse = Math.max(0, toInt(product.warehouseStock));
  const fba = Math.max(0, toInt(product.fbaStock));
  const total = warehouse + fba;
  const sales = Math.max(0, toInt(product.last15Sales));
  const stockValue = (product.batches || []).reduce((sum, batch) => {
    return sum + Math.max(0, Number(batch.remainingQty || 0)) * Math.max(0, Number(batch.unitCost || 0));
  }, 0);
  const averageCost = total > 0 ? stockValue / total : 0;
  const fbaTarget = sales * 2;
  const sendSuggestion = Math.max(0, Math.min(warehouse, fbaTarget - fba));
  const totalTarget = sales * 2.5;
  const purchaseNeed = Math.max(0, Math.ceil(totalTarget - total));
  const status = getStatus({ sales, sendSuggestion, purchaseNeed });

  return {
    warehouse,
    fba,
    total,
    sales,
    stockValue,
    averageCost,
    sendSuggestion: Math.ceil(sendSuggestion),
    purchaseNeed,
    status,
  };
}

function calculateStockTotalValue() {
  return products.reduce((sum, product) => sum + calculateProduct(product).stockValue, 0);
}

function calculateInventoryTotals() {
  return products.reduce(
    (acc, product) => {
      const calc = calculateProduct(product);
      acc.stockValue += calc.stockValue;
      acc.send += calc.sendSuggestion;
      acc.buy += calc.purchaseNeed;
      if (calc.status.key === "comprar") acc.buyProducts += 1;
      if (calc.status.key === "enviar") acc.sendProducts += 1;
      if (calc.status.key === "sem-vendas") acc.noSalesProducts += 1;
      return acc;
    },
    { stockValue: 0, send: 0, buy: 0, buyProducts: 0, sendProducts: 0, noSalesProducts: 0 },
  );
}

function getStatus({ sales, sendSuggestion, purchaseNeed }) {
  if (sales <= 0) return { key: "sem-vendas", label: "Sem vendas recentes" };
  if (purchaseNeed > 0) return { key: "comprar", label: "Comprar" };
  if (sendSuggestion > 0) return { key: "enviar", label: "Enviar para Amazon" };
  return { key: "adequado", label: "Estoque adequado" };
}

function renderDashboard() {
  const inventory = calculateInventoryTotals();
  const accountValue = Math.max(0, Number(cashState.accountValue || 0));
  const amazonReceivable = Math.max(0, Number(cashState.amazonReceivable || 0));
  const cashTotal = inventory.stockValue + accountValue + amazonReceivable;
  const purchaseStatusCounts = countBy(purchases, (purchase) => purchase.status || "Sem status");
  const nextShipment = shipments.find((shipment) => `${shipment.date} ${shipment.time}` >= currentDateTimeKey());
  const nextShipmentQty = nextShipment
    ? nextShipment.items.reduce((sum, item) => sum + toInt(item.quantity), 0)
    : 0;
  const latestDre = dreRecords[0];
  const latestDreCalc = latestDre ? calculateDre(latestDre) : null;

  dom.dashboardCashTotal.textContent = dashboardMoney(currency.format(cashTotal));
  dom.dashboardStockValue.textContent = dashboardMoney(currency.format(inventory.stockValue));
  dom.dashboardSendQty.textContent = number.format(inventory.send);
  dom.dashboardBuyQty.textContent = number.format(inventory.buy);

  dom.dashboardInventoryList.innerHTML = [
    dashboardLine("Produtos cadastrados", number.format(products.length)),
    dashboardLine("Produtos para comprar", number.format(inventory.buyProducts), "danger"),
    dashboardLine("Produtos para enviar Amazon", number.format(inventory.sendProducts), "info"),
    dashboardLine("Sem vendas recentes", number.format(inventory.noSalesProducts), "muted"),
  ].join("");

  dom.dashboardPurchasesList.innerHTML = [
    dashboardLine("A retirar", number.format(purchaseStatusCounts.get("Retirar") || 0), "danger"),
    dashboardLine("Comprar", number.format(purchaseStatusCounts.get("Comprar") || 0), "danger"),
    dashboardLine("Pedido/Pago", number.format((purchaseStatusCounts.get("Pedido") || 0) + (purchaseStatusCounts.get("Pago") || 0))),
    dashboardLine("Entregue", number.format(purchaseStatusCounts.get("Entregue") || 0), "success"),
  ].join("");

  dom.dashboardShipmentsList.innerHTML = nextShipment
    ? [
        dashboardLine("Proximo envio", `${formatInputDate(nextShipment.date)} ${nextShipment.time}`, "info"),
        dashboardLine("Local Amazon", shipmentLocationLabel(nextShipment)),
        dashboardLine("ID do agendamento", nextShipment.scheduleId),
        dashboardLine("Itens agendados", number.format(nextShipmentQty)),
      ].join("")
    : dashboardEmptyLine("Nenhum envio futuro cadastrado.");

  dom.dashboardDreList.innerHTML = latestDre
    ? [
        dashboardLine("Mes", formatMonth(latestDre.month)),
        dashboardLine("Faturamento", dashboardMoney(currency.format(latestDre.revenue || 0)), "", true),
        dashboardLine("Lucro liquido", dashboardMoney(currency.format(latestDreCalc.netProfit)), latestDreCalc.netProfit < 0 ? "danger" : "success", true),
        dashboardLine("Margem", formatPercent(latestDreCalc.margin)),
      ].join("")
    : dashboardEmptyLine("Nenhum fechamento DRE cadastrado.");
  updateDashboardMoneyToggle();
}

function dashboardLine(label, value, tone = "", isMoney = false) {
  const toneClass = tone ? ` dashboard-value-${tone}` : "";
  const moneyAttribute = isMoney ? " data-money-value" : "";
  return `
    <div class="dashboard-line">
      <span>${escapeHtml(label)}</span>
      <strong class="${toneClass.trim()}"${moneyAttribute}>${escapeHtml(value)}</strong>
    </div>
  `;
}

function dashboardMoney(value) {
  return dashboardMoneyVisible ? value : "R$ ****";
}

function toggleDashboardMoneyVisibility() {
  dashboardMoneyVisible = !dashboardMoneyVisible;
  localStorage.setItem("dashboardMoneyVisible", dashboardMoneyVisible ? "true" : "false");
  renderDashboard();
}

function updateDashboardMoneyToggle() {
  const label = dashboardMoneyVisible ? "Ocultar valores em dinheiro" : "Mostrar valores em dinheiro";
  dom.toggleDashboardMoney.classList.toggle("values-hidden", !dashboardMoneyVisible);
  dom.toggleDashboardMoney.setAttribute("aria-label", label);
  dom.toggleDashboardMoney.setAttribute("title", label);
}

function dashboardEmptyLine(text) {
  return `<div class="dashboard-empty">${escapeHtml(text)}</div>`;
}

function countBy(items, keyFn) {
  return items.reduce((map, item) => {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
}

function renderInventory() {
  const query = normalize(dom.searchInput.value);
  const status = dom.statusFilter.value;
  const rows = products
    .map((product) => ({ product, calc: calculateProduct(product) }))
    .filter(({ product, calc }) => {
      const matchesQuery = [product.name, product.asin, product.sku].some((value) => normalize(value).includes(query));
      const matchesStatus = status === "all" || calc.status.key === status;
      return matchesQuery && matchesStatus;
    });

  dom.body.innerHTML = rows.map(({ product, calc }) => productRow(product, calc)).join("");
  dom.emptyState.hidden = rows.length > 0;
  renderMetrics();
}

function productRow(product, calc) {
  return `
    <tr>
      <td>${escapeHtml(product.asin)}</td>
      <td>${escapeHtml(product.sku)}</td>
      <td class="product-cell">
        <div class="product-info">
          ${renderProductThumb(product)}
          <div><strong>${escapeHtml(product.name)}</strong><span>${(product.batches || []).length} lote(s)</span></div>
        </div>
      </td>
      <td class="numeric">${number.format(calc.warehouse)}</td>
      <td class="numeric">${number.format(calc.fba)}</td>
      <td class="numeric">${number.format(calc.total)}</td>
      <td class="numeric">${number.format(calc.sales)}</td>
      <td class="numeric">${number.format(calc.sendSuggestion)}</td>
      <td class="numeric">${number.format(calc.purchaseNeed)}</td>
      <td class="numeric">${currency.format(calc.averageCost)}</td>
      <td class="numeric">${currency.format(calc.stockValue)}</td>
      <td><span class="status-pill status-${calc.status.key}">${calc.status.label}</span></td>
      <td>
        <div class="actions" data-id="${product.id}">
          <button class="action-toggle" type="button" data-action="toggle-actions">Acoes</button>
          <div class="action-menu">
            <button type="button" data-action="edit">Editar produto</button>
            <button type="button" data-action="delete" class="danger-text">Excluir produto</button>
            <button type="button" data-action="add-batch">Adicionar lote</button>
            <button type="button" data-action="movement">Registrar movimentacao</button>
            <button type="button" data-action="send">Registrar envio para Amazon</button>
            <button type="button" data-action="details">Ver detalhes</button>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function renderProductThumb(product) {
  if (product.photoData) {
    return `<div class="product-thumb"><img src="${escapeAttribute(product.photoData)}" alt="Foto de ${escapeAttribute(product.name)}" /></div>`;
  }

  return `<div class="product-thumb" aria-hidden="true">${escapeHtml(getInitials(product.name))}</div>`;
}

function getInitials(name) {
  const parts = String(name || "Produto").trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "P";
}

function renderMetrics() {
  const totals = calculateInventoryTotals();

  dom.metricProducts.textContent = number.format(products.length);
  dom.metricValue.textContent = currency.format(totals.stockValue);
  dom.metricSend.textContent = number.format(totals.send);
  dom.metricBuy.textContent = number.format(totals.buy);
}

function renderShipments() {
  const filteredShipments = getFilteredShipments();
  dom.shipmentsBody.innerHTML = filteredShipments.map((shipment) => shipmentRow(shipment)).join("");
  dom.emptyShipmentsState.hidden = filteredShipments.length > 0;
  renderShipmentEmptyState(filteredShipments.length);
  renderShipmentMetrics(filteredShipments);
}

function shipmentRow(shipment) {
  const totalQty = shipment.items.reduce((sum, item) => sum + item.quantity, 0);
  const locationLabel = shipmentLocationLabel(shipment);
  const chips = shipment.items
    .slice(0, 4)
    .map((item) => `<span class="shipment-product-chip">${escapeHtml(item.sku)} - ${number.format(item.quantity)}</span>`)
    .join("");
  const more = shipment.items.length > 4 ? `<span class="shipment-product-chip">+${shipment.items.length - 4}</span>` : "";

  return `
    <tr>
      <td><span class="shipment-id">${escapeHtml(shipment.scheduleId)}</span></td>
      <td>${formatInputDate(shipment.date)}</td>
      <td>${escapeHtml(shipment.time)}</td>
      <td><div class="shipment-location">${escapeHtml(locationLabel)}</div></td>
      <td><div class="shipment-products">${chips}${more}</div></td>
      <td class="numeric">${number.format(totalQty)}</td>
      <td>
        <div class="actions" data-shipment-id="${shipment.id}">
          <button class="action-toggle" type="button" data-shipment-action="toggle-actions">Acoes</button>
          <div class="action-menu">
            <button type="button" data-shipment-action="edit">Editar agendamento</button>
            <button type="button" data-shipment-action="delete" class="danger-text">Excluir agendamento</button>
            <button type="button" data-shipment-action="details">Ver detalhes</button>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function shipmentLocationLabel(shipment) {
  return shipment.location || "Nao informado";
}

function renderShipmentEmptyState(visibleCount) {
  if (visibleCount > 0) return;

  const filter = dom.shipmentDateFilter.value || "upcoming";
  const title = dom.emptyShipmentsState.querySelector("strong");
  const message = dom.emptyShipmentsState.querySelector("span");
  if (!title || !message) return;

  if (filter === "past") {
    title.textContent = "Nenhum agendamento antigo";
    message.textContent = "Quando um envio passar da data e horario, ele ficara disponivel neste filtro.";
    return;
  }

  if (filter === "all") {
    title.textContent = "Nenhum agendamento cadastrado";
    message.textContent = "Cadastre um envio para organizar os produtos que serao enviados para a Amazon.";
    return;
  }

  title.textContent = "Nenhum agendamento futuro";
  message.textContent = "Os agendamentos antigos ficam ocultos aqui. Use o filtro para consultar o historico.";
}

function renderShipmentMetrics(visibleShipments = getFilteredShipments()) {
  const totalItems = visibleShipments.reduce((sum, shipment) => {
    return sum + shipment.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);
  const productIds = new Set(visibleShipments.flatMap((shipment) => shipment.items.map((item) => item.productId)));
  const nextShipment = shipments.find((shipment) => `${shipment.date} ${shipment.time}` >= currentDateTimeKey());

  dom.metricShipments.textContent = number.format(visibleShipments.length);
  dom.metricShipmentItems.textContent = number.format(totalItems);
  dom.metricNextShipment.textContent = nextShipment ? `${formatInputDate(nextShipment.date)} ${nextShipment.time}` : "-";
  dom.metricShipmentProducts.textContent = number.format(productIds.size);
}

function openShipmentModal(shipment = null) {
  dom.shipmentForm.reset();
  dom.shipmentError.textContent = "";
  dom.shipmentProductRows.innerHTML = "";
  dom.shipmentRecordId.value = shipment?.id || "";
  dom.shipmentDialogTitle.textContent = shipment ? "Editar Agendamento" : "Cadastrar Agendamento";

  if (!products.length) {
    dom.shipmentError.textContent = "Cadastre produtos no estoque antes de criar um agendamento.";
  }

  if (shipment) {
    dom.shipmentScheduleId.value = shipment.scheduleId;
    dom.shipmentDate.value = shipment.date;
    dom.shipmentTime.value = shipment.time;
    dom.shipmentLocation.value = shipment.location || "";
    shipment.items.forEach((item) => addShipmentProductRow(item));
  } else {
    dom.shipmentDate.value = new Date().toISOString().slice(0, 10);
    dom.shipmentTime.value = "09:00";
    dom.shipmentLocation.value = "";
    addShipmentProductRow();
  }

  dom.shipmentDialog.showModal();
}

function addShipmentProductRow(item = null) {
  const row = document.createElement("div");
  row.className = "shipment-product-row";
  row.innerHTML = `
    <label>
      Produto
      <select class="shipment-product-select" required>
        ${productOptions(item?.productId)}
      </select>
    </label>
    <label>
      Quantidade
      <input class="shipment-product-qty" type="number" min="1" step="1" value="${item ? item.quantity : 1}" required />
    </label>
    <button class="danger-button" type="button" data-remove-shipment-product>Remover</button>
  `;
  row.querySelector("[data-remove-shipment-product]").addEventListener("click", () => row.remove());
  dom.shipmentProductRows.appendChild(row);
}

function productOptions(selectedId = "") {
  if (!products.length) return `<option value="">Nenhum produto cadastrado</option>`;
  return products
    .map((product) => {
      const selected = product.id === selectedId ? "selected" : "";
      return `<option value="${escapeAttribute(product.id)}" ${selected}>${escapeHtml(product.sku)} - ${escapeHtml(product.name)}</option>`;
    })
    .join("");
}

async function saveShipment(event) {
  event.preventDefault();
  dom.shipmentError.textContent = "";

  try {
    const shipment = buildShipmentFromForm();
    validateShipment(shipment);
    await saveShipmentRecord(shipment);
    dom.shipmentDialog.close();
    await refreshData();
    showToast("Agendamento salvo.");
    setActiveTab("shipments");
  } catch (error) {
    dom.shipmentError.textContent = error.message || "Nao foi possivel salvar o agendamento.";
  }
}

function buildShipmentFromForm() {
  const id = dom.shipmentRecordId.value || uid();
  const existing = shipments.find((shipment) => shipment.id === id);
  const items = readShipmentRows();

  return {
    id,
    scheduleId: dom.shipmentScheduleId.value.trim(),
    scheduleIdKey: normalize(dom.shipmentScheduleId.value),
    date: dom.shipmentDate.value,
    time: dom.shipmentTime.value,
    location: dom.shipmentLocation.value.trim(),
    items,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

function readShipmentRows() {
  const rows = [...dom.shipmentProductRows.querySelectorAll(".shipment-product-row")];
  return rows.map((row) => {
    const productId = row.querySelector(".shipment-product-select").value;
    const quantity = toInt(row.querySelector(".shipment-product-qty").value);
    const product = products.find((item) => item.id === productId);
    if (!product) throw new Error("Selecione um produto valido.");
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantidade deve ser maior que zero.");

    return {
      productId: product.id,
      asin: product.asin,
      sku: product.sku,
      name: product.name,
      quantity,
    };
  });
}

function validateShipment(shipment) {
  if (!shipment.scheduleId) throw new Error("Informe o ID do agendamento.");
  if (!shipment.date) throw new Error("Informe a data do agendamento.");
  if (!shipment.time) throw new Error("Informe o horario do agendamento.");
  if (!shipment.location) throw new Error("Informe o local de envio para Amazon.");
  if (!shipment.items.length) throw new Error("Adicione pelo menos um produto.");

  const duplicatedSchedule = shipments.find(
    (item) => item.id !== shipment.id && item.scheduleIdKey === shipment.scheduleIdKey,
  );
  if (duplicatedSchedule) throw new Error("Ja existe um agendamento com este ID.");

  const productIds = new Set();
  shipment.items.forEach((item) => {
    if (productIds.has(item.productId)) throw new Error("O mesmo produto nao pode aparecer duas vezes no agendamento.");
    productIds.add(item.productId);
  });
}

async function saveShipmentRecord(shipment) {
  if (backendEnabled) {
    await apiRequest("/api/shipments", { method: "POST", body: shipment });
    return;
  }

  await writeStores([SHIPMENT_STORE], ({ shipments: store }) => {
    store.put(shipment);
  });
}

function handleShipmentTableClick(event) {
  const actionButton = event.target.closest("[data-shipment-action]");
  if (!actionButton) return;

  const action = actionButton.dataset.shipmentAction;
  const wrapper = actionButton.closest(".actions");
  const shipment = shipments.find((item) => item.id === wrapper?.dataset.shipmentId);
  if (!shipment) return;

  if (action === "toggle-actions") {
    document.querySelectorAll(".actions.open").forEach((item) => {
      if (item !== wrapper) item.classList.remove("open");
    });
    wrapper.classList.toggle("open");
    return;
  }

  wrapper.classList.remove("open");
  if (action === "edit") openShipmentModal(shipment);
  if (action === "delete") deleteShipment(shipment);
  if (action === "details") openShipmentDetails(shipment);
}

async function deleteShipment(shipment) {
  if (!confirm(`Excluir o agendamento ${shipment.scheduleId}?`)) return;

  if (backendEnabled) {
    await apiRequest(`/api/shipments/${encodeURIComponent(shipment.id)}`, { method: "DELETE" });
  } else {
    await writeStores([SHIPMENT_STORE], ({ shipments: store }) => {
      store.delete(shipment.id);
    });
  }

  await refreshData();
  showToast("Agendamento excluido.");
}

function openShipmentDetails(shipment) {
  const totalQty = shipment.items.reduce((sum, item) => sum + item.quantity, 0);
  dom.detailsTitle.textContent = `Agendamento ${shipment.scheduleId}`;
  dom.detailsContent.innerHTML = `
    <div class="details-grid">
      <div class="details-item"><span>ID</span><strong>${escapeHtml(shipment.scheduleId)}</strong></div>
      <div class="details-item"><span>Data</span><strong>${formatInputDate(shipment.date)}</strong></div>
      <div class="details-item"><span>Horario</span><strong>${escapeHtml(shipment.time)}</strong></div>
      <div class="details-item"><span>Local Amazon</span><strong>${escapeHtml(shipmentLocationLabel(shipment))}</strong></div>
      <div class="details-item"><span>Quantidade total</span><strong>${number.format(totalQty)}</strong></div>
    </div>
    <div>
      <h3>Produtos para envio</h3>
      <table class="mini-table">
        <thead><tr><th>ASIN</th><th>SKU</th><th>Produto</th><th class="numeric">Quantidade</th></tr></thead>
        <tbody>
          ${shipment.items
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.asin)}</td>
                  <td>${escapeHtml(item.sku)}</td>
                  <td>${escapeHtml(item.name)}</td>
                  <td class="numeric">${number.format(item.quantity)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
  dom.detailsDialog.showModal();
}

function renderDre() {
  const orderedRecords = dreRecords.slice().sort(compareDreRecords);
  dom.dreBody.innerHTML = orderedRecords.map((record) => dreRow(record)).join("");
  dom.emptyDreState.hidden = dreRecords.length > 0;
  renderDreMetrics();
}

function dreRow(record) {
  const calc = calculateDre(record);
  return `
    <tr>
      <td><span class="dre-month">${escapeHtml(formatMonth(record.month))}</span></td>
      <td class="numeric">${currency.format(record.revenue || 0)}</td>
      <td class="numeric">${currency.format(calc.incomeTotal)}</td>
      <td class="numeric">${currency.format(calc.expenseTotal)}</td>
      <td class="numeric"><strong class="${calc.netProfit < 0 ? "negative-value" : "positive-value"}">${currency.format(calc.netProfit)}</strong></td>
      <td class="numeric">${formatPercent(calc.margin)}</td>
      <td>
        <div class="actions" data-dre-id="${escapeAttribute(record.id)}">
          <button class="action-toggle" type="button" data-dre-action="toggle-actions">Acoes</button>
          <div class="action-menu">
            <button type="button" data-dre-action="edit">Editar fechamento</button>
            <button type="button" data-dre-action="details">Ver detalhes</button>
            <button type="button" data-dre-action="delete" class="danger-text">Excluir fechamento</button>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function renderDreMetrics() {
  const year = currentYearKey();
  const annualRecords = dreRecords.filter((record) => String(record.monthKey || record.month || "").startsWith(`${year}-`));
  const annual = annualRecords.reduce(
    (totals, record) => {
      const calc = calculateDre(record);
      totals.revenue += record.revenue || 0;
      totals.income += calc.incomeTotal;
      totals.expense += calc.expenseTotal;
      totals.netProfit += calc.netProfit;
      return totals;
    },
    { revenue: 0, income: 0, expense: 0, netProfit: 0 },
  );

  dom.metricDreRevenue.textContent = currency.format(annual.revenue);
  dom.metricDreIncome.textContent = currency.format(annual.income);
  dom.metricDreExpense.textContent = currency.format(annual.expense);
  dom.metricDreProfit.textContent = currency.format(annual.netProfit);
  dom.metricDreMargin.textContent = formatPercent(annual.revenue > 0 ? (annual.netProfit / annual.revenue) * 100 : 0);
}

function openDreModal(record = null) {
  dom.dreForm.reset();
  dom.dreError.textContent = "";
  dom.dreIncomeRows.innerHTML = "";
  dom.dreExpenseRows.innerHTML = "";
  dom.dreRecordId.value = record?.id || "";
  dom.dreDialogTitle.textContent = record ? "Editar Mes" : "Cadastrar Mes";

  if (record) {
    dom.dreMonth.value = record.month;
    dom.dreRevenue.value = record.revenue || 0;
    (record.incomes || []).forEach((line) => addDreLine("income", line));
    (record.expenses || []).forEach((line) => addDreLine("expense", line));
  } else {
    dom.dreMonth.value = new Date().toISOString().slice(0, 7);
    dom.dreRevenue.value = 0;
    DEFAULT_DRE_INCOMES.forEach((label) => addDreLine("income", { label, value: 0 }));
    DEFAULT_DRE_EXPENSES.forEach((label) => addDreLine("expense", { label, value: 0 }));
  }

  updateDrePreview();
  dom.dreDialog.showModal();
}

function addDreLine(type, line = null) {
  const row = document.createElement("div");
  row.className = "dre-line-row";
  row.dataset.lineId = line?.id || uid();
  row.innerHTML = `
    <label>
      Descricao
      <input class="dre-line-label" maxlength="100" value="${escapeAttribute(line?.label || "")}" required />
    </label>
    <label>
      Valor
      <input class="dre-line-value" type="number" min="0" step="0.01" value="${line ? line.value : 0}" required />
    </label>
    <button class="danger-button" type="button" data-remove-dre-line>Remover</button>
  `;
  row.querySelector("[data-remove-dre-line]").addEventListener("click", () => {
    row.remove();
    updateDrePreview();
  });
  row.querySelectorAll("input").forEach((input) => input.addEventListener("input", updateDrePreview));

  if (type === "income") dom.dreIncomeRows.appendChild(row);
  if (type === "expense") dom.dreExpenseRows.appendChild(row);
}

function readDreLines(container) {
  return [...container.querySelectorAll(".dre-line-row")]
    .map((row) => ({
      id: row.dataset.lineId || uid(),
      label: row.querySelector(".dre-line-label").value.trim(),
      value: toMoneyNumber(row.querySelector(".dre-line-value").value),
    }))
    .filter((line) => line.label || line.value > 0);
}

function buildDreFromForm() {
  const id = dom.dreRecordId.value || uid();
  const existing = dreRecords.find((record) => record.id === id);
  const month = dom.dreMonth.value;

  return {
    id,
    month,
    monthKey: month,
    revenue: toMoneyNumber(dom.dreRevenue.value),
    incomes: readDreLines(dom.dreIncomeRows),
    expenses: readDreLines(dom.dreExpenseRows),
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

function validateDre(record) {
  if (!record.month) throw new Error("Informe o mes do fechamento.");
  if (record.revenue < 0) throw new Error("Faturamento nao pode ser negativo.");
  if (!record.incomes.length) throw new Error("Adicione pelo menos uma entrada.");
  if (!record.expenses.length) throw new Error("Adicione pelo menos uma saida.");

  [...record.incomes, ...record.expenses].forEach((line) => {
    if (!line.label) throw new Error("Informe a descricao de todas as linhas.");
    if (line.value < 0) throw new Error("Valores nao podem ser negativos.");
  });

  const duplicatedMonth = dreRecords.find((item) => item.id !== record.id && item.monthKey === record.monthKey);
  if (duplicatedMonth) throw new Error("Ja existe uma DRE cadastrada para este mes.");
}

async function saveDreRecord(event) {
  event.preventDefault();
  dom.dreError.textContent = "";

  try {
    const record = buildDreFromForm();
    validateDre(record);
    await saveDreRecordData(record);
    dom.dreDialog.close();
    await refreshData();
    showToast("Fechamento salvo.");
    setActiveTab("dre");
  } catch (error) {
    dom.dreError.textContent = error.message || "Nao foi possivel salvar a DRE.";
  }
}

async function saveDreRecordData(record) {
  if (backendEnabled) {
    await apiRequest("/api/dre", { method: "POST", body: record });
    return;
  }

  await writeStores([DRE_STORE], ({ dreRecords: store }) => {
    store.put(record);
  });
}

function handleDreTableClick(event) {
  const actionButton = event.target.closest("[data-dre-action]");
  if (!actionButton) return;

  const action = actionButton.dataset.dreAction;
  const wrapper = actionButton.closest(".actions");
  const record = dreRecords.find((item) => item.id === wrapper?.dataset.dreId);
  if (!record) return;

  if (action === "toggle-actions") {
    document.querySelectorAll(".actions.open").forEach((item) => {
      if (item !== wrapper) item.classList.remove("open");
    });
    wrapper.classList.toggle("open");
    return;
  }

  wrapper.classList.remove("open");
  if (action === "edit") openDreModal(record);
  if (action === "details") openDreDetails(record);
  if (action === "delete") deleteDreRecord(record);
}

async function deleteDreRecord(record) {
  if (!confirm(`Excluir a DRE de ${formatMonth(record.month)}?`)) return;

  if (backendEnabled) {
    await apiRequest(`/api/dre/${encodeURIComponent(record.id)}`, { method: "DELETE" });
  } else {
    await writeStores([DRE_STORE], ({ dreRecords: store }) => {
      store.delete(record.id);
    });
  }

  await refreshData();
  showToast("Fechamento excluido.");
}

function updateDrePreview() {
  const record = {
    revenue: toMoneyNumber(dom.dreRevenue.value),
    incomes: readDreLines(dom.dreIncomeRows),
    expenses: readDreLines(dom.dreExpenseRows),
  };
  const calc = calculateDre(record);
  dom.dreIncomeTotal.textContent = currency.format(calc.incomeTotal);
  dom.dreExpenseTotal.textContent = currency.format(calc.expenseTotal);
  dom.dreNetProfit.textContent = currency.format(calc.netProfit);
  dom.dreMargin.textContent = formatPercent(calc.margin);
}

function calculateDre(record) {
  const incomeTotal = (record.incomes || []).reduce((sum, line) => sum + (line.value || 0), 0);
  const expenseTotal = (record.expenses || []).reduce((sum, line) => sum + (line.value || 0), 0);
  const netProfit = incomeTotal - expenseTotal;
  const margin = record.revenue > 0 ? (netProfit / record.revenue) * 100 : 0;
  return { incomeTotal, expenseTotal, netProfit, margin };
}

function openDreDetails(record) {
  const calc = calculateDre(record);
  dom.detailsTitle.textContent = `DRE ${formatMonth(record.month)}`;
  dom.detailsContent.innerHTML = `
    <div class="details-grid">
      <div class="details-item"><span>Faturamento</span><strong>${currency.format(record.revenue || 0)}</strong></div>
      <div class="details-item"><span>Entradas</span><strong>${currency.format(calc.incomeTotal)}</strong></div>
      <div class="details-item"><span>Saidas</span><strong>${currency.format(calc.expenseTotal)}</strong></div>
      <div class="details-item"><span>Lucro liquido</span><strong>${currency.format(calc.netProfit)}</strong></div>
      <div class="details-item"><span>Margem</span><strong>${formatPercent(calc.margin)}</strong></div>
    </div>
    <div class="dre-details-columns">
      ${dreDetailsTable("Entradas", record.incomes || [])}
      ${dreDetailsTable("Saidas", record.expenses || [])}
    </div>
  `;
  dom.detailsDialog.showModal();
}

function dreDetailsTable(title, lines) {
  return `
    <div>
      <h3>${escapeHtml(title)}</h3>
      <table class="mini-table">
        <thead><tr><th>Descricao</th><th class="numeric">Valor</th></tr></thead>
        <tbody>
          ${lines
            .map(
              (line) => `
                <tr>
                  <td>${escapeHtml(line.label)}</td>
                  <td class="numeric">${currency.format(line.value || 0)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCash() {
  const stockValue = calculateStockTotalValue();
  const accountValue = Math.max(0, Number(cashState.accountValue || 0));
  const amazonReceivable = Math.max(0, Number(cashState.amazonReceivable || 0));
  const total = stockValue + accountValue + amazonReceivable;

  dom.metricCashStock.textContent = currency.format(stockValue);
  dom.metricCashAccount.textContent = currency.format(accountValue);
  dom.metricCashAmazon.textContent = currency.format(amazonReceivable);
  dom.metricCashTotal.textContent = currency.format(total);

  if (document.activeElement !== dom.cashAccountValue) {
    dom.cashAccountValue.value = accountValue;
  }
  if (document.activeElement !== dom.cashAmazonReceivable) {
    dom.cashAmazonReceivable.value = amazonReceivable;
  }
}

function normalizeCashState(state) {
  return {
    id: "main",
    accountValue: Math.max(0, Number(state?.accountValue || 0)),
    amazonReceivable: Math.max(0, Number(state?.amazonReceivable || 0)),
    updatedAt: Number(state?.updatedAt || 0),
  };
}

async function saveCashState(event) {
  event.preventDefault();
  dom.cashError.textContent = "";

  try {
    const updated = {
      id: "main",
      accountValue: toMoneyNumber(dom.cashAccountValue.value),
      amazonReceivable: toMoneyNumber(dom.cashAmazonReceivable.value),
      updatedAt: Date.now(),
    };
    if (updated.accountValue < 0) throw new Error("Valor em conta nao pode ser negativo.");
    if (updated.amazonReceivable < 0) throw new Error("Valor a receber da Amazon nao pode ser negativo.");
    await saveCashStateData(updated);
    cashState = normalizeCashState(updated);
    renderCash();
    showToast("Caixa salvo.");
  } catch (error) {
    dom.cashError.textContent = error.message || "Nao foi possivel salvar o caixa.";
  }
}

async function saveCashStateData(state) {
  if (backendEnabled) {
    await apiRequest("/api/cash", { method: "POST", body: state });
    return;
  }

  await writeStores([CASH_STORE], ({ cashState: store }) => {
    store.put(state);
  });
}

function renderAccount() {
  ensureAccountMonth();
  const monthKey = dom.accountMonthFilter.value || currentMonthKey();
  const visibleEntries = filteredAccountEntries();
  const openingBalance = getAccountOpeningBalance(monthKey);
  const totals = calculateAccountTotals(visibleEntries, openingBalance);

  dom.metricAccountOpening.textContent = currency.format(openingBalance);
  dom.metricAccountIn.textContent = currency.format(totals.income);
  dom.metricAccountOut.textContent = currency.format(totals.expense);
  dom.metricAccountBalance.textContent = currency.format(totals.balance);
  dom.metricAccountBalance.classList.toggle("negative-value", totals.balance < 0);
  dom.metricAccountBalance.classList.toggle("positive-value", totals.balance >= 0);
  dom.metricAccountEntries.textContent = number.format(visibleEntries.length);
  if (document.activeElement !== dom.accountOpeningBalance) {
    dom.accountOpeningBalance.value = Number(openingBalance || 0).toFixed(2);
  }

  dom.accountBody.innerHTML = visibleEntries.map((entry) => accountEntryRow(entry)).join("");
  dom.emptyAccountState.hidden = visibleEntries.length > 0;
}

function ensureAccountMonth() {
  if (!dom.accountMonthFilter.value) {
    dom.accountMonthFilter.value = currentMonthKey();
  }
}

function filteredAccountEntries() {
  const month = dom.accountMonthFilter.value || currentMonthKey();
  return accountEntries.filter((entry) => entry.monthKey === month).sort(compareAccountEntries);
}

function getAccountMonthState(monthKey = dom.accountMonthFilter.value || currentMonthKey()) {
  return accountMonths.find((monthState) => monthState.monthKey === monthKey) || null;
}

function getAccountOpeningBalance(monthKey = dom.accountMonthFilter.value || currentMonthKey()) {
  return Number(getAccountMonthState(monthKey)?.openingBalance || 0);
}

function calculateAccountTotals(entries, openingBalance = 0) {
  return entries.reduce(
    (totals, entry) => {
      const value = Math.max(0, Number(entry.value || 0));
      if (entry.type === "Entrada") {
        totals.income += value;
        totals.balance += value;
      } else {
        totals.expense += value;
        totals.balance -= value;
      }
      return totals;
    },
    { income: 0, expense: 0, balance: Number(openingBalance || 0) },
  );
}

async function saveAccountOpeningBalance(event) {
  event.preventDefault();

  try {
    ensureAccountMonth();
    const monthKey = dom.accountMonthFilter.value || currentMonthKey();
    const openingBalance = toMoneyNumber(dom.accountOpeningBalance.value);
    const monthState = {
      monthKey,
      openingBalance,
      updatedAt: Date.now(),
    };
    await saveAccountMonthState(monthState);
    await refreshData();
    dom.accountMonthFilter.value = monthKey;
    renderAccount();
    showToast("Saldo inicial salvo.");
    setActiveTab("account");
  } catch (error) {
    showToast(error.message || "Nao foi possivel salvar o saldo inicial.");
  }
}

async function saveAccountMonthState(monthState) {
  if (backendEnabled) {
    await apiRequest("/api/account-months", { method: "POST", body: monthState });
    return;
  }

  await writeStores([ACCOUNT_MONTH_STORE], ({ accountMonths: store }) => {
    store.put(monthState);
  });
}

function accountEntryRow(entry) {
  const valueClass = entry.type === "Entrada" ? "positive-value" : "negative-value";
  const signedValue = entry.type === "Entrada" ? entry.value : -entry.value;
  return `
    <tr>
      <td>${formatInputDate(entry.date)}</td>
      <td><span class="account-description">${escapeHtml(entry.description)}</span></td>
      <td><span class="status-pill ${entry.type === "Entrada" ? "adequado" : "comprar"}">${escapeHtml(entry.type)}</span></td>
      <td class="numeric ${valueClass}">${currency.format(signedValue)}</td>
      <td>${escapeHtml(entry.paymentMethod)}</td>
      <td>${escapeHtml(entry.invoiceNumber || "-")}</td>
      <td>${formatInputDate(entry.invoiceDate)}</td>
      <td>${escapeHtml(entry.installments || "-")}</td>
      <td><span class="account-notes">${escapeHtml(entry.notes || "-")}</span></td>
      <td>
        <div class="actions" data-account-entry-id="${entry.id}">
          <button class="action-toggle" type="button" data-account-action="toggle-actions">Acoes</button>
          <div class="action-menu">
            <button type="button" data-account-action="edit">Editar lancamento</button>
            <button type="button" data-account-action="delete" class="danger-text">Excluir lancamento</button>
            <button type="button" data-account-action="details">Ver detalhes</button>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function openAccountEntryModal(entry = null) {
  dom.accountEntryForm.reset();
  dom.accountEntryError.textContent = "";
  dom.accountEntryRecordId.value = entry?.id || "";
  dom.accountEntryDialogTitle.textContent = entry ? "Editar Lancamento" : "Cadastrar Lancamento";

  if (entry) {
    dom.accountEntryDate.value = entry.date;
    dom.accountEntryDescription.value = entry.description;
    dom.accountEntryType.value = entry.type;
    dom.accountEntryValue.value = entry.value;
    dom.accountEntryPayment.value = entry.paymentMethod;
    dom.accountEntryInvoiceNumber.value = entry.invoiceNumber || "";
    dom.accountEntryInvoiceDate.value = entry.invoiceDate || "";
    dom.accountEntryInstallments.value = entry.installments || "";
    dom.accountEntryNotes.value = entry.notes || "";
  } else {
    const month = dom.accountMonthFilter.value || currentMonthKey();
    dom.accountEntryDate.value = `${month}-01`;
    dom.accountEntryType.value = "Saida";
    dom.accountEntryValue.value = 0;
    dom.accountEntryPayment.value = "Pix";
  }

  dom.accountEntryDialog.showModal();
}

async function saveAccountEntry(event) {
  event.preventDefault();
  dom.accountEntryError.textContent = "";

  try {
    const entry = buildAccountEntryFromForm();
    validateAccountEntry(entry);
    await saveAccountEntryRecord(entry);
    dom.accountEntryDialog.close();
    await refreshData();
    dom.accountMonthFilter.value = entry.monthKey;
    renderAccount();
    showToast("Lancamento salvo.");
    setActiveTab("account");
  } catch (error) {
    dom.accountEntryError.textContent = error.message || "Nao foi possivel salvar o lancamento.";
  }
}

function openAccountBulkModal() {
  dom.accountBulkForm.reset();
  dom.accountBulkError.textContent = "";
  dom.accountBulkRows.innerHTML = "";
  const month = dom.accountMonthFilter.value || currentMonthKey();
  dom.accountBulkDate.value = `${month}-01`;
  dom.accountBulkType.value = "Saida";
  dom.accountBulkPayment.value = "Pix";
  addAccountBulkRow();
  addAccountBulkRow();
  addAccountBulkRow();
  dom.accountBulkDialog.showModal();
}

function addAccountBulkRow(value = "") {
  const row = document.createElement("div");
  row.className = "account-bulk-row";
  row.innerHTML = `
    <label>
      Valor
      <input class="account-bulk-value" type="number" min="0" step="0.01" value="${escapeAttribute(value)}" required />
    </label>
    <button class="danger-button" type="button" data-remove-account-bulk-row>Remover</button>
  `;
  dom.accountBulkRows.appendChild(row);
}

function handleAccountBulkRowsClick(event) {
  const removeButton = event.target.closest("[data-remove-account-bulk-row]");
  if (!removeButton) return;
  const row = removeButton.closest(".account-bulk-row");
  if (dom.accountBulkRows.querySelectorAll(".account-bulk-row").length <= 1) {
    dom.accountBulkError.textContent = "Mantenha pelo menos uma linha.";
    return;
  }
  row.remove();
}

async function saveAccountBulkEntries(event) {
  event.preventDefault();
  dom.accountBulkError.textContent = "";

  try {
    const entries = readAccountBulkRows();
    entries.forEach(validateAccountEntry);
    for (const entry of entries) {
      await saveAccountEntryRecord(entry);
    }
    dom.accountBulkDialog.close();
    await refreshData();
    dom.accountMonthFilter.value = entries[0].monthKey;
    renderAccount();
    showToast(`${number.format(entries.length)} lancamento(s) salvo(s).`);
    setActiveTab("account");
  } catch (error) {
    dom.accountBulkError.textContent = error.message || "Nao foi possivel salvar os lancamentos.";
  }
}

function readAccountBulkRows() {
  const rows = [...dom.accountBulkRows.querySelectorAll(".account-bulk-row")];
  const common = readAccountBulkCommonFields();
  const entries = rows
    .map((row) => buildAccountBulkEntry(row, common))
    .filter((entry) => entry.value > 0);

  if (!entries.length) throw new Error("Preencha pelo menos um lancamento.");
  return entries;
}

function readAccountBulkCommonFields() {
  return {
    date: dom.accountBulkDate.value,
    description: dom.accountBulkDescription.value.trim(),
    type: dom.accountBulkType.value,
    paymentMethod: dom.accountBulkPayment.value,
    invoiceNumber: dom.accountBulkInvoiceNumber.value.trim(),
    invoiceDate: dom.accountBulkInvoiceDate.value,
    installments: dom.accountBulkInstallments.value.trim(),
    notes: dom.accountBulkNotes.value.trim(),
  };
}

function buildAccountBulkEntry(row, common) {
  const date = common.date;
  return {
    id: uid(),
    date,
    monthKey: date.slice(0, 7),
    description: common.description,
    type: common.type,
    value: toMoneyNumber(row.querySelector(".account-bulk-value").value),
    paymentMethod: common.paymentMethod,
    invoiceNumber: common.invoiceNumber,
    invoiceDate: common.invoiceDate,
    installments: common.installments,
    notes: common.notes,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function buildAccountEntryFromForm() {
  const id = dom.accountEntryRecordId.value || uid();
  const existing = accountEntries.find((entry) => entry.id === id);
  const date = dom.accountEntryDate.value;
  return {
    id,
    date,
    monthKey: date.slice(0, 7),
    description: dom.accountEntryDescription.value.trim(),
    type: dom.accountEntryType.value,
    value: toMoneyNumber(dom.accountEntryValue.value),
    paymentMethod: dom.accountEntryPayment.value,
    invoiceNumber: dom.accountEntryInvoiceNumber.value.trim(),
    invoiceDate: dom.accountEntryInvoiceDate.value,
    installments: dom.accountEntryInstallments.value.trim(),
    notes: dom.accountEntryNotes.value.trim(),
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

function validateAccountEntry(entry) {
  if (!entry.date) throw new Error("Informe a data.");
  if (!entry.description) throw new Error("Informe a descricao.");
  if (!ACCOUNT_TYPES.includes(entry.type)) throw new Error("Selecione entrada ou saida.");
  if (!PAYMENT_METHODS.includes(entry.paymentMethod)) throw new Error("Selecione a forma de pagamento.");
  if (entry.value < 0) throw new Error("O valor nao pode ser negativo.");
}

async function saveAccountEntryRecord(entry) {
  if (backendEnabled) {
    await apiRequest("/api/account-entries", { method: "POST", body: entry });
    return;
  }

  await writeStores([ACCOUNT_STORE], ({ accountEntries: store }) => {
    store.put(entry);
  });
}

function handleAccountTableClick(event) {
  const actionButton = event.target.closest("[data-account-action]");
  if (!actionButton) return;

  const action = actionButton.dataset.accountAction;
  const wrapper = actionButton.closest(".actions");
  const entry = accountEntries.find((item) => item.id === wrapper?.dataset.accountEntryId);
  if (!entry) return;

  if (action === "toggle-actions") {
    document.querySelectorAll(".actions.open").forEach((item) => {
      if (item !== wrapper) item.classList.remove("open");
    });
    wrapper.classList.toggle("open");
    return;
  }

  wrapper.classList.remove("open");
  if (action === "edit") openAccountEntryModal(entry);
  if (action === "delete") deleteAccountEntry(entry);
  if (action === "details") openAccountEntryDetails(entry);
}

async function deleteAccountEntry(entry) {
  if (!confirm(`Excluir o lancamento "${entry.description}"?`)) return;

  if (backendEnabled) {
    await apiRequest(`/api/account-entries/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
  } else {
    await writeStores([ACCOUNT_STORE], ({ accountEntries: store }) => {
      store.delete(entry.id);
    });
  }

  await refreshData();
  showToast("Lancamento excluido.");
}

function openAccountEntryDetails(entry) {
  const signedValue = entry.type === "Entrada" ? entry.value : -entry.value;
  dom.detailsTitle.textContent = entry.description;
  dom.detailsContent.innerHTML = `
    <div class="details-grid">
      <div class="details-item"><span>Data</span><strong>${formatInputDate(entry.date)}</strong></div>
      <div class="details-item"><span>Tipo</span><strong>${escapeHtml(entry.type)}</strong></div>
      <div class="details-item"><span>Valor</span><strong>${currency.format(signedValue)}</strong></div>
      <div class="details-item"><span>Forma de pagamento</span><strong>${escapeHtml(entry.paymentMethod)}</strong></div>
      <div class="details-item"><span>Numero da nota fiscal</span><strong>${escapeHtml(entry.invoiceNumber || "-")}</strong></div>
      <div class="details-item"><span>Data da nota fiscal</span><strong>${formatInputDate(entry.invoiceDate)}</strong></div>
      <div class="details-item"><span>Parcelas</span><strong>${escapeHtml(entry.installments || "-")}</strong></div>
      <div class="details-item"><span>Mes</span><strong>${formatMonth(entry.monthKey)}</strong></div>
    </div>
    <div class="details-item">
      <span>Observacoes</span>
      <strong>${escapeHtml(entry.notes || "-")}</strong>
    </div>
  `;
  dom.detailsDialog.showModal();
}

function exportAccountMonthPdf() {
  ensureAccountMonth();
  const monthKey = dom.accountMonthFilter.value || currentMonthKey();
  const entries = filteredAccountEntries().slice().sort((a, b) => {
    return String(a.date || "").localeCompare(String(b.date || "")) || (a.createdAt || 0) - (b.createdAt || 0);
  });
  const openingBalance = getAccountOpeningBalance(monthKey);
  const totals = calculateAccountTotals(entries, openingBalance);

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("O navegador bloqueou a abertura do PDF.");
    return;
  }

  printWindow.document.write(buildAccountMonthPdfHtml(monthKey, entries, openingBalance, totals));
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 450);
}

function buildAccountMonthPdfHtml(monthKey, entries, openingBalance, totals) {
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  const rows = entries.length
    ? entries.map(accountPdfRow).join("")
    : `<tr><td colspan="8" class="empty">Nenhum lancamento neste mes.</td></tr>`;

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Conta PJ - ${escapeHtml(formatMonth(monthKey))}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 28px; color: #17211c; font-family: Arial, sans-serif; background: #fff; }
          header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #17211c; padding-bottom: 16px; margin-bottom: 18px; }
          h1 { margin: 0; font-size: 24px; }
          p { margin: 4px 0; }
          .muted { color: #5d6b63; font-size: 12px; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
          .field { border: 1px solid #dce4df; border-radius: 6px; padding: 10px; }
          .field span { display: block; color: #5d6b63; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 5px; }
          .field strong { font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #dce4df; padding: 8px; text-align: left; font-size: 11px; vertical-align: top; }
          th { background: #eef4f0; }
          .numeric { text-align: right; white-space: nowrap; }
          .positive { color: #287a4b; font-weight: 700; }
          .negative { color: #b93a3a; font-weight: 700; }
          .empty { text-align: center; color: #5d6b63; padding: 18px; }
          @media print {
            body { padding: 18px; }
            header { break-inside: avoid; }
            .summary { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Conta PJ - ${escapeHtml(formatMonth(monthKey))}</h1>
            <p class="muted">Documento gerado em ${escapeHtml(generatedAt)}</p>
          </div>
          <p><strong>Lancamentos:</strong> ${number.format(entries.length)}</p>
        </header>
        <section class="summary">
          <div class="field"><span>Saldo inicial</span><strong>${currency.format(openingBalance)}</strong></div>
          <div class="field"><span>Entradas</span><strong class="positive">${currency.format(totals.income)}</strong></div>
          <div class="field"><span>Saidas</span><strong class="negative">${currency.format(totals.expense)}</strong></div>
          <div class="field"><span>Saldo final</span><strong>${currency.format(totals.balance)}</strong></div>
        </section>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descricao</th>
              <th>Tipo</th>
              <th class="numeric">Valor</th>
              <th>Pagamento</th>
              <th>No. NF</th>
              <th>Data NF</th>
              <th>Parcelas / Observacoes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
}

function accountPdfRow(entry) {
  const signedValue = entry.type === "Entrada" ? entry.value : -entry.value;
  const valueClass = entry.type === "Entrada" ? "positive" : "negative";
  const notes = [entry.installments, entry.notes].filter(Boolean).join(" - ") || "-";
  return `
    <tr>
      <td>${formatInputDate(entry.date)}</td>
      <td>${escapeHtml(entry.description)}</td>
      <td>${escapeHtml(entry.type)}</td>
      <td class="numeric ${valueClass}">${currency.format(signedValue)}</td>
      <td>${escapeHtml(entry.paymentMethod)}</td>
      <td>${escapeHtml(entry.invoiceNumber || "-")}</td>
      <td>${formatInputDate(entry.invoiceDate)}</td>
      <td>${escapeHtml(notes)}</td>
    </tr>
  `;
}

function renderPurchases() {
  const visiblePurchases = filteredPurchases();
  dom.purchasesBody.innerHTML = visiblePurchases.map((purchase) => purchaseRow(purchase)).join("");
  dom.emptyPurchasesState.hidden = visiblePurchases.length > 0;
  renderPurchaseMetrics(visiblePurchases);
}

function filteredPurchases() {
  const status = dom.purchaseStatusFilter.value;
  if (status === "open") return purchases.filter((purchase) => purchase.status !== "Recebido");
  if (status === "all") return purchases;
  return purchases.filter((purchase) => purchase.status === status);
}

function purchaseRow(purchase) {
  const items = purchaseItems(purchase);
  const totalQuantity = purchaseTotalQuantity(purchase);
  const chips = purchaseItemChips(items);
  const canExport = purchase.status === "Retirar";
  const orderLabel = purchaseOrderLabel(purchase);

  return `
    <tr>
      <td class="purchase-select-cell">
        <input class="purchase-select" type="checkbox" data-purchase-select="${escapeAttribute(purchase.id)}" ${canExport ? "" : "disabled"} aria-label="Selecionar compra ${escapeAttribute(orderLabel)}" />
      </td>
      <td><div class="purchase-items">${chips}</div></td>
      <td class="numeric">${number.format(totalQuantity)}</td>
      <td class="numeric">${currency.format(purchaseTotalValue(purchase))}</td>
      <td class="numeric">${number.format(purchase.boxes)}</td>
      <td>${escapeHtml(purchase.boxSize)}</td>
      <td>${escapeHtml(purchase.supplierName)}</td>
      <td><span class="purchase-order">${escapeHtml(orderLabel)}</span></td>
      <td><span class="status-pill status-${purchaseStatusKey(purchase.status)}">${escapeHtml(purchase.status)}</span></td>
      <td><div class="purchase-address">${escapeHtml(purchase.address)}</div></td>
      <td>
        <div class="actions" data-purchase-id="${purchase.id}">
          <button class="action-toggle" type="button" data-purchase-action="toggle-actions">Acoes</button>
          <div class="action-menu">
            <button type="button" data-purchase-action="edit">Editar compra</button>
            <button type="button" data-purchase-action="delete" class="danger-text">Excluir compra</button>
            <button type="button" data-purchase-action="details">Ver detalhes</button>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function purchaseOrderLabel(purchase) {
  return purchase.orderNumber || "Sem numero";
}

function purchaseItems(purchase) {
  const items = Array.isArray(purchase.items) ? purchase.items : [];
  const normalizedItems = items
    .map((item) => normalizePurchaseItem(item))
    .filter((item) => item.productId || item.name);

  if (normalizedItems.length) return applyPurchaseCostFallback(normalizedItems, purchase);
  if (!purchase.productId && !purchase.productName) return [];

  return applyPurchaseCostFallback(
    [
      normalizePurchaseItem({
        productId: purchase.productId || "",
        asin: purchase.asin || "",
        sku: purchase.sku || "",
        name: purchase.productName || "",
        quantity: purchase.quantity,
      }),
    ],
    purchase,
  );
}

function normalizePurchaseItem(item) {
  const quantity = toInt(item.quantity);
  const unitCost = toMoneyNumber(item.unitCost ?? item.cost ?? item.unitValue ?? 0);
  const totalValue = toMoneyNumber(item.totalValue ?? 0);
  const calculatedUnitCost = unitCost || (totalValue > 0 && quantity > 0 ? totalValue / quantity : 0);

  return {
    productId: item.productId || "",
    asin: item.asin || "",
    sku: item.sku || "",
    name: item.name || item.productName || "",
    quantity,
    unitCost: calculatedUnitCost,
    totalValue: totalValue || quantity * calculatedUnitCost,
  };
}

function applyPurchaseCostFallback(items, purchase) {
  const hasItemCost = items.some((item) => item.unitCost > 0 || item.totalValue > 0);
  if (hasItemCost) {
    return items.map((item) => ({
      ...item,
      totalValue: item.totalValue || item.quantity * item.unitCost,
    }));
  }

  return items.map((item) => ({
    ...item,
    totalValue: item.quantity * item.unitCost,
  }));
}

function purchaseTotalQuantity(purchase) {
  return purchaseItems(purchase).reduce((sum, item) => sum + toInt(item.quantity), 0);
}

function purchaseTotalValue(purchase) {
  const itemTotal = purchaseItems(purchase).reduce((sum, item) => sum + item.quantity * toMoneyNumber(item.unitCost), 0);
  return itemTotal || Math.max(0, Number(purchase.orderValue || 0));
}

function purchaseItemChips(items) {
  const chips = items
    .slice(0, 4)
    .map((item) => {
      const label = item.sku || item.asin || item.name;
      return `<span class="purchase-item-chip">${escapeHtml(label)} - ${number.format(item.quantity)} x ${currency.format(item.unitCost || 0)}</span>`;
    })
    .join("");
  const more = items.length > 4 ? `<span class="purchase-item-chip">+${items.length - 4}</span>` : "";
  return chips ? `${chips}${more}` : `<span class="muted-text">Sem produto</span>`;
}

function renderPurchaseMetrics(visiblePurchases = filteredPurchases()) {
  const totalValue = visiblePurchases.reduce((sum, purchase) => sum + purchaseTotalValue(purchase), 0);
  const pickupCount = visiblePurchases.filter((purchase) => purchase.status === "Retirar").length;
  const suppliers = new Set(visiblePurchases.map((purchase) => normalize(purchase.supplierName)).filter(Boolean));

  dom.metricPurchases.textContent = number.format(visiblePurchases.length);
  dom.metricPurchaseValue.textContent = currency.format(totalValue);
  dom.metricPurchasePickup.textContent = number.format(pickupCount);
  dom.metricPurchaseSuppliers.textContent = number.format(suppliers.size);
  updateRetiradaSelectAllState();
}

function openPurchaseModal(purchase = null) {
  dom.purchaseForm.reset();
  dom.purchaseError.textContent = "";
  dom.purchaseItemRows.innerHTML = "";
  dom.purchaseRecordId.value = purchase?.id || "";
  dom.purchaseDialogTitle.textContent = purchase ? "Editar Compra" : "Cadastrar Compra";
  currentPurchaseAttachment = purchase?.attachmentData || "";
  renderPurchaseAttachmentPreview();

  if (!products.length) {
    dom.purchaseError.textContent = "Cadastre produtos no estoque antes de criar uma compra.";
  }

  if (purchase) {
    purchaseItems(purchase).forEach((item) => addPurchaseItemRow(item));
    dom.purchaseSupplierName.value = purchase.supplierName;
    dom.purchaseAddress.value = purchase.address;
    dom.purchaseValue.value = moneyInputValue(purchaseTotalValue(purchase));
    dom.purchaseBoxes.value = purchase.boxes;
    dom.purchaseBoxSize.value = purchase.boxSize;
    dom.purchaseOrderNumber.value = purchase.orderNumber;
    dom.purchaseStatus.value = purchase.status;
    updatePurchaseSupplierOptions(purchase.supplierName);
  } else {
    addPurchaseItemRow();
    dom.purchaseValue.value = "0.00";
    dom.purchaseBoxes.value = 0;
    dom.purchaseStatus.value = "Comprar";
    updatePurchaseSupplierOptions();
  }

  dom.purchaseDialog.showModal();
}

function addPurchaseItemRow(item = null) {
  const row = document.createElement("div");
  row.className = "purchase-item-row";
  row.innerHTML = `
    <label>
      Produto
      <select class="purchase-item-product" required>
        ${productOptions(item?.productId)}
      </select>
    </label>
    <label>
      Quantidade
      <input class="purchase-item-qty" type="number" min="1" step="1" value="${item ? item.quantity : 1}" required />
    </label>
    <label>
      Valor unitario
      <input class="purchase-item-cost" type="number" min="0" step="0.01" value="${moneyInputValue(item?.unitCost || 0)}" required />
    </label>
    <button class="danger-button" type="button" data-remove-purchase-item>Remover</button>
  `;
  row.querySelector(".purchase-item-product").addEventListener("change", () => updatePurchaseSupplierOptions());
  row.querySelector(".purchase-item-qty").addEventListener("input", updatePurchaseOrderValuePreview);
  row.querySelector(".purchase-item-cost").addEventListener("input", updatePurchaseOrderValuePreview);
  row.querySelector("[data-remove-purchase-item]").addEventListener("click", () => {
    row.remove();
    updatePurchaseSupplierOptions();
    updatePurchaseOrderValuePreview();
  });
  dom.purchaseItemRows.appendChild(row);
  updatePurchaseSupplierOptions();
  updatePurchaseOrderValuePreview();
}

function updatePurchaseOrderValuePreview() {
  const total = [...dom.purchaseItemRows.querySelectorAll(".purchase-item-row")].reduce((sum, row) => {
    const quantity = toInt(row.querySelector(".purchase-item-qty")?.value);
    const unitCost = toMoneyNumber(row.querySelector(".purchase-item-cost")?.value);
    return sum + Math.max(0, quantity) * Math.max(0, unitCost);
  }, 0);
  dom.purchaseValue.value = moneyInputValue(total);
}

function selectedPurchaseProductIds() {
  return [...dom.purchaseItemRows.querySelectorAll(".purchase-item-product")]
    .map((select) => select.value)
    .filter(Boolean);
}

function getSavedPurchaseSuppliers() {
  const supplierMap = new Map();
  purchases
    .filter((purchase) => purchase.supplierName && purchase.address)
    .forEach((purchase) => {
      const key = normalize(purchase.supplierName);
      if (!key) return;
      supplierMap.set(key, {
        name: purchase.supplierName,
        address: purchase.address,
      });
    });
  return [...supplierMap.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getSuppliersForProducts(productIds) {
  const productSet = new Set(productIds);
  const savedSuppliers = getSavedPurchaseSuppliers();
  if (!productSet.size) return savedSuppliers;

  const linkedKeys = new Set();
  purchases
    .filter((purchase) => purchaseItems(purchase).some((item) => productSet.has(item.productId)))
    .forEach((purchase) => {
      const key = normalize(purchase.supplierName);
      if (key) linkedKeys.add(key);
    });

  const linked = savedSuppliers.filter((supplier) => linkedKeys.has(normalize(supplier.name)));
  const remaining = savedSuppliers.filter((supplier) => !linkedKeys.has(normalize(supplier.name)));
  return [...linked, ...remaining];
}

function updatePurchaseSupplierOptions(selectedSupplier = dom.purchaseSupplierName.value) {
  const suppliers = getSuppliersForProducts(selectedPurchaseProductIds());
  const selectedKey = normalize(selectedSupplier || dom.purchaseSupplierName.value);
  const options = suppliers
    .map((supplier) => {
      const selected = normalize(supplier.name) === selectedKey ? "selected" : "";
      return `<option value="${escapeAttribute(supplier.name)}" data-address="${escapeAttribute(supplier.address)}" ${selected}>${escapeHtml(supplier.name)}</option>`;
    })
    .join("");

  dom.purchaseSupplierSelect.innerHTML = `
    <option value="">Novo fornecedor</option>
    ${options}
  `;

  const selectedKnownSupplier = suppliers.some((supplier) => normalize(supplier.name) === selectedKey);
  if (selectedKnownSupplier) {
    handlePurchaseSupplierChange();
  } else {
    dom.purchaseSupplierSelect.value = "";
  }
}

function handlePurchaseSupplierChange() {
  const selected = dom.purchaseSupplierSelect.selectedOptions[0];
  if (!selected || !selected.value) {
    dom.purchaseSupplierName.value = "";
    dom.purchaseAddress.value = "";
    return;
  }

  dom.purchaseSupplierName.value = selected.value;
  dom.purchaseAddress.value = selected.dataset.address || "";
}

async function handlePurchaseAttachment() {
  const file = dom.purchaseAttachment.files[0];
  if (!file) return;

  try {
    if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem valida.");
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Use uma imagem de ate 10 MB.");
    }
    currentPurchaseAttachment = await resizePurchaseAttachmentFile(file);
    renderPurchaseAttachmentPreview();
  } catch (error) {
    dom.purchaseError.textContent = error.message || "Nao foi possivel carregar a imagem.";
    clearPurchaseAttachment();
  }
}

function clearPurchaseAttachment() {
  currentPurchaseAttachment = "";
  dom.purchaseAttachment.value = "";
  renderPurchaseAttachmentPreview();
}

function renderPurchaseAttachmentPreview() {
  if (currentPurchaseAttachment) {
    dom.purchaseAttachmentPreview.innerHTML = `<img src="${escapeAttribute(currentPurchaseAttachment)}" alt="Imagem anexada para retirada" />`;
  } else {
    dom.purchaseAttachmentPreview.innerHTML = "<span>Sem imagem</span>";
  }
}

async function savePurchase(event) {
  event.preventDefault();
  dom.purchaseError.textContent = "";

  try {
    const purchase = buildPurchaseFromForm();
    validatePurchase(purchase);
    const result = await savePurchaseData(purchase);
    dom.purchaseDialog.close();
    await refreshData();
    showToast(result.received ? "Compra salva e estoque atualizado." : "Compra salva.");
    setActiveTab("purchases");
  } catch (error) {
    dom.purchaseError.textContent = error.message || "Nao foi possivel salvar a compra.";
  }
}

function buildPurchaseFromForm() {
  const id = dom.purchaseRecordId.value || uid();
  const existing = purchases.find((purchase) => purchase.id === id);
  const items = readPurchaseRows();
  const firstItem = items[0];
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  return {
    id,
    items,
    productId: firstItem?.productId || "",
    asin: firstItem?.asin || "",
    sku: firstItem?.sku || "",
    productName: firstItem?.name || "",
    quantity: totalQuantity,
    orderValue: totalValue,
    boxes: toInt(dom.purchaseBoxes.value),
    boxSize: dom.purchaseBoxSize.value.trim(),
    supplierName: dom.purchaseSupplierName.value.trim(),
    supplierKey: normalize(dom.purchaseSupplierName.value),
    address: dom.purchaseAddress.value.trim(),
    orderNumber: dom.purchaseOrderNumber.value.trim(),
    orderNumberKey: normalize(dom.purchaseOrderNumber.value) || undefined,
    status: dom.purchaseStatus.value,
    attachmentData: currentPurchaseAttachment,
    receivedStockAt: existing?.receivedStockAt || null,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

function readPurchaseRows() {
  const rows = [...dom.purchaseItemRows.querySelectorAll(".purchase-item-row")];
  const productIds = new Set();

  return rows.map((row) => {
    const productId = row.querySelector(".purchase-item-product").value;
    const quantity = toInt(row.querySelector(".purchase-item-qty").value);
    const unitCost = toMoneyNumber(row.querySelector(".purchase-item-cost").value);
    const product = products.find((item) => item.id === productId);
    if (!product) throw new Error("Selecione um produto valido.");
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantidade deve ser maior que zero.");
    if (unitCost < 0) throw new Error("Valor unitario do produto nao pode ser negativo.");
    if (productIds.has(productId)) throw new Error("O mesmo produto nao pode aparecer duas vezes na compra.");
    productIds.add(productId);

    return {
      productId: product.id,
      asin: product.asin,
      sku: product.sku,
      name: product.name,
      quantity,
      unitCost,
      totalValue: quantity * unitCost,
    };
  });
}

function validatePurchase(purchase) {
  if (!purchase.items.length) throw new Error("Adicione pelo menos um produto.");
  if (purchaseTotalQuantity(purchase) <= 0) throw new Error("Quantidade deve ser maior que zero.");
  if (purchase.orderValue < 0) throw new Error("Valor do pedido nao pode ser negativo.");
  if (purchase.items.some((item) => toMoneyNumber(item.unitCost) < 0)) {
    throw new Error("Valor unitario do produto nao pode ser negativo.");
  }
  if (purchase.boxes < 0) throw new Error("Quantidade de caixas nao pode ser negativa.");
  if (!purchase.boxSize) throw new Error("Informe o tamanho da caixa.");
  if (!purchase.supplierName) throw new Error("Informe o fornecedor.");
  if (!purchase.address) throw new Error("Informe o endereco.");
  if (!PURCHASE_STATUSES.includes(purchase.status)) throw new Error("Selecione um status valido.");

  if (purchase.orderNumberKey) {
    const duplicatedOrder = purchases.find(
      (item) => item.id !== purchase.id && item.orderNumberKey === purchase.orderNumberKey,
    );
    if (duplicatedOrder) throw new Error("Ja existe uma compra com este numero de pedido.");
  }
}

async function savePurchaseRecord(purchase) {
  if (backendEnabled) {
    await apiRequest("/api/purchases", { method: "POST", body: purchase });
    return;
  }

  await writeStores([PURCHASE_STORE], ({ purchases: store }) => {
    store.put(purchase);
  });
}

async function savePurchaseData(purchase) {
  if (!shouldReceivePurchaseStock(purchase)) {
    await savePurchaseRecord(purchase);
    return { received: false };
  }

  const receipt = buildPurchaseReceiptUpdate(purchase);
  await savePurchaseReceiptData(receipt.purchase, receipt.products, receipt.movements);
  return { received: true };
}

function shouldReceivePurchaseStock(purchase) {
  return purchase.status === "Recebido" && !purchase.receivedStockAt;
}

function buildPurchaseReceiptUpdate(purchase) {
  const now = Date.now();
  const items = purchaseItems(purchase);
  const updatedProducts = [];
  const movements = [];

  items.forEach((item) => {
    const quantity = toInt(item.quantity);
    if (quantity <= 0) throw new Error("Quantidade recebida deve ser maior que zero.");

    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) throw new Error(`Produto ${item.sku || item.name || item.productId} nao encontrado no estoque.`);

    const updated = clone(product);
    updated.warehouseStock = toInt(updated.warehouseStock) + quantity;
    updated.batches = Array.isArray(updated.batches) ? updated.batches : [];
    updated.batches.push({
      id: uid(),
      initialQty: quantity,
      remainingQty: quantity,
      unitCost: toMoneyNumber(item.unitCost),
      receivedAt: now,
      source: "purchase",
      purchaseId: purchase.id,
    });
    updated.updatedAt = now;

    updatedProducts.push(updated);
    movements.push({
      id: uid(),
      productId: product.id,
      type: "compra-recebida",
      quantity,
      note: `Compra recebida - ${purchaseOrderLabel(purchase)}`,
      createdAt: now,
    });
  });

  return {
    purchase: {
      ...purchase,
      receivedStockAt: now,
      updatedAt: now,
    },
    products: updatedProducts,
    movements,
  };
}

async function savePurchaseReceiptData(purchase, updatedProducts, movements) {
  if (backendEnabled) {
    await apiRequest("/api/purchase-receive", {
      method: "POST",
      body: { purchase, products: updatedProducts, movements },
    });
    return;
  }

  await writeStores(
    [PURCHASE_STORE, PRODUCT_STORE, MOVEMENT_STORE],
    ({ purchases: purchaseStore, products: productStore, movements: movementStore }) => {
      purchaseStore.put(purchase);
      updatedProducts.forEach((product) => productStore.put(product));
      movements.forEach((movement) => movementStore.put(movement));
    },
  );
}

function handlePurchaseTableClick(event) {
  const actionButton = event.target.closest("[data-purchase-action]");
  if (!actionButton) return;

  const action = actionButton.dataset.purchaseAction;
  const wrapper = actionButton.closest(".actions");
  const purchase = purchases.find((item) => item.id === wrapper?.dataset.purchaseId);
  if (!purchase) return;

  if (action === "toggle-actions") {
    document.querySelectorAll(".actions.open").forEach((item) => {
      if (item !== wrapper) item.classList.remove("open");
    });
    wrapper.classList.toggle("open");
    return;
  }

  wrapper.classList.remove("open");
  if (action === "edit") openPurchaseModal(purchase);
  if (action === "delete") deletePurchase(purchase);
  if (action === "details") openPurchaseDetails(purchase);
}

function handlePurchaseSelectionChange(event) {
  if (!event.target.matches(".purchase-select")) return;
  updateRetiradaSelectAllState();
}

function toggleRetiradaPurchaseSelection() {
  const checked = dom.selectAllRetiradaPurchases.checked;
  dom.purchasesBody.querySelectorAll(".purchase-select:not(:disabled)").forEach((checkbox) => {
    checkbox.checked = checked;
  });
  updateRetiradaSelectAllState();
}

function updateRetiradaSelectAllState() {
  const available = [...dom.purchasesBody.querySelectorAll(".purchase-select:not(:disabled)")];
  const selected = available.filter((checkbox) => checkbox.checked);
  dom.selectAllRetiradaPurchases.disabled = available.length === 0;
  dom.selectAllRetiradaPurchases.checked = available.length > 0 && selected.length === available.length;
  dom.selectAllRetiradaPurchases.indeterminate = selected.length > 0 && selected.length < available.length;
}

async function deletePurchase(purchase) {
  if (!confirm(`Excluir a compra ${purchaseOrderLabel(purchase)}?`)) return;

  if (backendEnabled) {
    await apiRequest(`/api/purchases/${encodeURIComponent(purchase.id)}`, { method: "DELETE" });
  } else {
    await writeStores([PURCHASE_STORE], ({ purchases: store }) => {
      store.delete(purchase.id);
    });
  }

  await refreshData();
  showToast("Compra excluida.");
}

function openPurchaseDetails(purchase) {
  const items = purchaseItems(purchase);
  const attachment = purchase.attachmentData
    ? `<div class="details-item"><span>Imagem para retirada</span><strong>Imagem anexada e incluida no PDF.</strong></div>`
    : "";
  const receivedInfo = purchase.receivedStockAt
    ? `<div class="details-item"><span>Recebido no estoque</span><strong>${formatDateTime(purchase.receivedStockAt)}</strong></div>`
    : "";
  dom.detailsTitle.textContent = `Compra ${purchaseOrderLabel(purchase)}`;
  dom.detailsContent.innerHTML = `
    <div class="details-grid">
      <div class="details-item"><span>Produtos</span><strong>${number.format(items.length)}</strong></div>
      <div class="details-item"><span>Quantidade</span><strong>${number.format(purchaseTotalQuantity(purchase))}</strong></div>
      <div class="details-item"><span>Valor do pedido</span><strong>${currency.format(purchaseTotalValue(purchase))}</strong></div>
      <div class="details-item"><span>Status</span><strong>${escapeHtml(purchase.status)}</strong></div>
      <div class="details-item"><span>Fornecedor</span><strong>${escapeHtml(purchase.supplierName)}</strong></div>
      <div class="details-item"><span>No. do pedido</span><strong>${escapeHtml(purchaseOrderLabel(purchase))}</strong></div>
      <div class="details-item"><span>Caixas</span><strong>${number.format(purchase.boxes)}</strong></div>
      <div class="details-item"><span>Tamanho da caixa</span><strong>${escapeHtml(purchase.boxSize)}</strong></div>
      ${receivedInfo}
      ${attachment}
    </div>
    <div>
      <h3>Produtos da compra</h3>
      <table class="mini-table">
        <thead><tr><th>ASIN</th><th>SKU</th><th>Produto</th><th class="numeric">Quantidade</th><th class="numeric">Valor unitario</th><th class="numeric">Total</th></tr></thead>
        <tbody>
          ${items
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.asin)}</td>
                  <td>${escapeHtml(item.sku)}</td>
                  <td>${escapeHtml(item.name)}</td>
                  <td class="numeric">${number.format(item.quantity)}</td>
                  <td class="numeric">${currency.format(item.unitCost || 0)}</td>
                  <td class="numeric">${currency.format(item.quantity * (item.unitCost || 0))}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="details-item">
      <span>Endereco</span>
      <strong>${escapeHtml(purchase.address)}</strong>
    </div>
  `;
  dom.detailsDialog.showModal();
}

function exportSelectedRetiradaPurchasesPdf() {
  const selectedIds = [...dom.purchasesBody.querySelectorAll(".purchase-select:checked")]
    .map((checkbox) => checkbox.dataset.purchaseSelect)
    .filter(Boolean);
  const selectedPurchases = purchases.filter((purchase) => selectedIds.includes(purchase.id) && purchase.status === "Retirar");

  if (!selectedPurchases.length) {
    showToast("Selecione pelo menos uma compra com status Retirar.");
    return;
  }

  let pdfHtml = "";
  try {
    pdfHtml = buildRetiradaPdfHtml(selectedPurchases);
  } catch (error) {
    showToast("Nao foi possivel montar o PDF de retirada.");
    return;
  }

  const pdfBlob = new Blob([pdfHtml], { type: "text/html;charset=utf-8" });
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    URL.revokeObjectURL(pdfUrl);
    showToast("O navegador bloqueou a abertura do PDF.");
    return;
  }

  let printed = false;
  const printWhenReady = () => {
    if (printed) return;
    printed = true;
    printWindow.focus();
    printWindow.print();
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
  };

  printWindow.addEventListener("load", () => setTimeout(printWhenReady, 300), { once: true });
  printWindow.location.href = pdfUrl;
  setTimeout(printWhenReady, 2000);
}

function buildRetiradaPdfHtml(selectedPurchases) {
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Compras para retirada</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 28px; color: #17211c; font-family: Arial, sans-serif; background: #fff; }
          header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #17211c; padding-bottom: 16px; margin-bottom: 20px; }
          h1 { margin: 0; font-size: 24px; }
          h2 { margin: 0 0 10px; font-size: 18px; }
          p { margin: 4px 0; }
          .muted { color: #5d6b63; font-size: 12px; }
          .purchase { break-inside: avoid; page-break-inside: avoid; border: 1px solid #cfd8d2; border-radius: 8px; padding: 16px; margin: 0 0 18px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
          .field { border: 1px solid #e3e9e5; border-radius: 6px; padding: 9px; }
          .field span { display: block; color: #5d6b63; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
          .field strong { font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #dce4df; padding: 8px; text-align: left; font-size: 12px; vertical-align: top; }
          th { background: #eef4f0; }
          .numeric { text-align: right; }
          .attachment { margin-top: 18px; break-inside: avoid; page-break-inside: avoid; }
          .attachment h2 { margin-top: 0; }
          .attachment img { width: 100%; max-height: none; border: 1px solid #cfd8d2; border-radius: 8px; object-fit: contain; display: block; }
          @media print {
            body { padding: 18px; }
            .purchase { break-inside: avoid; }
            .attachment img { max-height: 58vh; }
          }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Compras para retirada</h1>
            <p class="muted">Documento gerado em ${escapeHtml(generatedAt)}</p>
          </div>
          <p><strong>Total:</strong> ${number.format(selectedPurchases.length)} compra(s)</p>
        </header>
        ${selectedPurchases.map((purchase) => retiradaPurchasePdfSection(purchase)).join("")}
      </body>
    </html>
  `;
}

function retiradaPurchasePdfSection(purchase) {
  const items = purchaseItems(purchase);
  const attachment = purchase.attachmentData
    ? `
      <div class="attachment">
        <h2>Imagem anexada</h2>
        <img src="${escapeAttribute(purchase.attachmentData)}" alt="Imagem da compra ${escapeAttribute(purchaseOrderLabel(purchase))}" />
      </div>
    `
    : "";

  return `
    <section class="purchase">
      <h2>Pedido ${escapeHtml(purchaseOrderLabel(purchase))}</h2>
      <div class="grid">
        <div class="field"><span>Fornecedor</span><strong>${escapeHtml(purchase.supplierName)}</strong></div>
        <div class="field"><span>Status</span><strong>${escapeHtml(purchase.status)}</strong></div>
        <div class="field"><span>Caixas</span><strong>${number.format(purchase.boxes)}</strong></div>
        <div class="field"><span>Tamanho da caixa</span><strong>${escapeHtml(purchase.boxSize)}</strong></div>
        <div class="field"><span>Valor do pedido</span><strong>${currency.format(purchaseTotalValue(purchase))}</strong></div>
        <div class="field"><span>Quantidade total</span><strong>${number.format(purchaseTotalQuantity(purchase))}</strong></div>
        <div class="field" style="grid-column: span 2;"><span>Endereco</span><strong>${escapeHtml(purchase.address)}</strong></div>
      </div>
      <table>
        <thead><tr><th>ASIN</th><th>SKU</th><th>Produto</th><th class="numeric">Quantidade</th><th class="numeric">Valor unitario</th><th class="numeric">Total</th></tr></thead>
        <tbody>
          ${items
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.asin)}</td>
                  <td>${escapeHtml(item.sku)}</td>
                  <td>${escapeHtml(item.name)}</td>
                  <td class="numeric">${number.format(item.quantity)}</td>
                  <td class="numeric">${currency.format(item.unitCost || 0)}</td>
                  <td class="numeric">${currency.format(item.quantity * (item.unitCost || 0))}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      ${attachment}
    </section>
  `;
}

function purchaseStatusKey(status) {
  if (status === "Comprar") return "comprar";
  if (status === "Pago") return "enviar";
  if (status === "Retirar") return "comprar";
  if (status === "Entregue") return "adequado";
  if (status === "Recebido") return "adequado";
  return "adequado";
}

function openProductModal(product = null) {
  dom.productForm.reset();
  dom.productError.textContent = "";
  dom.batchRows.innerHTML = "";
  currentProductPhoto = product?.photoData || "";
  renderPhotoPreview();
  dom.productId.value = product?.id || "";
  dom.productDialogTitle.textContent = product ? "Editar Produto" : "Cadastrar Produto";

  if (product) {
    dom.asin.value = product.asin;
    dom.sku.value = product.sku;
    dom.productName.value = product.name;
    dom.warehouseStock.value = product.warehouseStock;
    dom.fbaStock.value = product.fbaStock;
    dom.last15Sales.value = product.last15Sales;
    (product.batches || []).forEach((batch) => addBatchRow(batch));
  } else {
    dom.warehouseStock.value = 0;
    dom.fbaStock.value = 0;
    dom.last15Sales.value = 0;
    addBatchRow();
  }

  dom.productDialog.showModal();
}

async function handleProductPhoto() {
  dom.productError.textContent = "";
  const file = dom.productPhoto.files?.[0];
  if (!file) return;

  try {
    if (!file.type.startsWith("image/")) {
      throw new Error("Escolha um arquivo de imagem.");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("Use uma imagem de ate 2 MB.");
    }

    currentProductPhoto = await resizeImageFile(file);
    renderPhotoPreview();
  } catch (error) {
    dom.productPhoto.value = "";
    dom.productError.textContent = error.message;
  }
}

function resizeImageFile(file) {
  return resizeImageDataUrl(file, { maxSize: 360, quality: 0.76 });
}

function resizePurchaseAttachmentFile(file) {
  return resizeImageDataUrl(file, { maxSize: 1800, quality: 0.94 });
}

function resizeImageDataUrl(file, options) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = options.maxSize;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", options.quality));
      };
      image.onerror = () => reject(new Error("Nao foi possivel processar a imagem."));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function clearProductPhoto() {
  currentProductPhoto = "";
  dom.productPhoto.value = "";
  renderPhotoPreview();
}

function renderPhotoPreview() {
  if (currentProductPhoto) {
    dom.photoPreview.innerHTML = `<img src="${escapeAttribute(currentProductPhoto)}" alt="Previa da foto do produto" />`;
  } else {
    dom.photoPreview.innerHTML = "<span>Sem foto</span>";
  }
}

function addBatchRow(batch = null) {
  const row = document.createElement("div");
  row.className = "batch-row";
  row.dataset.batchId = batch?.id || uid();
  row.dataset.receivedAt = batch?.receivedAt || Date.now();
  row.innerHTML = `
    <label>
      Quantidade restante
      <input class="batch-qty" type="number" min="0" step="1" value="${batch ? batch.remainingQty : 0}" required />
    </label>
    <label>
      Custo unitario
      <input class="batch-cost" type="number" min="0" step="0.01" value="${batch ? batch.unitCost : 0}" required />
    </label>
    <button class="danger-button" type="button" data-remove-batch>Remover</button>
  `;
  row.querySelector("[data-remove-batch]").addEventListener("click", () => row.remove());
  dom.batchRows.appendChild(row);
}

async function saveProduct(event) {
  event.preventDefault();
  dom.productError.textContent = "";

  try {
    const id = dom.productId.value || uid();
    const warehouseStock = toInt(dom.warehouseStock.value);
    const fbaStock = toInt(dom.fbaStock.value);
    const last15Sales = toInt(dom.last15Sales.value);
    const batches = readBatchRows();

    assertNonNegativeInteger(warehouseStock, "Quantidade no galpao");
    assertNonNegativeInteger(fbaStock, "Quantidade no FBA");
    assertNonNegativeInteger(last15Sales, "Vendas dos ultimos 15 dias");

    const totalStock = warehouseStock + fbaStock;
    const batchTotal = batches.reduce((sum, batch) => sum + batch.remainingQty, 0);
    if (batchTotal !== totalStock) {
      throw new Error(`A soma dos lotes (${batchTotal}) precisa ser igual ao estoque total (${totalStock}).`);
    }

    const asin = dom.asin.value.trim();
    const sku = dom.sku.value.trim();
    const product = {
      id,
      asin,
      asinKey: normalize(asin),
      sku,
      skuKey: normalize(sku),
      name: dom.productName.value.trim(),
      photoData: currentProductPhoto,
      warehouseStock,
      fbaStock,
      last15Sales,
      batches,
      createdAt: products.find((item) => item.id === id)?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    validateProduct(product);
    await saveProductRecord(product);
    dom.productDialog.close();
    await refreshData();
    showToast("Produto salvo.");
  } catch (error) {
    dom.productError.textContent = humanizeDbError(error);
  }
}

function readBatchRows() {
  return [...dom.batchRows.querySelectorAll(".batch-row")]
    .map((row) => {
      const remainingQty = toInt(row.querySelector(".batch-qty").value);
      const unitCost = toMoneyNumber(row.querySelector(".batch-cost").value);
      if (remainingQty < 0 || unitCost < 0) {
        throw new Error("Quantidade e custo dos lotes nao podem ser negativos.");
      }
      return {
        id: row.dataset.batchId || uid(),
        initialQty: Math.max(remainingQty, toInt(row.dataset.initialQty || remainingQty)),
        remainingQty,
        unitCost,
        receivedAt: Number(row.dataset.receivedAt || Date.now()),
      };
    })
    .filter((batch) => batch.remainingQty > 0 || batch.unitCost > 0);
}

function validateProduct(product) {
  if (!product.asin) throw new Error("Informe o ASIN.");
  if (!product.sku) throw new Error("Informe o SKU.");
  if (!product.name) throw new Error("Informe o nome do produto.");
  if (product.warehouseStock < 0 || product.fbaStock < 0 || product.last15Sales < 0) {
    throw new Error("Nao e permitido informar valores negativos.");
  }
  if ((product.batches || []).some((batch) => batch.remainingQty < 0 || batch.unitCost < 0)) {
    throw new Error("Quantidade e custo dos lotes nao podem ser negativos.");
  }

  const duplicated = products.find(
    (item) =>
      item.id !== product.id && (item.asinKey === product.asinKey || item.skuKey === product.skuKey),
  );
  if (duplicated) {
    throw new Error("ASIN ou SKU ja cadastrado.");
  }
}

async function saveProductRecord(product) {
  if (backendEnabled) {
    await apiRequest("/api/products", { method: "POST", body: product });
    return;
  }

  await writeStores([PRODUCT_STORE], ({ products: store }) => {
    store.put(product);
  });
}

function handleTableClick(event) {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const action = actionButton.dataset.action;
  const wrapper = actionButton.closest(".actions");
  const product = products.find((item) => item.id === wrapper?.dataset.id);
  if (!product) return;

  if (action === "toggle-actions") {
    document.querySelectorAll(".actions.open").forEach((item) => {
      if (item !== wrapper) item.classList.remove("open");
    });
    wrapper.classList.toggle("open");
    return;
  }

  wrapper.classList.remove("open");
  if (action === "edit") openProductModal(product);
  if (action === "delete") deleteProduct(product);
  if (action === "add-batch") openSimpleAction("batch", product);
  if (action === "movement") openSimpleAction("movement", product);
  if (action === "send") openSimpleAction("send", product);
  if (action === "details") openDetails(product);
}

async function deleteProduct(product) {
  if (!confirm(`Excluir ${product.name}? Esta acao tambem remove o historico do produto.`)) return;

  if (backendEnabled) {
    await apiRequest(`/api/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
    await refreshData();
    showToast("Produto excluido.");
    return;
  }

  await writeStores([PRODUCT_STORE, MOVEMENT_STORE], ({ products: productStore, movements: movementStore }) => {
    productStore.delete(product.id);
    movements
      .filter((movement) => movement.productId === product.id)
      .forEach((movement) => movementStore.delete(movement.id));
  });

  await refreshData();
  showToast("Produto excluido.");
}

function openSimpleAction(action, product) {
  currentSimpleAction = action;
  currentSimpleProductId = product.id;
  dom.simpleError.textContent = "";
  dom.simpleForm.reset();

  if (action === "batch") {
    dom.simpleEyebrow.textContent = "Compra";
    dom.simpleTitle.textContent = `Adicionar lote - ${product.name}`;
    dom.simpleSubmit.textContent = "Adicionar lote";
    dom.simpleContent.innerHTML = `
      <label>Quantidade
        <input id="simpleQty" type="number" min="1" step="1" required />
      </label>
      <label>Custo unitario
        <input id="simpleCost" type="number" min="0" step="0.01" required />
      </label>
      <label>Observacao
        <input id="simpleNote" maxlength="160" placeholder="Opcional" />
      </label>
    `;
  }

  if (action === "send") {
    const calc = calculateProduct(product);
    dom.simpleEyebrow.textContent = "FBA Amazon";
    dom.simpleTitle.textContent = `Registrar envio - ${product.name}`;
    dom.simpleSubmit.textContent = "Registrar envio";
    dom.simpleContent.innerHTML = `
      <label>Quantidade enviada
        <input id="simpleQty" type="number" min="1" max="${calc.warehouse}" step="1" value="${calc.sendSuggestion || 1}" required />
      </label>
      <label>Observacao
        <input id="simpleNote" maxlength="160" placeholder="Opcional" />
      </label>
      <div class="details-item"><span>Disponivel no galpao</span><strong>${number.format(calc.warehouse)}</strong></div>
    `;
  }

  if (action === "movement") {
    dom.simpleEyebrow.textContent = "Movimentacao";
    dom.simpleTitle.textContent = `Registrar movimentacao - ${product.name}`;
    dom.simpleSubmit.textContent = "Registrar";
    dom.simpleContent.innerHTML = `
      <label>Tipo
        <select id="movementType" required>
          <option value="saida-galpao">Saida do galpao</option>
          <option value="saida-fba">Saida do FBA</option>
          <option value="entrada-galpao">Entrada no galpao</option>
          <option value="entrada-fba">Entrada no FBA</option>
        </select>
      </label>
      <label>Quantidade
        <input id="simpleQty" type="number" min="1" step="1" required />
      </label>
      <label id="movementCostWrap" hidden>Custo unitario
        <input id="simpleCost" type="number" min="0" step="0.01" />
      </label>
      <label>Observacao
        <input id="simpleNote" maxlength="160" placeholder="Opcional" />
      </label>
    `;
    const typeSelect = document.getElementById("movementType");
    typeSelect.addEventListener("change", toggleMovementCost);
    toggleMovementCost();
  }

  dom.simpleDialog.showModal();
}

function toggleMovementCost() {
  const type = document.getElementById("movementType")?.value;
  const costWrap = document.getElementById("movementCostWrap");
  const costInput = document.getElementById("simpleCost");
  const needsCost = type === "entrada-galpao" || type === "entrada-fba";
  costWrap.hidden = !needsCost;
  costInput.required = needsCost;
}

async function saveSimpleAction(event) {
  event.preventDefault();
  dom.simpleError.textContent = "";
  const product = products.find((item) => item.id === currentSimpleProductId);
  if (!product) return;

  try {
    if (currentSimpleAction === "batch") {
      await addPurchaseBatch(product);
    }
    if (currentSimpleAction === "send") {
      await sendToAmazon(product);
    }
    if (currentSimpleAction === "movement") {
      await registerMovement(product);
    }

    dom.simpleDialog.close();
    await refreshData();
  } catch (error) {
    dom.simpleError.textContent = error.message;
  }
}

async function addPurchaseBatch(product) {
  const qty = toInt(document.getElementById("simpleQty").value);
  const cost = toMoneyNumber(document.getElementById("simpleCost").value);
  const note = document.getElementById("simpleNote").value.trim();
  assertPositiveInteger(qty, "Quantidade");
  if (cost < 0) throw new Error("Custo nao pode ser negativo.");

  const updated = clone(product);
  updated.warehouseStock += qty;
  updated.batches.push({
    id: uid(),
    initialQty: qty,
    remainingQty: qty,
    unitCost: cost,
    receivedAt: Date.now(),
  });
  updated.updatedAt = Date.now();

  await persistProductAndMovement(updated, {
    productId: product.id,
    type: "lote",
    quantity: qty,
    note: note || "Lote adicionado",
    createdAt: Date.now(),
  });
  showToast("Lote adicionado ao galpao.");
}

async function sendToAmazon(product) {
  const qty = toInt(document.getElementById("simpleQty").value);
  const note = document.getElementById("simpleNote").value.trim();
  assertPositiveInteger(qty, "Quantidade enviada");
  if (qty > product.warehouseStock) {
    throw new Error("O envio nao pode ser maior que o estoque disponivel no galpao.");
  }

  const updated = clone(product);
  updated.warehouseStock -= qty;
  updated.fbaStock += qty;
  updated.updatedAt = Date.now();

  await persistProductAndMovement(updated, {
    productId: product.id,
    type: "envio-amazon",
    quantity: qty,
    note: note || "Envio para Amazon",
    createdAt: Date.now(),
  });
  showToast("Envio para Amazon registrado.");
}

async function registerMovement(product) {
  const type = document.getElementById("movementType").value;
  const qty = toInt(document.getElementById("simpleQty").value);
  const cost = toMoneyNumber(document.getElementById("simpleCost")?.value || 0);
  const note = document.getElementById("simpleNote").value.trim();
  assertPositiveInteger(qty, "Quantidade");
  if (cost < 0) throw new Error("Custo nao pode ser negativo.");

  const updated = clone(product);
  let movementLabel = "";

  if (type === "saida-galpao") {
    if (qty > updated.warehouseStock) throw new Error("Nao ha estoque suficiente no galpao.");
    updated.warehouseStock -= qty;
    consumeFifo(updated, qty);
    movementLabel = "Saida do galpao";
  }

  if (type === "saida-fba") {
    if (qty > updated.fbaStock) throw new Error("Nao ha estoque suficiente no FBA.");
    updated.fbaStock -= qty;
    consumeFifo(updated, qty);
    movementLabel = "Saida do FBA";
  }

  if (type === "entrada-galpao" || type === "entrada-fba") {
    if (type === "entrada-galpao") updated.warehouseStock += qty;
    if (type === "entrada-fba") updated.fbaStock += qty;
    updated.batches.push({
      id: uid(),
      initialQty: qty,
      remainingQty: qty,
      unitCost: cost,
      receivedAt: Date.now(),
    });
    movementLabel = type === "entrada-galpao" ? "Entrada no galpao" : "Entrada no FBA";
  }

  updated.updatedAt = Date.now();
  await persistProductAndMovement(updated, {
    productId: product.id,
    type,
    quantity: qty,
    note: note || movementLabel,
    createdAt: Date.now(),
  });
  showToast("Movimentacao registrada.");
}

function consumeFifo(product, qty) {
  let remaining = qty;
  const ordered = [...product.batches].sort((a, b) => a.receivedAt - b.receivedAt);

  for (const batch of ordered) {
    if (remaining <= 0) break;
    const amount = Math.min(batch.remainingQty, remaining);
    batch.remainingQty -= amount;
    remaining -= amount;
  }

  if (remaining > 0) {
    throw new Error("Os lotes nao possuem quantidade suficiente para esta saida.");
  }

  product.batches = ordered.filter((batch) => batch.remainingQty > 0);
}

async function persistProductAndMovement(product, movement) {
  const savedMovement = { id: uid(), ...movement };

  if (backendEnabled) {
    await apiRequest("/api/product-movement", {
      method: "POST",
      body: { product, movement: savedMovement },
    });
    return;
  }

  await writeStores([PRODUCT_STORE, MOVEMENT_STORE], ({ products: productStore, movements: movementStore }) => {
    productStore.put(product);
    movementStore.put(savedMovement);
  });
}

function openImportModal() {
  pendingImportRows = [];
  dom.importForm.reset();
  dom.importError.textContent = "";
  dom.importPreview.hidden = true;
  dom.importPreview.innerHTML = "";
  dom.applyImport.disabled = true;
  dom.importDialog.showModal();
}

async function handleImportFile() {
  dom.importError.textContent = "";
  dom.importPreview.hidden = true;
  dom.importPreview.innerHTML = "";
  dom.applyImport.disabled = true;
  pendingImportRows = [];

  const file = dom.importFile.files?.[0];
  if (!file) return;

  try {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      throw new Error("Neste momento importe um CSV ou TSV. No Excel, use Salvar como CSV.");
    }

    const text = await file.text();
    const parsedRows = parseSpreadsheetText(text);
    pendingImportRows = createImportPlan(parsedRows);
    renderImportPreview(pendingImportRows);
    dom.applyImport.disabled = !pendingImportRows.some((row) => row.status === "ok");
  } catch (error) {
    dom.importError.textContent = error.message || "Nao foi possivel ler a planilha.";
  }
}

function parseSpreadsheetText(text) {
  const cleanText = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!cleanText) throw new Error("A planilha esta vazia.");

  const delimiters = [";", "\t", ","];
  const bestDelimiter = delimiters
    .map((delimiter) => ({ delimiter, columns: parseDelimited(cleanText, delimiter)[0]?.length || 0 }))
    .sort((a, b) => b.columns - a.columns)[0].delimiter;

  const rows = parseDelimited(cleanText, bestDelimiter).filter((row) => row.some((cell) => String(cell).trim()));
  if (!rows.length) throw new Error("A planilha esta vazia.");

  const headerMap = getHeaderMap(rows[0]);
  const hasHeader = headerMap.asin > -1 && headerMap.quantity > -1 && headerMap.sales > -1;
  const indexes = hasHeader ? headerMap : { asin: 0, quantity: 1, sales: 2 };
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((row, index) => ({
    line: index + (hasHeader ? 2 : 1),
    asin: String(row[indexes.asin] || "").trim(),
    quantity: row[indexes.quantity],
    sales: row[indexes.sales],
  }));
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function getHeaderMap(headerRow) {
  const normalizedHeaders = headerRow.map((cell) => normalizeHeader(cell));
  return {
    asin: normalizedHeaders.findIndex((header) => header === "asin"),
    quantity: normalizedHeaders.findIndex((header) =>
      ["quantidade disponivel", "quantidade", "disponivel", "estoque", "estoque fba", "estoque amazon", "qty"].includes(
        header,
      ),
    ),
    sales: normalizedHeaders.findIndex((header) =>
      ["vendas", "vendas ultimos 15 dias", "vendas dos ultimos 15 dias", "sales"].includes(header),
    ),
  };
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function createImportPlan(rows) {
  if (!rows.length) throw new Error("Nenhuma linha de produto foi encontrada.");

  const seen = new Set();
  return rows.map((row) => {
    const asinKey = normalize(row.asin);
    const product = products.find((item) => item.asinKey === asinKey);
    const quantity = parseIntegerCell(row.quantity);
    const sales = parseIntegerCell(row.sales);
    const errors = [];

    if (!asinKey) errors.push("ASIN vazio");
    if (seen.has(asinKey)) errors.push("ASIN duplicado no arquivo");
    if (!product) errors.push("Produto nao cadastrado");
    if (!Number.isInteger(quantity) || quantity < 0) errors.push("Quantidade invalida");
    if (!Number.isInteger(sales) || sales < 0) errors.push("Vendas invalidas");

    seen.add(asinKey);
    return {
      line: row.line,
      asin: row.asin,
      product,
      quantity,
      sales,
      errors,
      status: errors.length ? "error" : "ok",
    };
  });
}

function renderImportPreview(rows) {
  const okCount = rows.filter((row) => row.status === "ok").length;
  const errorCount = rows.length - okCount;
  dom.importPreview.hidden = false;
  dom.importPreview.innerHTML = `
    <div class="import-preview-header">
      <span>${number.format(rows.length)} linha(s)</span>
      <span class="preview-ok">${number.format(okCount)} pronta(s)</span>
      <span class="preview-error">${number.format(errorCount)} com erro</span>
    </div>
    <table class="mini-table">
      <thead>
        <tr>
          <th>Linha</th>
          <th>ASIN</th>
          <th>Produto</th>
          <th class="numeric">FBA atual</th>
          <th class="numeric">Novo FBA</th>
          <th class="numeric">Vendas</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const currentFba = row.product ? calculateProduct(row.product).fba : "-";
            return `
              <tr>
                <td>${number.format(row.line)}</td>
                <td>${escapeHtml(row.asin)}</td>
                <td>${escapeHtml(row.product?.name || "-")}</td>
                <td class="numeric">${typeof currentFba === "number" ? number.format(currentFba) : currentFba}</td>
                <td class="numeric">${Number.isInteger(row.quantity) ? number.format(row.quantity) : "-"}</td>
                <td class="numeric">${Number.isInteger(row.sales) ? number.format(row.sales) : "-"}</td>
                <td class="${row.status === "ok" ? "preview-ok" : "preview-error"}">
                  ${row.status === "ok" ? "Pronta" : escapeHtml(row.errors.join(", "))}
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

async function applyImportUpdates(event) {
  event.preventDefault();
  dom.importError.textContent = "";

  const validRows = pendingImportRows.filter((row) => row.status === "ok");
  if (!validRows.length) {
    dom.importError.textContent = "Nao ha linhas validas para aplicar.";
    return;
  }

  try {
    const now = Date.now();
    const updates = validRows.map((row) => buildImportedProduct(row, now));
    const updatedProducts = updates.map(({ product }) => product);
    const newMovements = updates.map(({ movement }) => ({ id: uid(), ...movement }));

    if (backendEnabled) {
      await apiRequest("/api/bulk", {
        method: "POST",
        body: { products: updatedProducts, movements: newMovements },
      });
    } else {
      await writeStores([PRODUCT_STORE, MOVEMENT_STORE], ({ products: productStore, movements: movementStore }) => {
        updatedProducts.forEach((product) => productStore.put(product));
        newMovements.forEach((movement) => movementStore.put(movement));
      });
    }

    dom.importDialog.close();
    await refreshData();
    showToast(`${number.format(validRows.length)} produto(s) atualizado(s).`);
  } catch (error) {
    dom.importError.textContent = error.message || "Nao foi possivel aplicar a importacao.";
  }
}

function buildImportedProduct(row, now) {
  const updated = clone(row.product);
  const oldCalc = calculateProduct(updated);
  const previousFba = updated.fbaStock;
  const previousSales = updated.last15Sales;
  updated.fbaStock = row.quantity;
  updated.last15Sales = row.sales;

  const newTotal = updated.warehouseStock + updated.fbaStock;
  reconcileBatchesToTotal(updated, newTotal, oldCalc.averageCost);
  updated.updatedAt = now;

  return {
    product: updated,
    movement: {
      productId: updated.id,
      type: "importacao-planilha",
      quantity: Math.abs(row.quantity - previousFba),
      note: `Importacao: FBA ${previousFba} -> ${row.quantity}; vendas ${previousSales} -> ${row.sales}`,
      createdAt: now,
    },
  };
}

function reconcileBatchesToTotal(product, targetTotal, fallbackCost) {
  const batchTotal = product.batches.reduce((sum, batch) => sum + Math.max(0, toInt(batch.remainingQty)), 0);
  const difference = targetTotal - batchTotal;

  if (difference < 0) {
    consumeFifo(product, Math.abs(difference));
    return;
  }

  if (difference > 0) {
    product.batches.push({
      id: uid(),
      initialQty: difference,
      remainingQty: difference,
      unitCost: Number.isFinite(fallbackCost) ? fallbackCost : 0,
      receivedAt: Date.now(),
    });
  }
}

function downloadTemplateCsv() {
  const csv = "ASIN;Quantidade disponivel;Vendas\nB0EXEMPLO123;120;35\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-atualizacao-estoque.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function openDetails(product) {
  const calc = calculateProduct(product);
  const productMovements = movements.filter((movement) => movement.productId === product.id).slice(0, 30);
  dom.detailsTitle.textContent = product.name;
  dom.detailsContent.innerHTML = `
    <div class="details-hero">
      <div class="details-photo">
        ${
          product.photoData
            ? `<img src="${escapeAttribute(product.photoData)}" alt="Foto de ${escapeAttribute(product.name)}" />`
            : `<span>Sem foto</span>`
        }
      </div>
      <div class="details-grid">
        <div class="details-item"><span>ASIN</span><strong>${escapeHtml(product.asin)}</strong></div>
        <div class="details-item"><span>SKU</span><strong>${escapeHtml(product.sku)}</strong></div>
        <div class="details-item"><span>Estoque total</span><strong>${number.format(calc.total)}</strong></div>
        <div class="details-item"><span>Valor em estoque</span><strong>${currency.format(calc.stockValue)}</strong></div>
        <div class="details-item"><span>Meta FBA</span><strong>${number.format(calc.sales * 2)}</strong></div>
        <div class="details-item"><span>Enviar para Amazon</span><strong>${number.format(calc.sendSuggestion)}</strong></div>
        <div class="details-item"><span>Meta estoque total</span><strong>${number.format(calc.sales * 2.5)}</strong></div>
        <div class="details-item"><span>Comprar</span><strong>${number.format(calc.purchaseNeed)}</strong></div>
      </div>
    </div>
    <div>
      <h3>Lotes</h3>
      <table class="mini-table">
        <thead><tr><th>Data</th><th class="numeric">Quantidade restante</th><th class="numeric">Custo unitario</th><th class="numeric">Valor</th></tr></thead>
        <tbody>
          ${(product.batches || [])
            .sort((a, b) => a.receivedAt - b.receivedAt)
            .map(
              (batch) => `
                <tr>
                  <td>${formatDate(batch.receivedAt)}</td>
                  <td class="numeric">${number.format(batch.remainingQty)}</td>
                  <td class="numeric">${currency.format(batch.unitCost)}</td>
                  <td class="numeric">${currency.format(batch.remainingQty * batch.unitCost)}</td>
                </tr>
              `,
            )
            .join("") || `<tr><td colspan="4">Nenhum lote cadastrado.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div>
      <h3>Historico</h3>
      <div class="history-list">
        ${
          productMovements
            .map(
              (movement) => `
                <div class="history-item">
                  <span>${formatDateTime(movement.createdAt)} - ${movement.type}</span>
                  <strong>${number.format(movement.quantity)} unidade(s)</strong>
                  <p>${escapeHtml(movement.note || "")}</p>
                </div>
              `,
            )
            .join("") || `<div class="history-item">Nenhuma movimentacao registrada.</div>`
        }
      </div>
    </div>
  `;
  dom.detailsDialog.showModal();
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} deve ser zero ou maior.`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} deve ser maior que zero.`);
  }
}

function humanizeDbError(error) {
  if (error?.name === "ConstraintError") return "ASIN ou SKU ja cadastrado.";
  return error.message || "Nao foi possivel salvar.";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(timestamp));
}

function formatInputDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return escapeHtml(value);
  return `${day}/${month}/${year}`;
}

function formatMonth(value) {
  if (!value) return "-";
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  return `${month}/${year}`;
}

function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatPercent(value) {
  return `${number.format(value || 0)}%`;
}

function currentDateTimeKey() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  return `${date} ${time}`;
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function currentYearKey() {
  return new Date().getFullYear().toString();
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  setTimeout(() => dom.toast.classList.remove("show"), 2600);
}
