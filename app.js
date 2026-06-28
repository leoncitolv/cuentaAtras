const COLORS = {
  purple: '#7c3aed',
  blue: '#0a84ff',
  green: '#32d74b',
  orange: '#ff9f0a',
  pink: '#ff375f',
  cyan: '#64d2ff',
  red: '#ff453a'
};

const NOTIFY_OPTIONS = [
  ['15m', '15 min'],
  ['1h', '1 hora'],
  ['12h', '12 h'],
  ['1d', '1 día'],
  ['3d', '3 días'],
  ['7d', '7 días'],
  ['due', 'Llegada']
];

const DEFAULT_NOTIFY = ['1d', '1h', 'due'];
const STORAGE_KEY = 'cuentaalerta_reminders_draft_v2';
let reminders = [];
let activeCategory = 'Todos';
let selectedColor = 'purple';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  list: $('#reminderList'),
  empty: $('#emptyState'),
  search: $('#searchInput'),
  chips: $('#categoryChips'),
  template: $('#cardTemplate'),
  formDialog: $('#formDialog'),
  form: $('#reminderForm'),
  githubDialog: $('#githubDialog'),
  toast: $('#toast'),
  nextTitle: $('#nextTitle'),
  nextMeta: $('#nextMeta'),
  nextBadge: $('#nextBadge')
};

function pad(num) { return String(num).padStart(2, '0'); }

function slugify(text) {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 44) || 'recordatorio';
}

function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDue(value) {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  return new Date(normalized);
}

function formatDue(date) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function getRemaining(due) {
  const ms = due.getTime() - Date.now();
  const positive = Math.max(0, ms);
  const days = Math.floor(positive / 86400000);
  const hours = Math.floor((positive % 86400000) / 3600000);
  const minutes = Math.floor((positive % 3600000) / 60000);
  const seconds = Math.floor((positive % 60000) / 1000);
  return { ms, days, hours, minutes, seconds };
}

function statusFor(due) {
  const { ms } = getRemaining(due);
  if (ms < 0) return 'Vencido';
  if (ms <= 3600000) return 'Última hora';
  if (ms <= 86400000) return 'Hoy';
  if (ms <= 7 * 86400000) return 'Esta semana';
  return 'Próximo';
}

function cleanReminder(item) {
  const title = String(item.title || '').trim() || 'Sin título';
  const due = String(item.due || '').trim();
  const id = String(item.id || slugify(`${title}-${due}`));
  const notify = Array.isArray(item.notify)
    ? item.notify.filter((x) => NOTIFY_OPTIONS.some(([code]) => code === x))
    : DEFAULT_NOTIFY;
  return {
    id,
    title,
    due,
    color: COLORS[item.color] ? item.color : 'purple',
    category: String(item.category || item.colorLabel || 'Personal'),
    notify: notify.length ? notify : DEFAULT_NOTIFY,
    notes: String(item.notes || '')
  };
}

