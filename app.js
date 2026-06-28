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
const STORAGE_KEY = 'cuentaalerta_reminders_draft_v4';
const OLD_STORAGE_KEYS = ['cuentaalerta_reminders_draft_v3', 'cuentaalerta_reminders_draft_v2'];
const GITHUB_CONFIG_KEY = 'cuentaalerta_github_config_v1';
const VIEW_KEY = 'cuentaalerta_active_view_v4';
let reminders = [];
let activeCategory = 'Todos';
let activeView = localStorage.getItem(VIEW_KEY) || 'cards';
let selectedColor = 'purple';
let calendarMonth = new Date();
let selectedCalendarKey = dateKey(new Date());

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  list: $('#reminderList'),
  agenda: $('#agendaList'),
  calendarGrid: $('#calendarGrid'),
  selectedDayList: $('#selectedDayList'),
  calendarTitle: $('#calendarTitle'),
  empty: $('#emptyState'),
  search: $('#searchInput'),
  chips: $('#categoryChips'),
  template: $('#cardTemplate'),
  formDialog: $('#formDialog'),
  form: $('#reminderForm'),
  githubDialog: $('#githubDialog'),
  configDialog: $('#configDialog'),
  toast: $('#toast'),
  nextTitle: $('#nextTitle'),
  nextMeta: $('#nextMeta'),
  nextBadge: $('#nextBadge'),
  statToday: $('#statToday'),
  statWeek: $('#statWeek'),
  statLate: $('#statLate'),
  statTotal: $('#statTotal')
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

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDue(value) {
  if (!value) return null;
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDue(date) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function formatDay(date) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(date);
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

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a, b) { return dateKey(a) === dateKey(b); }

function statusFor(due) {
  const { ms } = getRemaining(due);
  if (ms < 0) return 'Vencido';
  if (ms <= 3600000) return 'Última hora';
  if (isSameDay(due, new Date())) return 'Hoy';
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

function inferGithubConfig() {
  const host = location.hostname;
  const parts = location.pathname.split('/').filter(Boolean);
  if (host.endsWith('.github.io') && parts.length) {
    return { owner: host.replace('.github.io', ''), repo: parts[0], branch: 'main', token: '' };
  }
  return { owner: '', repo: '', branch: 'main', token: '' };
}

function loadGithubConfig() {
  const inferred = inferGithubConfig();
  try {
    const saved = JSON.parse(localStorage.getItem(GITHUB_CONFIG_KEY) || '{}');
    return {
      owner: saved.owner || inferred.owner,
      repo: saved.repo || inferred.repo,
      branch: saved.branch || inferred.branch || 'main',
      token: saved.token || ''
    };
  } catch {
    return inferred;
  }
}

function saveGithubConfig(config) {
  localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify({
    owner: config.owner.trim(),
    repo: config.repo.trim(),
    branch: (config.branch || 'main').trim(),
    token: config.token.trim()
  }));
}

function getGithubConfigFromForm() {
  return {
    owner: $('#githubOwnerInput').value.trim(),
    repo: $('#githubRepoInput').value.trim(),
    branch: $('#githubBranchInput').value.trim() || 'main',
    token: $('#githubTokenInput').value.trim()
  };
}

function fillConfigForm() {
  const config = loadGithubConfig();
  $('#githubOwnerInput').value = config.owner;
  $('#githubRepoInput').value = config.repo;
  $('#githubBranchInput').value = config.branch || 'main';
  $('#githubTokenInput').value = config.token;
}

function openConfig() { fillConfigForm(); els.configDialog.showModal(); }
function closeConfig() { els.configDialog.close(); }

