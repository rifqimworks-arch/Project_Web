const taskForm = document.querySelector("#taskForm");
const taskInput = document.querySelector("#taskInput");
const priorityInput = document.querySelector("#priorityInput");
const dueInput = document.querySelector("#dueInput");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const taskList = document.querySelector("#taskList");
const emptyState = document.querySelector("#emptyState");
const notice = document.querySelector("#notice");
const filterButtons = document.querySelectorAll(".filter");
const themeToggle = document.querySelector("#themeToggle");

const authView = document.querySelector("#authView");
const appView = document.querySelector("#appView");
const authForm = document.querySelector("#authForm");
const authNotice = document.querySelector("#authNotice");
const authSubmit = document.querySelector("#authSubmit");
const confirmWrap = document.querySelector("#confirmWrap");

let tasks = [];
let currentFilter = "all";
let searchTerm = "";
let sortMode = "newest";
let editingId = null;

const priorityLabels = { high: "Prioritas tinggi", normal: "Prioritas normal", low: "Prioritas rendah" };
const priorityOrder = { high: 0, normal: 1, low: 2 };

/* ---------- Utilitas ---------- */

function showNotice(message, type = "error") {
  notice.textContent = message;
  notice.className = `notice${type === "success" ? " success" : ""}`;
  notice.hidden = false;
}
function hideNotice() { notice.hidden = true; }

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (response.status === 401) {
    showAuth();
    throw new Error("Silakan login terlebih dahulu.");
  }
  if (!response.ok) {
    let message = "Terjadi kesalahan pada server.";
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Tanggal lokal hari ini sebagai 'YYYY-MM-DD'
function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Selisih hari antara dua string 'YYYY-MM-DD' (a - b)
function dayDiff(a, b) {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
}

function dueInfo(task) {
  if (!task.due_date) return null;
  const diff = dayDiff(task.due_date, todayString());
  const label = new Date(`${task.due_date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  if (task.completed) return { cls: "", text: `Tenggat ${label}` };
  if (diff < 0) return { cls: "late", text: `Terlambat ${-diff} hari` };
  if (diff === 0) return { cls: "today", text: "Tenggat hari ini" };
  if (diff === 1) return { cls: "", text: "Tenggat besok" };
  return { cls: "", text: `Tenggat ${label}` };
}

/* ---------- Filter, cari, urut ---------- */

function getVisibleTasks() {
  let list = tasks;
  if (currentFilter === "pending") list = list.filter(task => !task.completed);
  if (currentFilter === "done") list = list.filter(task => task.completed);

  const term = searchTerm.trim().toLowerCase();
  if (term) list = list.filter(task => task.name.toLowerCase().includes(term));

  const sorted = [...list];
  if (sortMode === "due") {
    sorted.sort((a, b) => {
      if (!a.due_date && !b.due_date) return b.id - a.id;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date) || b.id - a.id;
    });
  } else if (sortMode === "priority") {
    sorted.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1) || b.id - a.id);
  } else if (sortMode === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name, "id"));
  } else {
    sorted.sort((a, b) => b.id - a.id);
  }
  return sorted;
}

/* ---------- Render ---------- */

function buildEditItem(task) {
  const item = document.createElement("li");
  item.className = "task-item";

  const form = document.createElement("form");
  form.className = "edit-form";

  const nameField = document.createElement("input");
  nameField.type = "text";
  nameField.value = task.name;
  nameField.maxLength = 120;
  nameField.required = true;
  nameField.setAttribute("aria-label", "Nama tugas");

  const priorityField = document.createElement("select");
  priorityField.setAttribute("aria-label", "Prioritas");
  [["normal", "Normal"], ["high", "Tinggi"], ["low", "Rendah"]].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    priorityField.append(option);
  });
  priorityField.value = task.priority;

  const dueField = document.createElement("input");
  dueField.type = "date";
  dueField.value = task.due_date || "";
  dueField.setAttribute("aria-label", "Tenggat waktu");

  const actions = document.createElement("div");
  actions.className = "edit-actions";
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "save-button";
  save.textContent = "Simpan";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "cancel-button";
  cancel.textContent = "Batal";
  actions.append(save, cancel);

  cancel.addEventListener("click", () => { editingId = null; renderTasks(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const name = nameField.value.trim();
    if (!name) return nameField.focus();
    try {
      hideNotice();
      const updated = await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, priority: priorityField.value, due_date: dueField.value || null })
      });
      tasks = tasks.map(t => t.id === updated.id ? updated : t);
      editingId = null;
      renderTasks();
      showNotice("Tugas diperbarui.", "success");
    } catch (error) { showNotice(error.message); }
  });

  form.append(nameField, priorityField, dueField, actions);
  item.append(form);
  setTimeout(() => nameField.focus(), 0);
  return item;
}

function buildTaskItem(task) {
  const item = document.createElement("li");
  item.className = `task-item${task.completed ? " completed" : ""}`;

  const check = document.createElement("button");
  check.className = "check-button";
  check.type = "button";
  check.setAttribute("aria-label", task.completed ? "Tandai belum selesai" : "Tandai selesai");
  check.textContent = task.completed ? "✓" : "";
  check.addEventListener("click", async () => {
    try {
      hideNotice();
      const updated = await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !task.completed })
      });
      tasks = tasks.map(t => t.id === updated.id ? updated : t);
      renderTasks();
    } catch (error) { showNotice(error.message); }
  });

  const content = document.createElement("div");
  content.className = "task-content";
  const name = document.createElement("p");
  name.className = "task-name";
  name.textContent = task.name;
  name.title = "Klik dua kali untuk mengedit";
  name.addEventListener("dblclick", () => { editingId = task.id; renderTasks(); });

  const meta = document.createElement("div");
  meta.className = "task-meta";
  const priority = document.createElement("span");
  priority.className = `priority ${task.priority}`;
  priority.textContent = priorityLabels[task.priority] || "Prioritas normal";
  meta.append(priority);

  const due = dueInfo(task);
  if (due) {
    const dueBadge = document.createElement("span");
    dueBadge.className = `due ${due.cls}`.trim();
    dueBadge.textContent = due.text;
    meta.append(dueBadge);
  }

  const date = document.createElement("span");
  date.textContent = `Ditambahkan ${formatDate(task.created_at)}`;
  meta.append(date);
  content.append(name, meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const edit = document.createElement("button");
  edit.className = "edit-button";
  edit.type = "button";
  edit.textContent = "✎";
  edit.setAttribute("aria-label", `Edit tugas ${task.name}`);
  edit.addEventListener("click", () => { editingId = task.id; renderTasks(); });

  const remove = document.createElement("button");
  remove.className = "delete-button";
  remove.type = "button";
  remove.textContent = "×";
  remove.setAttribute("aria-label", `Hapus tugas ${task.name}`);
  remove.addEventListener("click", async () => {
    try {
      hideNotice();
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      tasks = tasks.filter(t => t.id !== task.id);
      renderTasks();
    } catch (error) { showNotice(error.message); }
  });

  actions.append(edit, remove);
  item.append(check, content, actions);
  return item;
}

function renderTasks() {
  taskList.replaceChildren();
  const visibleTasks = getVisibleTasks();

  visibleTasks.forEach(task => {
    taskList.append(task.id === editingId ? buildEditItem(task) : buildTaskItem(task));
  });

  const today = todayString();
  const completedCount = tasks.filter(task => task.completed).length;
  const lateCount = tasks.filter(task => !task.completed && task.due_date && task.due_date < today).length;

  document.querySelector("#totalCount").textContent = tasks.length;
  document.querySelector("#pendingCount").textContent = tasks.length - completedCount;
  document.querySelector("#doneCount").textContent = completedCount;
  const lateEl = document.querySelector("#lateCount");
  lateEl.textContent = lateCount;
  lateEl.classList.toggle("has-late", lateCount > 0);
  document.querySelector("#listCount").textContent = `${visibleTasks.length} tugas`;

  emptyState.hidden = tasks.length > 0;
  const filteredOut = tasks.length > 0 && visibleTasks.length === 0;
  const noResults = document.querySelector("#noResults");
  if (noResults) noResults.remove();
  if (filteredOut) {
    const message = document.createElement("p");
    message.id = "noResults";
    message.className = "no-results";
    message.textContent = searchTerm.trim() ? "Tidak ada tugas yang cocok dengan pencarian." : "Tidak ada tugas pada filter ini.";
    taskList.after(message);
  }
}

/* ---------- Data ---------- */

async function loadTasks() {
  try {
    hideNotice();
    tasks = await api("/api/tasks");
    renderTasks();
  } catch (error) {
    renderTasks();
    showNotice(`${error.message} Pastikan PostgreSQL aktif dan konfigurasi .env sudah benar.`);
  }
}

/* ---------- Event ---------- */

taskForm.addEventListener("submit", async event => {
  event.preventDefault();
  const name = taskInput.value.trim();
  if (!name) return taskInput.focus();

  try {
    hideNotice();
    const task = await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ name, priority: priorityInput.value, due_date: dueInput.value || null })
    });
    tasks.unshift(task);
    renderTasks();
    taskForm.reset();
    priorityInput.value = "normal";
    taskInput.focus();
    showNotice("Tugas berhasil disimpan ke PostgreSQL.", "success");
  } catch (error) { showNotice(error.message); }
});

filterButtons.forEach(button => button.addEventListener("click", () => {
  currentFilter = button.dataset.filter;
  filterButtons.forEach(filter => filter.classList.toggle("active", filter === button));
  renderTasks();
}));

// Esc membatalkan edit, di mana pun fokusnya
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && editingId !== null) { editingId = null; renderTasks(); }
});

searchInput.addEventListener("input", () => { searchTerm = searchInput.value; renderTasks(); });
sortSelect.addEventListener("change", () => { sortMode = sortSelect.value; renderTasks(); });

document.querySelector("#clearDone").addEventListener("click", async () => {
  try {
    hideNotice();
    await api("/api/tasks/completed/all", { method: "DELETE" });
    tasks = tasks.filter(task => !task.completed);
    renderTasks();
  } catch (error) { showNotice(error.message); }
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST" }); } catch {}
  showAuth();
});

/* ---------- Login / Register ---------- */

let authMode = "login"; // "login" | "register"

function showAuthNotice(message) {
  authNotice.textContent = message;
  authNotice.hidden = false;
}

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === "login";
  document.querySelector("#authTitle").textContent = isLogin ? "Masuk" : "Buat akun";
  document.querySelector("#authSub").textContent = isLogin
    ? "Masuk untuk melihat daftar tugasmu."
    : "Daftar dulu, lalu kamu langsung masuk.";
  authSubmit.textContent = isLogin ? "Masuk" : "Daftar";
  document.querySelector("#switchText").textContent = isLogin ? "Belum punya akun?" : "Sudah punya akun?";
  document.querySelector("#switchBtn").textContent = isLogin ? "Daftar di sini" : "Masuk di sini";
  document.querySelector("#authPassword").autocomplete = isLogin ? "current-password" : "new-password";
  confirmWrap.hidden = isLogin;
  document.querySelector("#authConfirm").required = !isLogin;
  authNotice.hidden = true;
}

document.querySelector("#switchBtn").addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "register" : "login");
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  const username = document.querySelector("#authUsername").value.trim();
  const password = document.querySelector("#authPassword").value;

  if (authMode === "register" && password !== document.querySelector("#authConfirm").value) {
    return showAuthNotice("Password dan ulangi password tidak sama.");
  }

  authSubmit.disabled = true;
  authNotice.hidden = true;
  try {
    const body = JSON.stringify({ username, password });
    if (authMode === "register") await api("/api/register", { method: "POST", body });
    const data = await api("/api/login", { method: "POST", body });
    showApp(data.username);
  } catch (error) {
    showAuthNotice(error.message);
  } finally {
    authSubmit.disabled = false;
  }
});

/* ---------- Pindah tampilan ---------- */

// Kosongkan semua data milik user sebelumnya agar tidak bocor ke user berikutnya
function resetState() {
  tasks = [];
  editingId = null;
  currentFilter = "all";
  searchTerm = "";
  sortMode = "newest";
  searchInput.value = "";
  sortSelect.value = "newest";
  taskForm.reset();
  priorityInput.value = "normal";
  filterButtons.forEach(filter => filter.classList.toggle("active", filter.dataset.filter === "all"));
  taskList.replaceChildren();
  const noResults = document.querySelector("#noResults");
  if (noResults) noResults.remove();
  hideNotice();
}

function showAuth() {
  resetState();
  authForm.reset();
  setAuthMode("login");
  appView.hidden = true;
  authView.hidden = false;
}

function showApp(username) {
  resetState();
  authForm.reset();
  authView.hidden = true;
  appView.hidden = false;
  document.querySelector("#username").textContent = username;
  loadTasks();
}

/* ---------- Mode gelap ---------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "Terang" : "Gelap";
}
themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem("theme", next); } catch {}
});
applyTheme(document.documentElement.dataset.theme || "light");

/* ---------- Mulai ---------- */

document.querySelector("#today").textContent = new Date().toLocaleDateString("id-ID", {
  weekday: "long", day: "numeric", month: "long", year: "numeric"
});

async function init() {
  try {
    const auth = await fetch("/api/check-auth").then(r => r.json());
    if (auth.isLoggedIn) showApp(auth.username);
    else showAuth();
  } catch {
    showAuth();
    showAuthNotice("Tidak bisa terhubung ke server.");
  }
}
init();