async function loadReminders() {
  try {
    const response = await fetch(`reminders.json?cache=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar reminders.json');
    const data = await response.json();
    reminders = Array.isArray(data) ? data.map(cleanReminder) : [];
  } catch (error) {
    console.warn(error);
    const saved = localStorage.getItem(STORAGE_KEY);
    reminders = saved ? JSON.parse(saved).map(cleanReminder) : [];
    toast('No pude leer reminders.json; usé borrador local si existía.');
  }
  const draft = localStorage.getItem(STORAGE_KEY);
  if (draft) {
    try {
      const local = JSON.parse(draft);
      if (Array.isArray(local) && local.length) {
        reminders = local.map(cleanReminder);
      }
    } catch {}
  }
  renderAll();
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders, null, 2));
}

function exportData() {
  return JSON.stringify(
    reminders.map(({ id, title, due, color, category, notify, notes }) => ({ id, title, due, color, category, notify, notes })),
    null,
    2
  ) + '\n';
}

function filteredReminders() {
  const q = els.search.value.trim().toLowerCase();
  return reminders
    .filter((item) => activeCategory === 'Todos' || item.category === activeCategory)
    .filter((item) => !q || `${item.title} ${item.notes} ${item.category}`.toLowerCase().includes(q))
    .sort((a, b) => parseDue(a.due) - parseDue(b.due));
}

function renderAll() {
  renderChips();
  renderCards();
  renderHero();
}

function renderChips() {
  const categories = ['Todos', ...new Set(reminders.map((item) => item.category || 'Personal'))];
  if (!categories.includes(activeCategory)) activeCategory = 'Todos';
  els.chips.innerHTML = '';
  categories.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = `chip ${cat === activeCategory ? 'active' : ''}`;
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      activeCategory = cat;
      renderAll();
    });
    els.chips.appendChild(btn);
  });
}

function renderHero() {
  const upcoming = reminders
    .map((item) => ({ item, due: parseDue(item.due) }))
    .filter(({ due }) => due && due.getTime() >= Date.now())
    .sort((a, b) => a.due - b.due)[0];

  if (!upcoming) {
    els.nextTitle.textContent = reminders.length ? 'No hay próximos pendientes' : 'Crea tu primer aviso';
    els.nextMeta.textContent = reminders.length ? 'Todos los recordatorios están vencidos.' : 'Agrega fechas y exporta reminders.json.';
    els.nextBadge.textContent = reminders.length ? 'OK' : '+';
    return;
  }
  const remain = getRemaining(upcoming.due);
  els.nextTitle.textContent = upcoming.item.title;
  els.nextMeta.textContent = `${formatDue(upcoming.due)} · ${upcoming.item.category}`;
  els.nextBadge.textContent = remain.days > 0 ? `${remain.days}d` : `${pad(remain.hours)}:${pad(remain.minutes)}`;
}

function renderCards() {
  const items = filteredReminders();
  els.list.innerHTML = '';
  els.empty.hidden = items.length !== 0;

  items.forEach((item) => {
    const due = parseDue(item.due);
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.dataset.id = item.id;
    node.style.setProperty('--card-color', COLORS[item.color] || COLORS.purple);
    node.querySelector('.tag').textContent = item.category || 'Personal';
    node.querySelector('.status').textContent = due ? statusFor(due) : 'Sin fecha';
    node.querySelector('h3').textContent = item.title;
    node.querySelector('.notes').textContent = item.notes || item.notify.map((n) => `aviso ${n}`).join(' · ');
    node.querySelector('.due-text').textContent = due ? formatDue(due) : 'Fecha inválida';
    node.querySelector('.edit-btn').addEventListener('click', () => openForm(item.id));
    node.querySelector('.duplicate-btn').addEventListener('click', () => duplicateReminder(item.id));
    els.list.appendChild(node);
  });
  updateCountdowns();
}

function updateCountdowns() {
  $$('.count-card').forEach((card) => {
    const item = reminders.find((r) => r.id === card.dataset.id);
    if (!item) return;
    const due = parseDue(item.due);
    if (!due || Number.isNaN(due.getTime())) return;
    const remain = getRemaining(due);
    card.querySelector('[data-unit="days"]').textContent = remain.days;
    card.querySelector('[data-unit="hours"]').textContent = remain.hours;
    card.querySelector('[data-unit="minutes"]').textContent = remain.minutes;
    card.querySelector('[data-unit="seconds"]').textContent = remain.seconds;
    card.querySelector('.status').textContent = statusFor(due);
  });
  renderHero();
}

function buildColorPicker() {
  const wrap = $('#colorPicker');
  wrap.innerHTML = '';
  Object.entries(COLORS).forEach(([name, color]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `color-dot ${name === selectedColor ? 'active' : ''}`;
    btn.style.setProperty('--dot', color);
    btn.title = name;
    btn.addEventListener('click', () => {
      selectedColor = name;
      buildColorPicker();
    });
    wrap.appendChild(btn);
  });
}

function buildNotifyGrid(selected = DEFAULT_NOTIFY) {
  const wrap = $('#notifyGrid');
  wrap.innerHTML = '';
  NOTIFY_OPTIONS.forEach(([code, label]) => {
    const option = document.createElement('label');
    option.className = 'notify-option';
    option.innerHTML = `<input type="checkbox" value="${code}" ${selected.includes(code) ? 'checked' : ''}> ${label}`;
    wrap.appendChild(option);
  });
}

function openForm(id = null) {
  const item = id ? reminders.find((r) => r.id === id) : null;
  $('#formTitle').textContent = item ? 'Editar aviso' : 'Nuevo aviso';
  $('#editingId').value = item?.id || '';
  $('#titleInput').value = item?.title || '';
  $('#dueInput').value = item?.due ? toLocalInputValue(parseDue(item.due)) : toLocalInputValue(new Date(Date.now() + 86400000));
  $('#categoryInput').value = item?.category || 'Personal';
  selectedColor = item?.color || 'purple';
  $('#notesInput').value = item?.notes || '';
  $('#deleteBtn').hidden = !item;
  buildColorPicker();
  buildNotifyGrid(item?.notify || DEFAULT_NOTIFY);
  els.formDialog.showModal();
}

function closeForm() { els.formDialog.close(); }

function formToReminder() {
  const title = $('#titleInput').value.trim();
  const due = $('#dueInput').value;
  const existingId = $('#editingId').value;
  const id = existingId || `${slugify(title)}-${due.replace(/[^0-9]/g, '').slice(0, 12)}`;
  const notify = $$('#notifyGrid input:checked').map((input) => input.value);
  return {
    id,
    title,
    due,
    color: selectedColor,
    category: $('#categoryInput').value,
    notify: notify.length ? notify : DEFAULT_NOTIFY,
    notes: $('#notesInput').value.trim()
  };
}

function submitForm(event) {
  event.preventDefault();
  const item = formToReminder();
  const index = reminders.findIndex((r) => r.id === item.id);
  if (index >= 0) reminders[index] = item;
  else reminders.push(item);
  saveDraft();
  renderAll();
  closeForm();
  toast('Guardado en borrador. Exporta el JSON y súbelo a GitHub.');
}

function deleteCurrent() {
  const id = $('#editingId').value;
  if (!id) return;
  if (!confirm('¿Eliminar este recordatorio del borrador?')) return;
  reminders = reminders.filter((r) => r.id !== id);
  saveDraft();
  renderAll();
  closeForm();
  toast('Recordatorio eliminado.');
}

function duplicateReminder(id) {
  const item = reminders.find((r) => r.id === id);
  if (!item) return;
  const due = parseDue(item.due) || new Date();
  due.setDate(due.getDate() + 1);
  const copy = {
    ...item,
    id: `${item.id}-copia-${Date.now().toString().slice(-5)}`,
    title: `${item.title} copia`,
    due: toLocalInputValue(due)
  };
  reminders.push(copy);
  saveDraft();
  renderAll();
  toast('Duplicado. Edita la fecha si hace falta.');
}

async function copyJson() {
  const text = exportData();
  try {
    await navigator.clipboard.writeText(text);
    toast('JSON copiado. Pégalo en reminders.json de GitHub.');
  } catch {
    toast('No pude copiar. Usa Descargar JSON.');
  }
}

function downloadJson() {
  const blob = new Blob([exportData()], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reminders.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Archivo reminders.json descargado.');
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('Debe ser un arreglo JSON');
      reminders = data.map(cleanReminder);
      saveDraft();
      renderAll();
      toast('JSON importado al borrador.');
    } catch (error) {
      toast(`Error al importar: ${error.message}`);
    }
  };
  reader.readAsText(file, 'utf-8');
}

function inferGithubEditUrl() {
  const host = location.hostname;
  const parts = location.pathname.split('/').filter(Boolean);
  if (host.endsWith('.github.io') && parts.length) {
    const user = host.replace('.github.io', '');
    const repo = parts[0];
    return `https://github.com/${user}/${repo}/edit/main/reminders.json`;
  }
  return 'https://github.com/';
}

function openGithubHelp() {
  $('#githubEditLink').href = inferGithubEditUrl();
  els.githubDialog.showModal();
}

let toastTimer;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200);
}

function bindEvents() {
  $('#openFormBtn').addEventListener('click', () => openForm());
  $('#emptyAddBtn').addEventListener('click', () => openForm());
  $('#closeFormBtn').addEventListener('click', closeForm);
  $('#deleteBtn').addEventListener('click', deleteCurrent);
  els.form.addEventListener('submit', submitForm);
  els.search.addEventListener('input', renderCards);
  $('#copyJsonBtn').addEventListener('click', copyJson);
  $('#downloadJsonBtn').addEventListener('click', downloadJson);
  $('#githubHelpBtn').addEventListener('click', openGithubHelp);
  $('#closeGithubBtn').addEventListener('click', () => els.githubDialog.close());
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) importJsonFile(file);
    event.target.value = '';
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(console.warn);
}

bindEvents();
loadReminders();
setInterval(updateCountdowns, 1000);