function githubHeaders(token) {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function githubApiUrl(config) {
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/reminders.json?ref=${encodeURIComponent(config.branch || 'main')}`;
}

function toBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function validateGithubConfig(config) {
  if (!config.owner || !config.repo || !config.branch) throw new Error('Falta usuario, repo o rama en configuración.');
  if (!config.token) throw new Error('Falta el token de GitHub.');
}

async function getReminderFile(config) {
  const response = await fetch(githubApiUrl(config), { method: 'GET', headers: githubHeaders(config.token) });
  if (response.status === 404) return { sha: null };
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `GitHub respondió HTTP ${response.status}`);
  return { sha: data.sha || null };
}

async function testGithubConnection() {
  const config = getGithubConfigFromForm();
  try {
    validateGithubConfig(config);
    await getReminderFile(config);
    saveGithubConfig(config);
    toast('✅ Conexión correcta. Configuración guardada.');
  } catch (error) {
    toast(`GitHub: ${error.message}`);
  }
}

async function saveToGithub() {
  const config = loadGithubConfig();
  try { validateGithubConfig(config); }
  catch (error) { toast('Configura GitHub primero.'); openConfig(); return; }

  document.body.classList.add('github-saving');
  $('#saveGithubBtn').disabled = true;
  $('#saveGithubBtn').textContent = 'Guardando...';

  try {
    const file = await getReminderFile(config);
    const body = {
      message: `Actualizar reminders.json desde CuentaAlerta Pro ${new Date().toLocaleString('es-MX')}`,
      content: toBase64Utf8(exportData()),
      branch: config.branch || 'main'
    };
    if (file.sha) body.sha = file.sha;

    const response = await fetch(githubApiUrl(config).replace(/\?ref=.*/, ''), {
      method: 'PUT',
      headers: { ...githubHeaders(config.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || `GitHub respondió HTTP ${response.status}`);

    saveDraft();
    toast('✅ Guardado en GitHub. Telegram avisará según tus fechas.');
  } catch (error) {
    toast(`No pude guardar: ${error.message}`);
  } finally {
    document.body.classList.remove('github-saving');
    $('#saveGithubBtn').disabled = false;
    $('#saveGithubBtn').textContent = 'Guardar GitHub';
  }
}

function clearGithubToken() {
  const config = loadGithubConfig();
  config.token = '';
  saveGithubConfig(config);
  fillConfigForm();
  toast('Token borrado de este dispositivo.');
}

function localDraft() {
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) return current;
  for (const key of OLD_STORAGE_KEYS) {
    const old = localStorage.getItem(key);
    if (old) return old;
  }
  return null;
}

async function loadReminders() {
  try {
    const response = await fetch(`reminders.json?cache=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar reminders.json');
    const data = await response.json();
    reminders = Array.isArray(data) ? data.map(cleanReminder) : [];
  } catch (error) {
    console.warn(error);
    const saved = localDraft();
    reminders = saved ? JSON.parse(saved).map(cleanReminder) : [];
    toast('No pude leer reminders.json; usé borrador local si existía.');
  }
  const draft = localDraft();
  if (draft) {
    try {
      const local = JSON.parse(draft);
      if (Array.isArray(local) && local.length) reminders = local.map(cleanReminder);
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
    .sort((a, b) => (parseDue(a.due)?.getTime() || 0) - (parseDue(b.due)?.getTime() || 0));
}

function renderAll() {
  renderViewSwitch();
  renderChips();
  renderCards();
  renderAgenda();
  renderCalendar();
  renderHero();
  renderStats();
  updateEmptyState();
}

function renderViewSwitch() {
  $$('.view-switch button').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === activeView);
  });
  $$('.view-panel').forEach((panel) => panel.classList.remove('active'));
  $(`#${activeView}View`)?.classList.add('active');
}

function renderChips() {
  const categories = ['Todos', ...new Set(reminders.map((item) => item.category || 'Personal'))];
  if (!categories.includes(activeCategory)) activeCategory = 'Todos';
  els.chips.innerHTML = '';
  categories.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = `chip ${cat === activeCategory ? 'active' : ''}`;
    btn.textContent = cat;
    btn.addEventListener('click', () => { activeCategory = cat; renderAll(); });
    els.chips.appendChild(btn);
  });
}

function renderStats() {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const week = new Date(now.getTime() + 7 * 86400000);
  const valid = reminders.map((item) => parseDue(item.due)).filter(Boolean);
  els.statToday.textContent = valid.filter((d) => d >= today && d < tomorrow).length;
  els.statWeek.textContent = valid.filter((d) => d >= now && d <= week).length;
  els.statLate.textContent = valid.filter((d) => d < now).length;
  els.statTotal.textContent = reminders.length;
}

