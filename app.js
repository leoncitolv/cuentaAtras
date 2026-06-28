const STORAGE_KEY = "cuentaalerta.reminders.v1";
const FILTERS = { all: "all", pending: "pending", today: "today", expired: "expired" };

let reminders = [];
let activeFilter = FILTERS.all;
let editingId = null;

const $ = (selector) => document.querySelector(selector);
const cards = $("#cards");
const template = $("#cardTemplate");
const emptyState = $("#emptyState");
const dialog = $("#reminderDialog");
const exportDialog = $("#exportDialog");
const helpDialog = $("#helpDialog");
const form = $("#reminderForm");

const notifyLabels = {
  "7d": "7 días antes",
  "3d": "3 días antes",
  "1d": "1 día antes",
  "12h": "12 h antes",
  "1h": "1 h antes",
  "15m": "15 min antes",
  "due": "Al momento"
};

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDue(value) {
  if (!value) return null;
  if (value.includes("T")) return new Date(value);
  return new Date(value.replace(" ", "T"));
}

function formatDue(value) {
  const date = parseDue(value);
  if (!date || Number.isNaN(date.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function diffParts(dueValue) {
  const due = parseDue(dueValue);
  const now = new Date();
  let ms = due - now;
  const expired = ms < 0;
  ms = Math.abs(ms);
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return { days, hours, minutes, seconds, expired };
}

function normalizedForExport() {
  return reminders
    .slice()
    .sort((a, b) => parseDue(a.due) - parseDue(b.due))
    .map((r) => ({
      id: r.id,
      title: r.title,
      due: r.due,
      color: r.color || "purple",
      notify: Array.isArray(r.notify) && r.notify.length ? r.notify : ["1d", "1h", "due"],
      notes: r.notes || ""
    }));
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

async function loadReminders() {
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      reminders = JSON.parse(local);
      render();
      return;
    } catch (error) {
      console.warn("No se pudo leer localStorage", error);
    }
  }

  try {
    const response = await fetch("reminders.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    reminders = await response.json();
  } catch (error) {
    console.warn("No se pudo cargar reminders.json", error);
    reminders = [];
  }
  saveLocal();
  render();
}

function filterReminders(list) {
  const query = $("#searchInput").value.trim().toLowerCase();
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  return list.filter((reminder) => {
    const due = parseDue(reminder.due);
    const title = `${reminder.title || ""} ${reminder.notes || ""}`.toLowerCase();
    if (query && !title.includes(query)) return false;
    if (activeFilter === FILTERS.pending && due < now) return false;
    if (activeFilter === FILTERS.expired && due >= now) return false;
    if (activeFilter === FILTERS.today && due.toISOString().slice(0, 10) !== todayKey) return false;
    return true;
  });
}

function render() {
  cards.innerHTML = "";
  const filtered = filterReminders(reminders).sort((a, b) => parseDue(a.due) - parseDue(b.due));
  emptyState.hidden = filtered.length > 0;

  for (const reminder of filtered) {
    const node = template.content.firstElementChild.cloneNode(true);
    const parts = diffParts(reminder.due);
    node.classList.add(reminder.color || "purple");
    if (parts.expired) node.classList.add("expired");
    node.dataset.id = reminder.id;
    node.querySelector("h2").textContent = reminder.title;
    node.querySelector(".due-label").textContent = parts.expired ? `Venció: ${formatDue(reminder.due)}` : formatDue(reminder.due);
    node.querySelector('[data-part="days"]').textContent = parts.days;
    node.querySelector('[data-part="hours"]').textContent = parts.hours;
    node.querySelector('[data-part="minutes"]').textContent = parts.minutes;
    node.querySelector('[data-part="seconds"]').textContent = parts.seconds;

    const notes = node.querySelector(".notes");
    notes.textContent = reminder.notes || "";
    notes.hidden = !reminder.notes;

    const chips = node.querySelector(".chips");
    const notify = reminder.notify || ["1d", "1h", "due"];
    for (const alert of notify) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = notifyLabels[alert] || alert;
      chips.appendChild(chip);
    }

    node.querySelector(".card-menu").addEventListener("click", () => openEdit(reminder.id));
    cards.appendChild(node);
  }
  updateJsonPreview();
}

function openNew() {
  editingId = null;
  $("#sheetTitle").textContent = "Nueva cuenta atrás";
  $("#deleteReminder").hidden = true;
  form.reset();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setSeconds(0, 0);
  $("#due").value = toLocalInputValue(tomorrow);
  $(".notify-grid input[value='1d']").checked = true;
  $(".notify-grid input[value='1h']").checked = true;
  $(".notify-grid input[value='due']").checked = true;
  dialog.showModal();
}

function openEdit(id) {
  const reminder = reminders.find((item) => item.id === id);
  if (!reminder) return;
  editingId = id;
  $("#sheetTitle").textContent = "Editar cuenta atrás";
  $("#deleteReminder").hidden = false;
  $("#reminderId").value = reminder.id;
  $("#title").value = reminder.title || "";
  $("#due").value = reminder.due.includes("T") ? reminder.due.slice(0, 16) : reminder.due.replace(" ", "T").slice(0, 16);
  $("#color").value = reminder.color || "purple";
  $("#notes").value = reminder.notes || "";
  const selected = new Set(reminder.notify || ["1d", "1h", "due"]);
  document.querySelectorAll(".notify-grid input").forEach((input) => input.checked = selected.has(input.value));
  dialog.showModal();
}

function readForm() {
  const selected = Array.from(document.querySelectorAll(".notify-grid input:checked")).map((input) => input.value);
  return {
    id: editingId || uid(),
    title: $("#title").value.trim(),
    due: $("#due").value,
    color: $("#color").value,
    notify: selected.length ? selected : ["1d", "1h", "due"],
    notes: $("#notes").value.trim()
  };
}

function updateJsonPreview() {
  const preview = $("#jsonPreview");
  if (preview) preview.value = JSON.stringify(normalizedForExport(), null, 2);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const reminder = readForm();
  if (!reminder.title || !reminder.due) return;
  const index = reminders.findIndex((item) => item.id === reminder.id);
  if (index >= 0) reminders[index] = reminder;
  else reminders.push(reminder);
  saveLocal();
  render();
  dialog.close();
});

$("#deleteReminder").addEventListener("click", () => {
  if (!editingId) return;
  reminders = reminders.filter((item) => item.id !== editingId);
  saveLocal();
  render();
  dialog.close();
});

$("#openAdd").addEventListener("click", openNew);
$("#closeDialog").addEventListener("click", () => dialog.close());
$("#closeExport").addEventListener("click", () => exportDialog.close());
$("#closeHelp").addEventListener("click", () => helpDialog.close());
$("#searchInput").addEventListener("input", render);

for (const pill of document.querySelectorAll(".pill")) {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    activeFilter = pill.dataset.filter;
    render();
  });
}

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    if (tab.dataset.view === "export") {
      updateJsonPreview();
      exportDialog.showModal();
    }
    if (tab.dataset.view === "help") helpDialog.showModal();
  });
}

$("#downloadJson").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(normalizedForExport(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reminders.json";
  link.click();
  URL.revokeObjectURL(url);
});

$("#copyJson").addEventListener("click", async () => {
  await navigator.clipboard.writeText(JSON.stringify(normalizedForExport(), null, 2));
  $("#copyJson").textContent = "Copiado";
  setTimeout(() => $("#copyJson").textContent = "Copiar JSON", 1600);
});

$("#importJson").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const imported = JSON.parse(text);
  if (!Array.isArray(imported)) throw new Error("El JSON debe ser un arreglo de recordatorios");
  reminders = imported;
  saveLocal();
  render();
  exportDialog.close();
});

setInterval(render, 1000);
loadReminders();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(console.warn));
}