function renderHero() {
  const upcoming = reminders
    .map((item) => ({ item, due: parseDue(item.due) }))
    .filter(({ due }) => due && due.getTime() >= Date.now())
    .sort((a, b) => a.due - b.due)[0];

  if (!upcoming) {
    els.nextTitle.textContent = reminders.length ? 'No hay próximos pendientes' : 'Crea tu primer aviso';
    els.nextMeta.textContent = reminders.length ? 'Todos los recordatorios están vencidos.' : 'Agrega fechas y guarda en GitHub.';
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
  updateCountdowns(false);
}

function agendaBucket(due) {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const afterTomorrow = new Date(today); afterTomorrow.setDate(afterTomorrow.getDate() + 2);
  const week = new Date(today); week.setDate(week.getDate() + 8);
  const month = new Date(today); month.setMonth(month.getMonth() + 1);
  if (due < now) return 'Vencidos';
  if (due >= today && due < tomorrow) return 'Hoy';
  if (due >= tomorrow && due < afterTomorrow) return 'Mañana';
  if (due < week) return 'Próximos 7 días';
  if (due < month) return 'Este mes';
  return 'Después';
}

function renderAgenda() {
  const buckets = new Map();
  const order = ['Vencidos', 'Hoy', 'Mañana', 'Próximos 7 días', 'Este mes', 'Después'];
  filteredReminders().forEach((item) => {
    const due = parseDue(item.due);
    if (!due) return;
    const bucket = agendaBucket(due);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push({ item, due });
  });
  els.agenda.innerHTML = '';
  order.forEach((name) => {
    const entries = buckets.get(name) || [];
    if (!entries.length) return;
    const section = document.createElement('section');
    section.className = 'agenda-section';
    section.innerHTML = `<h3>${name}<span>${entries.length}</span></h3>`;
    entries.forEach(({ item, due }) => section.appendChild(agendaItemNode(item, due)));
    els.agenda.appendChild(section);
  });
  if (!els.agenda.children.length) {
    els.agenda.innerHTML = '<section class="agenda-section"><h3>Agenda limpia<span>0</span></h3><p class="muted-note">No hay pendientes con los filtros actuales.</p></section>';
  }
}

function agendaItemNode(item, due) {
  const row = document.createElement('button');
  row.className = 'agenda-item';
  row.style.setProperty('--item-color', COLORS[item.color] || COLORS.purple);
  row.innerHTML = `
    <span class="agenda-dot"></span>
    <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(formatDay(due))} · ${escapeHtml(item.category || 'Personal')}</small></span>
    <span class="agenda-time">${escapeHtml(formatTime(due))}</span>
  `;
  row.addEventListener('click', () => openForm(item.id));
  return row;
}

function renderCalendar() {
  const title = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(calendarMonth);
  els.calendarTitle.textContent = title;
  els.calendarGrid.innerHTML = '';
  const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - offset);
  const todayKey = dateKey(new Date());
  const items = filteredReminders().map((item) => ({ item, due: parseDue(item.due) })).filter(({ due }) => due);

  for (let i = 0; i < 42; i += 1) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    const key = dateKey(day);
    const dayItems = items.filter(({ due }) => dateKey(due) === key);
    const btn = document.createElement('button');
    btn.className = 'day-cell';
    if (day.getMonth() !== calendarMonth.getMonth()) btn.classList.add('muted');
    if (key === todayKey) btn.classList.add('today');
    if (key === selectedCalendarKey) btn.classList.add('selected');
    btn.innerHTML = `<b>${day.getDate()}</b><span class="day-dots"></span>`;
    const dots = btn.querySelector('.day-dots');
    dayItems.slice(0, 4).forEach(({ item }) => {
      const dot = document.createElement('i');
      dot.style.setProperty('--dot-color', COLORS[item.color] || COLORS.purple);
      dots.appendChild(dot);
    });
    btn.addEventListener('click', () => {
      selectedCalendarKey = key;
      if (day.getMonth() !== calendarMonth.getMonth()) calendarMonth = new Date(day.getFullYear(), day.getMonth(), 1);
      renderCalendar();
    });
    els.calendarGrid.appendChild(btn);
  }
  renderSelectedDay(items);
}

function renderSelectedDay(items) {
  const [y, m, d] = selectedCalendarKey.split('-').map(Number);
  const selected = new Date(y, m - 1, d);
  const entries = items.filter(({ due }) => dateKey(due) === selectedCalendarKey).sort((a, b) => a.due - b.due);
  els.selectedDayList.innerHTML = `<p class="selected-day-title">${escapeHtml(formatDay(selected))}</p>`;
  if (!entries.length) {
    els.selectedDayList.innerHTML += '<div class="mini-card"><span><strong>Sin pendientes</strong><small>Este día está libre.</small></span></div>';
    return;
  }
  entries.forEach(({ item, due }) => {
    const card = document.createElement('button');
    card.className = 'mini-card';
    card.innerHTML = `<span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.notes || 'Sin notas')}</small></span><span class="agenda-time">${escapeHtml(formatTime(due))}</span>`;
    card.addEventListener('click', () => openForm(item.id));
    els.selectedDayList.appendChild(card);
  });
}

function updateEmptyState() {
  const count = filteredReminders().length;
  els.empty.hidden = count !== 0;
}

function updateCountdowns(updateAll = true) {
  $$('.count-card').forEach((card) => {
    const item = reminders.find((r) => r.id === card.dataset.id);
    if (!item) return;
    const due = parseDue(item.due);
    if (!due) return;
    const remain = getRemaining(due);
    card.querySelector('[data-unit="days"]').textContent = remain.days;
    card.querySelector('[data-unit="hours"]').textContent = remain.hours;
    card.querySelector('[data-unit="minutes"]').textContent = remain.minutes;
    card.querySelector('[data-unit="seconds"]').textContent = remain.seconds;
    card.querySelector('.status').textContent = statusFor(due);
  });
  if (updateAll) { renderHero(); renderStats(); }
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
    btn.addEventListener('click', () => { selectedColor = name; buildColorPicker(); });
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
  toast('Guardado local. Presiona Guardar GitHub para subirlo.');
}

function deleteCurrent() {
  const id = $('#editingId').value;
  if (!id) return;
  if (!confirm('¿Eliminar este recordatorio del borrador?')) return;
  reminders = reminders.filter((r) => r.id !== id);
  saveDraft();
  renderAll();
  closeForm();
  toast('Recordatorio eliminado. Presiona Guardar GitHub para confirmar.');
}

function duplicateReminder(id) {
  const item = reminders.find((r) => r.id === id);
  if (!item) return;
  const due = parseDue(item.due) || new Date();
  due.setDate(due.getDate() + 1);
  const copy = { ...item, id: `${item.id}-copia-${Date.now().toString().slice(-5)}`, title: `${item.title} copia`, due: toLocalInputValue(due) };
  reminders.push(copy);
  saveDraft();
  renderAll();
  toast('Duplicado. Edita la fecha si hace falta.');
}

function createQuickTest() {
  const due = new Date(Date.now() + 20 * 60000);
  const id = `prueba-${due.getFullYear()}${pad(due.getMonth()+1)}${pad(due.getDate())}${pad(due.getHours())}${pad(due.getMinutes())}`;
  reminders.push({
    id,
    title: 'Prueba Telegram 20 min',
    due: toLocalInputValue(due),
    color: 'purple',
    category: 'Personal',
    notify: ['15m', 'due'],
    notes: 'Prueba rápida creada desde Agenda.'
  });
  saveDraft();
  renderAll();
  toast('Prueba creada. Toca Guardar GitHub.');
}

async function copyJson() {
  const text = exportData();
  try { await navigator.clipboard.writeText(text); toast('JSON copiado como respaldo manual.'); }
  catch { toast('No pude copiar. Usa Descargar JSON.'); }
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
    } catch (error) { toast(`Error al importar: ${error.message}`); }
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

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));
}

let toastTimer;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3600);
}

function bindEvents() {
  $('#openFormBtn').addEventListener('click', () => openForm());
  $('#openConfigBtn').addEventListener('click', openConfig);
  $('#emptyAddBtn').addEventListener('click', () => openForm());
  $('#closeFormBtn').addEventListener('click', closeForm);
  $('#deleteBtn').addEventListener('click', deleteCurrent);
  els.form.addEventListener('submit', submitForm);
  els.search.addEventListener('input', renderAll);
  $('#copyJsonBtn').addEventListener('click', copyJson);
  $('#downloadJsonBtn').addEventListener('click', downloadJson);
  $('#githubHelpBtn').addEventListener('click', openGithubHelp);
  $('#saveGithubBtn').addEventListener('click', saveToGithub);
  $('#closeGithubBtn').addEventListener('click', () => els.githubDialog.close());
  $('#closeConfigBtn').addEventListener('click', closeConfig);
  $('#configForm').addEventListener('submit', (event) => {
    event.preventDefault();
    saveGithubConfig(getGithubConfigFromForm());
    closeConfig();
    toast('Configuración de GitHub guardada en este dispositivo.');
  });
  $('#testGithubBtn').addEventListener('click', testGithubConnection);
  $('#clearTokenBtn').addEventListener('click', clearGithubToken);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) importJsonFile(file);
    event.target.value = '';
  });
  $$('.view-switch button').forEach((button) => button.addEventListener('click', () => {
    activeView = button.dataset.view;
    localStorage.setItem(VIEW_KEY, activeView);
    renderAll();
  }));
  $('#prevMonthBtn').addEventListener('click', () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  $('#nextMonthBtn').addEventListener('click', () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    renderCalendar();
  });
  $('#quickTestBtn').addEventListener('click', createQuickTest);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(console.warn);
}

bindEvents();
loadReminders();
setInterval(updateCountdowns, 1000);
