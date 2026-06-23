const STORAGE_KEY = "reed-desk-tasks-v1";
const MORAL_VALUE = 5;
const PASSWORD_KEY = "reed-desk-cancel-password-v1";
const LEGACY_STORAGE_KEY = "rat-detective-tasks-v2";
const LEGACY_PASSWORD_KEY = "rat-detective-cancel-password-v1";
const FILTER_LABELS = {
  active: "Unsolved Cases",
  overdue: "Critical Cases",
  soon: "Due Soon",
  today: "Today's Docket",
  done: "Approved Cases",
  all: "All Cases",
  accounting: "Moral Accounting"
};

const TYPE_LABELS = {
  chore: "domestic",
  responsibility: "strength",
  engagement: "appointment"
};

const DEMO_TITLES = new Set([
  "Take out trash before the apartment files a complaint",
  "Put laundry away, not in the floor-based archive",
  "Finish biology reading before knowledge decays",
  "Pack soccer gear for the scheduled physical ordeal"
]);

const QUIPS = {
  clean: [
    "EXECUTIVE STATIC [Medium: Success] - The board is clean. Suspicious. Continue anyway.",
    "DOMESTIC FORENSICS [Easy: Success] - No overdue cases. The floor of history briefly shines.",
    "MORAL LEDGER [Bright: Success] - You are not late. This is what power feels like, apparently."
  ],
  mild: [
    "SQUALOR SENSE [Trivial: Failure] - One case is sweating under a couch cushion.",
    "THEATRICS BUREAU [Easy: Success] - The situation is not tragic yet. Do not audition.",
    "EXECUTIVE STATIC [Medium: Failure] - A loose end twitches. It knows your name."
  ],
  spicy: [
    "SHAME ENGINE [High: Success] - Multiple overdue cases. Bold. Terrible, but bold.",
    "DOMESTIC FORENSICS [Medium: Success] - The pile has motive, means, and your fingerprints.",
    "THEATRICS BUREAU [Hard: Success] - This is no longer procrastination. This is avant-garde collapse."
  ],
  chaos: [
    "RED THREAD [Impossible: Failure] - The case board is screaming in corkboard.",
    "EXECUTIVE STATIC [Storm: Failure] - The backlog has become weather. You live inside it now.",
    "MORAL LEDGER [Catastrophic: Failure] - Even the laundry pile is embarrassed for you."
  ],
  win: [
    "MORAL LEDGER [Easy: Success] - Case approved. Respect issued in small, reluctant coins.",
    "DOMESTIC FORENSICS [Medium: Success] - Evidence removed. The room exhales.",
    "EXECUTIVE STATIC [High: Success] - A case has fallen. The self survives."
  ],
  add: [
    "RED THREAD [Easy: Success] - Case pinned. The board grows more theatrical.",
    "THEATRICS BUREAU [Medium: Success] - Future you has entered the scene and looks under-rehearsed.",
    "EXECUTIVE STATIC [Trivial: Success] - New obligation secured. No vanishing acts."
  ]
};

const LEVELS = [
  { name: "Desk Cadet", min: 0 },
  { name: "Sock Inspector", min: 50 },
  { name: "Dish Rhetorician", min: 125 },
  { name: "Laundry Lieutenant", min: 250 },
  { name: "Deadline Savant", min: 450 }
];

const els = {
  form: document.querySelector("#taskForm"),
  title: document.querySelector("#taskTitle"),
  type: document.querySelector("#taskType"),
  due: document.querySelector("#taskDue"),
  dateEntry: document.querySelector(".date-entry"),
  clearDueDate: document.querySelector("#clearDueDate"),
  points: document.querySelector("#taskPoints"),
  taskList: document.querySelector("#taskList"),
  emptyState: document.querySelector("#emptyState"),
  listTitle: document.querySelector("#listTitle"),
  statBlocks: document.querySelectorAll(".stat-block"),
  todayLabel: document.querySelector("#todayLabel"),
  briefQuote: document.querySelector("#briefQuote"),
  thoughtLog: document.querySelector("#thoughtLog"),
  slackMeter: document.querySelector("#slackMeter"),
  pointsTotal: document.querySelector("#pointsTotal"),
  levelName: document.querySelector("#levelName"),
  streakCount: document.querySelector("#streakCount"),
  overdueCount: document.querySelector("#overdueCount"),
  dueCount: document.querySelector("#dueCount"),
  doneCount: document.querySelector("#doneCount"),
  moralPointsEarned: document.querySelector("#moralPointsEarned"),
  toast: document.querySelector("#toast")
};

let tasks = refreshDailyTasks(loadTasks());
let activeFilter = "today";
let lastQuote = "";
let toastTimer = 0;

saveTasks();
init();

function init() {
  const today = new Date();
  els.todayLabel.textContent = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(today);
  setNoDateMode(false, toDateInput(today));

  els.form.addEventListener("submit", addTask);
  els.clearDueDate.addEventListener("click", () => {
    setNoDateMode(!isNoDateMode());
  });
  els.due.addEventListener("input", () => {
    if (els.due.value) {
      setNoDateMode(false, els.due.value);
    }
  });
  els.taskList.addEventListener("click", handleTaskAction);
  els.statBlocks.forEach(button => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.statView);
      els.listTitle.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  render();
}

function setActiveView(view) {
  activeFilter = view;
  render();
}

function loadTasks() {
  const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter(task => !DEMO_TITLES.has(task.title)).map(normalizeTask);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return [];
}

function normalizeTask(task) {
  const today = toDateInput(new Date());
  const due = task.due || "";
  const repeatsDaily = Boolean(due && (task.repeatsDaily || due === today));
  return {
    ...task,
    due,
    points: MORAL_VALUE,
    repeatsDaily,
    recurringGroupId: repeatsDaily ? task.recurringGroupId || task.id : task.recurringGroupId || null,
    pendingAt: task.pendingAt || null,
    completedAt: task.completedAt || null,
    rejectedAt: task.rejectedAt || null,
    cancelledAt: task.cancelledAt || null
  };
}

function refreshDailyTasks(allTasks) {
  const today = startOfDay(new Date());
  const refreshed = allTasks.map(normalizeTask);
  const groups = new Map();

  refreshed.forEach(task => {
    if (!task.repeatsDaily || !task.recurringGroupId) {
      return;
    }
    if (!groups.has(task.recurringGroupId)) {
      groups.set(task.recurringGroupId, []);
    }
    groups.get(task.recurringGroupId).push(task);
  });

  groups.forEach(groupTasks => {
    const hasOpenCurrentOrFuture = groupTasks.some(task => {
      return !task.completedAt && !task.cancelledAt && parseDate(task.due) >= today;
    });
    if (!hasOpenCurrentOrFuture) {
      const source = [...groupTasks].sort((a, b) => parseDate(b.due) - parseDate(a.due))[0];
      const sourceDue = parseDate(source.due);
      const nextDue = source.completedAt && sourceDue >= today ? addDays(sourceDue, 1) : today;
      refreshed.push(createDailyRepeat(source, nextDue));
    }
  });

  return refreshed;
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function addTask(event) {
  event.preventDefault();
  const title = els.title.value.trim();
  if (!title) {
    return;
  }

  const dueValue = isNoDateMode() ? "" : els.due.value;
  const todayValue = toDateInput(new Date());

  tasks.push({
    id: crypto.randomUUID(),
    title,
    type: els.type.value,
    due: dueValue || "",
    points: MORAL_VALUE,
    repeatsDaily: Boolean(dueValue && dueValue === todayValue),
    recurringGroupId: dueValue && dueValue === todayValue ? crypto.randomUUID() : null,
    pendingAt: null,
    completedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    createdAt: new Date().toISOString()
  });

  els.form.reset();
  setNoDateMode(!dueValue, dueValue ? todayValue : "");
  els.points.value = MORAL_VALUE;
  saveTasks();
  render(randomFrom(QUIPS.add));
  showToast("Case pinned. The desk pretends this was its idea.");
}

function isNoDateMode() {
  return els.clearDueDate.getAttribute("aria-pressed") === "true";
}

function setNoDateMode(isActive, dateValue = toDateInput(new Date())) {
  els.clearDueDate.setAttribute("aria-pressed", String(isActive));
  els.clearDueDate.classList.toggle("is-active", isActive);
  els.dateEntry.classList.toggle("is-no-date", isActive);
  els.due.disabled = isActive;
  els.due.value = isActive ? "" : dateValue;
}

function handleTaskAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const card = button.closest(".task-card");
  const task = tasks.find(item => item.id === card.dataset.id);
  if (!task) {
    return;
  }

  if (button.dataset.action === "file") {
    fileTaskForReview(task);
    return;
  }

  if (button.dataset.action === "approve") {
    approveTask(task);
    return;
  }

  if (button.dataset.action === "reject") {
    rejectTask(task);
    return;
  }

  if (button.dataset.action === "reopen") {
    reopenTask(task);
    return;
  }

  if (button.dataset.action === "delete") {
    cancelTask(task);
  }
}

function fileTaskForReview(task) {
  if (task.completedAt || task.cancelledAt) {
    return;
  }
  task.pendingAt = new Date().toISOString();
  task.rejectedAt = null;
  saveTasks();
  render("AUTHORITY CHECK [Trivial: Pending] - Filed, not proven. The clipboard narrows its eyes.");
  showToast("Filed for parent review. No moral points yet.");
}

function approveTask(task) {
  if (!verifyParentPassword()) {
    render("AUTHORITY CHECK [Medium: Failure] - Approval denied. The stamp remains tragically dry.");
    showToast("Parent password rejected.");
    return;
  }

  task.completedAt = new Date().toISOString();
  task.pendingAt = null;
  task.rejectedAt = null;
  if (task.repeatsDaily) {
    ensureNextDailyRepeat(task);
  }
  saveTasks();
  render(randomFrom(QUIPS.win));
  showToast(`+${task.points} moral points approved. The ledger stops glaring.`);
  burstConfetti();
}

function rejectTask(task) {
  if (!verifyParentPassword()) {
    render("AUTHORITY CHECK [Medium: Failure] - Rejection denied. The stamp sulks in its drawer.");
    showToast("Parent password rejected.");
    return;
  }

  task.completedAt = null;
  task.pendingAt = null;
  task.rejectedAt = new Date().toISOString();
  saveTasks();
  render("AUTHORITY CHECK [Hard: Success] - Evidence rejected. The case crawls back onto the board wearing shame.");
  showToast("Returned to active duty. The ledger is unimpressed.");
}

function reopenTask(task) {
  if (!verifyParentPassword()) {
    render("AUTHORITY CHECK [Medium: Failure] - Reopen denied. The past refuses to be edited.");
    showToast("Parent password rejected.");
    return;
  }

  task.completedAt = null;
  task.pendingAt = null;
  task.rejectedAt = new Date().toISOString();
  saveTasks();
  render("RED THREAD [Easy: Failure] - Reopened. The case crawls back onto the board.");
  showToast("Approved case reopened.");
}

function cancelTask(task) {
  if (!verifyParentPassword()) {
    render("AUTHORITY CHECK [Medium: Failure] - Cancellation denied. The paperwork hisses.");
    showToast("Parent password rejected.");
    return;
  }

  if (task.repeatsDaily && getTaskStatus(task).daysUntil <= 0) {
    ensureNextDailyRepeat(task);
  }

  task.cancelledAt = new Date().toISOString();
  task.pendingAt = null;
  task.completedAt = null;
  task.rejectedAt = null;
  saveTasks();
  render("AUTHORITY CHECK [Medium: Success] - Case cancelled. The form receives a theatrical stamp of disappointment.");
  showToast("Case cancelled.");
}

function ensureNextDailyRepeat(task) {
  const today = startOfDay(new Date());
  const dueDate = parseDate(task.due) < today ? today : parseDate(task.due);
  const nextDue = addDays(dueDate, 1);
  const nextDueString = toDateInput(nextDue);
  const groupId = task.recurringGroupId || task.id;
  const alreadyExists = tasks.some(item => {
    return item.recurringGroupId === groupId && item.due === nextDueString && !item.completedAt && !item.cancelledAt;
  });

  task.repeatsDaily = true;
  task.recurringGroupId = groupId;

  if (!alreadyExists) {
    tasks.push(createDailyRepeat(task, nextDue));
  }
}

function createDailyRepeat(source, dueDate) {
  return {
    id: crypto.randomUUID(),
    title: source.title,
    type: source.type,
    due: toDateInput(dueDate),
    points: MORAL_VALUE,
    repeatsDaily: true,
    recurringGroupId: source.recurringGroupId || source.id,
    pendingAt: null,
    completedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    createdAt: new Date().toISOString()
  };
}

function verifyParentPassword() {
  let record = getCancelPasswordRecord();
  if (!record && !setCancelPassword()) {
    return false;
  }
  record = getCancelPasswordRecord();
  const password = window.prompt("Parent authorization password:");
  if (!password) {
    return false;
  }
  return hashPassword(password, record.salt) === record.hash;
}

function setCancelPassword() {
  const password = window.prompt("Set parent authorization password:");
  if (!password || password.length < 4) {
    showToast("Use at least 4 characters for the cancellation password.");
    return false;
  }
  const confirmPassword = window.prompt("Repeat cancellation password:");
  if (password !== confirmPassword) {
    showToast("Passwords did not match.");
    return false;
  }
  const salt = crypto.randomUUID();
  localStorage.setItem(PASSWORD_KEY, JSON.stringify({
    salt,
    hash: hashPassword(password, salt)
  }));
  showToast("Cancellation password set.");
  return true;
}

function getCancelPasswordRecord() {
  const stored = localStorage.getItem(PASSWORD_KEY) || localStorage.getItem(LEGACY_PASSWORD_KEY);
  if (!stored) {
    return null;
  }
  try {
    const record = JSON.parse(stored);
    if (record && record.salt && record.hash) {
      localStorage.setItem(PASSWORD_KEY, JSON.stringify(record));
      return record;
    }
  } catch {
    localStorage.removeItem(PASSWORD_KEY);
  }
  return null;
}

function hashPassword(password, salt) {
  let hash = 5381;
  const input = `${salt}:${password}`;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

function render(forcedQuote) {
  const state = getState();
  const filtered = getFilteredTasks(tasks, activeFilter);

  els.listTitle.textContent = FILTER_LABELS[activeFilter];
  els.taskList.innerHTML = "";
  if (activeFilter === "accounting") {
    els.taskList.appendChild(renderAccounting(state));
    els.emptyState.hidden = true;
  } else {
    filtered.forEach(task => els.taskList.appendChild(renderTask(task)));
    els.emptyState.hidden = activeFilter !== "today" || filtered.length > 0;
  }

  els.overdueCount.textContent = state.openCount;
  els.overdueCount.closest(".stat-block").setAttribute("aria-label", `Show ${state.openCount} unsolved cases`);
  els.dueCount.textContent = state.dueSoonCount;
  els.dueCount.closest(".stat-block").setAttribute("aria-label", `Show ${state.dueSoonCount} cases due soon`);
  els.doneCount.textContent = state.completedCount;
  els.moralPointsEarned.textContent = formatScore(state.points);
  els.pointsTotal.textContent = formatScore(state.points);
  els.levelName.textContent = getLevel(state.points);
  els.streakCount.textContent = `${state.streak} ${state.streak === 1 ? "day" : "days"}`;
  els.slackMeter.style.width = `${state.slackScore}%`;
  els.moralPointsEarned.closest(".stat-block").classList.toggle("is-negative", state.points < 0);
  els.statBlocks.forEach(block => {
    block.classList.toggle("is-active", block.dataset.statView === activeFilter);
  });
  els.briefQuote.textContent = forcedQuote || getBriefQuote(state);
  renderThoughtLog(state);
}

function renderAccounting(state) {
  const ledger = document.createElement("div");
  ledger.className = "ledger";

  const summary = document.createElement("div");
  summary.className = "ledger-summary";
  summary.append(
    renderLedgerMetric("At Stake", formatScore(state.openStake)),
    renderLedgerMetric("Pending Review", formatScore(state.pendingPoints)),
    renderLedgerMetric("Approved Earned", formatScore(state.earnedPoints), "positive"),
    renderLedgerMetric("Overdue Penalty", `-${state.penaltyPoints}`),
    renderLedgerMetric("Week Net", formatScore(state.weekly.net), state.weekly.net < 0 ? "negative" : "positive"),
    renderLedgerMetric("Net Moral Score", formatScore(state.points), state.points < 0 ? "negative" : "positive")
  );

  const weekly = renderWeeklyReckoning(state.weekly);
  const rows = document.createElement("div");
  rows.className = "ledger-rows";
  [...tasks].sort(sortTasks).forEach(task => rows.appendChild(renderLedgerRow(task)));

  ledger.append(summary, weekly, rows);
  return ledger;
}

function renderLedgerMetric(label, value, tone = "") {
  const metric = document.createElement("div");
  metric.className = `ledger-metric ${tone}`.trim();

  const labelEl = document.createElement("span");
  labelEl.textContent = label;

  const valueEl = document.createElement("strong");
  valueEl.textContent = value;

  metric.append(labelEl, valueEl);
  return metric;
}

function renderLedgerRow(task) {
  const status = getTaskStatus(task);
  const row = document.createElement("article");
  row.className = [
    "ledger-row",
    status.isOverdue ? "is-penalty" : "",
    task.pendingAt ? "is-pending" : "",
    task.completedAt ? "is-earned" : "",
    task.cancelledAt ? "is-cancelled" : ""
  ].filter(Boolean).join(" ");

  const title = document.createElement("div");
  title.className = "ledger-title";

  const name = document.createElement("strong");
  name.textContent = task.title;

  const due = document.createElement("span");
  due.textContent = `${TYPE_LABELS[task.type] || task.type} · ${status.label} · ${formatDueDate(task.due)}`;

  title.append(name, due);

  const stake = renderLedgerAmount("Moral value", task.cancelledAt ? "0" : formatScore(task.points));
  const earned = task.completedAt ? renderLedgerAmount("Earned", formatScore(task.points), "positive") : renderLedgerAmount("Earned", "0");
  const penalty = status.isOverdue ? renderLedgerAmount("If ignored", `-${task.points * 2}`, "negative") : renderLedgerAmount("If ignored", task.completedAt || task.pendingAt || task.cancelledAt ? "0" : `-${task.points * 2}`);
  const net = task.completedAt ? task.points : status.isOverdue ? -task.points * 2 : 0;
  const result = renderLedgerAmount("Net", formatScore(net), net < 0 ? "negative" : net > 0 ? "positive" : "");

  row.append(title, stake, earned, penalty, result);
  return row;
}

function renderWeeklyReckoning(weekly) {
  const reckoning = document.createElement("section");
  reckoning.className = "weekly-reckoning";

  const heading = document.createElement("div");
  heading.className = "weekly-heading";
  const title = document.createElement("h3");
  title.textContent = "Weekly Reckoning";
  const range = document.createElement("span");
  range.textContent = weekly.range;
  heading.append(title, range);

  const metrics = document.createElement("div");
  metrics.className = "weekly-metrics";
  metrics.append(
    renderLedgerMetric("Approved", String(weekly.approvedCount), "positive"),
    renderLedgerMetric("Missed", String(weekly.missedCount), weekly.missedCount ? "negative" : ""),
    renderLedgerMetric("Cancelled", String(weekly.cancelledCount)),
    renderLedgerMetric("Pending", String(weekly.pendingCount)),
    renderLedgerMetric("Week Net", formatScore(weekly.net), weekly.net < 0 ? "negative" : "positive")
  );

  reckoning.append(heading, metrics);
  return reckoning;
}

function renderLedgerAmount(label, value, tone = "") {
  const amount = document.createElement("div");
  amount.className = `ledger-amount ${tone}`.trim();

  const labelEl = document.createElement("span");
  labelEl.textContent = label;

  const valueEl = document.createElement("strong");
  valueEl.textContent = value;

  amount.append(labelEl, valueEl);
  return amount;
}

function renderTask(task) {
  const status = getTaskStatus(task);
  const card = document.createElement("article");
  card.className = [
    "task-card",
    status.isOverdue ? "is-overdue" : "",
    task.pendingAt ? "is-pending" : "",
    task.completedAt ? "is-done" : "",
    task.rejectedAt && !task.pendingAt && !task.completedAt ? "is-rejected" : ""
  ].filter(Boolean).join(" ");
  card.dataset.id = task.id;

  const completeButton = document.createElement("button");
  completeButton.className = "complete-button";
  completeButton.type = "button";
  if (task.completedAt) {
    completeButton.dataset.action = "reopen";
    completeButton.setAttribute("aria-label", "Reopen approved task with parent password");
    completeButton.textContent = "✓";
  } else if (task.pendingAt) {
    completeButton.disabled = true;
    completeButton.setAttribute("aria-label", "Task filed for parent review");
    completeButton.textContent = "?";
  } else {
    completeButton.dataset.action = "file";
    completeButton.setAttribute("aria-label", "File task for parent review");
    completeButton.textContent = "";
  }

  const main = document.createElement("div");
  main.className = "task-main";

  const titleRow = document.createElement("div");
  titleRow.className = "task-title-row";

  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;

  const typePill = document.createElement("span");
  typePill.className = "pill";
  typePill.textContent = TYPE_LABELS[task.type] || task.type;

  const statusPill = document.createElement("span");
  statusPill.className = `pill ${status.key}`;
  statusPill.textContent = status.label;

  titleRow.append(title, typePill, statusPill);

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.append(
    makeMeta(formatDueDate(task.due)),
    makeMeta(`+${task.points} moral value`),
    makeMeta(`-${task.points * 2} if ignored`)
  );
  if (task.repeatsDaily) {
    meta.append(makeMeta("Repeats daily"));
  }
  if (task.pendingAt) {
    meta.append(makeMeta(`Filed ${formatDateTime(task.pendingAt)}`));
  }
  if (task.rejectedAt && !task.pendingAt && !task.completedAt) {
    meta.append(makeMeta(`Rejected ${formatDateTime(task.rejectedAt)}`));
  }
  if (status.isOverdue) {
    meta.append(makeMeta(`Penalty -${task.points * 2}`));
  }
  if (task.completedAt) {
    meta.append(makeMeta(`Approved ${formatDateTime(task.completedAt)}`));
  }

  main.append(titleRow, meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  if (task.pendingAt) {
    actions.append(
      makeActionButton("approve", "Approve task with parent password", "✓", "approve"),
      makeActionButton("reject", "Reject task with parent password", "!", "reject"),
      makeActionButton("delete", "Cancel task with parent password", "×", "delete")
    );
  } else if (task.completedAt) {
    actions.append(
      makeActionButton("reopen", "Reopen task with parent password", "↺", "reopen"),
      makeActionButton("delete", "Cancel task with parent password", "×", "delete")
    );
  } else {
    actions.append(
      makeActionButton("delete", "Cancel task with parent password", "×", "delete")
    );
  }

  card.append(completeButton, main, actions);
  return card;
}

function makeMeta(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

function makeActionButton(action, label, icon, extraClass = "") {
  const button = document.createElement("button");
  button.className = `task-action ${extraClass}`.trim();
  button.type = "button";
  button.dataset.action = action;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.textContent = icon;
  return button;
}

function getFilteredTasks(allTasks, filter) {
  return [...allTasks]
    .sort(sortTasks)
    .filter(task => {
      const status = getTaskStatus(task);
      if (filter === "active") {
        return !task.completedAt && !task.cancelledAt;
      }
      if (filter === "overdue") {
        return status.isOverdue;
      }
      if (filter === "soon") {
        return !task.completedAt && !task.cancelledAt && !task.pendingAt && Number.isFinite(status.daysUntil) && status.daysUntil >= 0 && status.daysUntil <= 2;
      }
      if (filter === "today") {
        return !task.completedAt && !task.cancelledAt && (status.isOverdue || status.daysUntil === 0 || !task.due || Boolean(task.pendingAt));
      }
      if (filter === "done") {
        return Boolean(task.completedAt && !task.cancelledAt);
      }
      return !task.cancelledAt;
    });
}

function sortTasks(a, b) {
  if (Boolean(a.cancelledAt) !== Boolean(b.cancelledAt)) {
    return a.cancelledAt ? 1 : -1;
  }
  if (Boolean(a.completedAt) !== Boolean(b.completedAt)) {
    return a.completedAt ? 1 : -1;
  }
  if (Boolean(a.pendingAt) !== Boolean(b.pendingAt)) {
    return a.pendingAt ? 1 : -1;
  }
  const aDate = parseDate(a.due);
  const bDate = parseDate(b.due);
  if (!aDate && !bDate) {
    return a.title.localeCompare(b.title);
  }
  if (!aDate) {
    return 1;
  }
  if (!bDate) {
    return -1;
  }
  return aDate - bDate;
}

function getState() {
  const active = tasks.filter(task => !task.completedAt && !task.cancelledAt);
  const actionable = active.filter(task => !task.pendingAt);
  const pending = active.filter(task => task.pendingAt);
  const completed = tasks.filter(task => task.completedAt && !task.cancelledAt);
  const cancelled = tasks.filter(task => task.cancelledAt);
  const overdue = actionable.filter(task => getTaskStatus(task).isOverdue);
  const dueSoon = actionable.filter(task => {
    const days = getTaskStatus(task).daysUntil;
    return Number.isFinite(days) && days >= 0 && days <= 2;
  });
  const earnedPoints = completed.reduce((sum, task) => sum + task.points, 0);
  const penaltyPoints = overdue.reduce((sum, task) => sum + task.points * 2, 0);
  const openStake = active.reduce((sum, task) => sum + task.points, 0);
  const pendingPoints = pending.reduce((sum, task) => sum + task.points, 0);
  const points = earnedPoints - penaltyPoints;
  const streak = calculateStreak(completed);
  const weekly = getWeeklyReckoning(tasks);
  const slackScore = clamp(overdue.length * 26 + actionable.length * 4 + pending.length * 2, 0, 100);

  return {
    openCount: active.length,
    actionableCount: actionable.length,
    pendingCount: pending.length,
    completedCount: completed.length,
    cancelledCount: cancelled.length,
    overdueCount: overdue.length,
    dueSoonCount: dueSoon.length,
    points,
    earnedPoints,
    penaltyPoints,
    pendingPoints,
    openStake,
    weekly,
    streak,
    slackScore
  };
}

function getTaskStatus(task) {
  if (task.cancelledAt) {
    return { key: "cancelled", label: "Cancelled", isOverdue: false, daysUntil: Infinity };
  }

  if (task.completedAt) {
    return { key: "done", label: "Approved", isOverdue: false, daysUntil: 0 };
  }

  if (task.pendingAt) {
    return { key: "pending", label: "Filed, not proven", isOverdue: false, daysUntil: getTaskDaysUntil(task) };
  }

  if (!task.due) {
    return { key: "open", label: "No due date", isOverdue: false, daysUntil: Infinity };
  }

  const daysUntil = getTaskDaysUntil(task);
  if (daysUntil < 0) {
    const daysLate = Math.abs(daysUntil);
    return {
      key: "overdue",
      label: `${daysLate} ${daysLate === 1 ? "day" : "days"} late`,
      isOverdue: true,
      daysUntil
    };
  }
  if (daysUntil === 0) {
    return { key: "today", label: "Today", isOverdue: false, daysUntil };
  }
  if (daysUntil === 1) {
    return { key: "soon", label: "Tomorrow", isOverdue: false, daysUntil };
  }
  return { key: "soon", label: `In ${daysUntil} days`, isOverdue: false, daysUntil };
}

function getTaskDaysUntil(task) {
  if (!task.due) {
    return Infinity;
  }
  return daysBetween(startOfDay(new Date()), parseDate(task.due));
}

function getWeeklyReckoning(allTasks) {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const approved = allTasks.filter(task => isWithinWeek(task.completedAt, weekStart, weekEnd) && !task.cancelledAt);
  const cancelled = allTasks.filter(task => isWithinWeek(task.cancelledAt, weekStart, weekEnd));
  const pending = allTasks.filter(task => task.pendingAt && !task.completedAt && !task.cancelledAt);
  const missed = allTasks.filter(task => {
    if (task.completedAt || task.cancelledAt || task.pendingAt || !task.due) {
      return false;
    }
    const dueDate = parseDate(task.due);
    return dueDate >= weekStart && dueDate <= today && getTaskStatus(task).isOverdue;
  });
  const earned = approved.reduce((sum, task) => sum + task.points, 0);
  const penalty = missed.reduce((sum, task) => sum + task.points * 2, 0);

  return {
    range: `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`,
    approvedCount: approved.length,
    missedCount: missed.length,
    cancelledCount: cancelled.length,
    pendingCount: pending.length,
    earned,
    penalty,
    net: earned - penalty
  };
}

function renderThoughtLog(state) {
  els.thoughtLog.innerHTML = "";
  getThoughts(state).forEach(thought => {
    const line = document.createElement("div");
    line.className = "thought-line";

    const voice = document.createElement("span");
    voice.className = "thought-voice";
    voice.textContent = thought.voice;

    const text = document.createElement("span");
    text.className = "thought-text";
    text.textContent = thought.text;

    line.append(voice, text);
    els.thoughtLog.appendChild(line);
  });
}

function getThoughts(state) {
  const thoughts = [];

  if (state.overdueCount > 0) {
    thoughts.push({
      voice: "Squalor Sense",
      text: `${state.overdueCount} critical ${state.overdueCount === 1 ? "case is" : "cases are"} decomposing in public. Handle the smell.`
    });
  } else {
    thoughts.push({
      voice: "Poise",
      text: "No critical cases. Stand normally. Try not to make it strange."
    });
  }

  if (state.dueSoonCount > 0) {
    thoughts.push({
      voice: "Red Thread",
      text: `${state.dueSoonCount} open ${state.dueSoonCount === 1 ? "case wants" : "cases want"} attention within two days. The board vibrates softly.`
    });
  }

  if (state.points < 0) {
    thoughts.push({
      voice: "Moral Ledger",
      text: `${formatScore(state.points)} moral points. The account is not overdrawn. It is being publicly haunted.`
    });
  } else if (state.points >= 100) {
    thoughts.push({
      voice: "Moral Ledger",
      text: "Evidence suggests a competent person lives here. Disturbing, but statistically supported."
    });
  } else if (state.completedCount > 0) {
    thoughts.push({
      voice: "Moral Ledger",
      text: "Approved cases create moral points. Moral points create momentum. Momentum creates fewer side-eyes from the ledger."
    });
  } else {
    thoughts.push({
      voice: "Moral Ledger",
      text: "No approved cases yet. The first victory is waiting in a cheap suit."
    });
  }

  if (state.streak > 0) {
    thoughts.push({
      voice: "Method",
      text: `${state.streak}-day streak. A fragile ritual. Feed it before midnight.`
    });
  } else if (state.openCount > 0) {
    thoughts.push({
      voice: "Executive Static",
      text: "Pick one case. Any case. The first click is the hinge in the universe."
    });
  }

  return thoughts.slice(0, 4);
}

function getBriefQuote(state) {
  let bucket = QUIPS.clean;
  if (state.overdueCount >= 4) {
    bucket = QUIPS.chaos;
  } else if (state.overdueCount >= 2) {
    bucket = QUIPS.spicy;
  } else if (state.overdueCount === 1 || state.dueSoonCount >= 3) {
    bucket = QUIPS.mild;
  }

  const quote = randomFrom(bucket);
  if (quote === lastQuote && bucket.length > 1) {
    return getBriefQuote(state);
  }
  lastQuote = quote;
  return quote;
}

function getLevel(points) {
  return LEVELS.reduce((current, level) => (points >= level.min ? level.name : current), LEVELS[0].name);
}

function calculateStreak(completed) {
  const doneDays = new Set(completed.map(task => toDateInput(new Date(task.completedAt))));
  let streak = 0;
  let cursor = startOfDay(new Date());
  while (doneDays.has(toDateInput(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 2400);
}

function burstConfetti() {
  const colors = ["#f7c948", "#ef6b5a", "#1f8f8a", "#3d6fb6", "#3caa68"];
  for (let index = 0; index < 28; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 160}ms`;
    document.body.appendChild(piece);
    window.setTimeout(() => piece.remove(), 1200);
  }
}

function formatDueDate(dateString) {
  if (!dateString) {
    return "No due date";
  }
  const date = parseDate(dateString);
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
  return `Due ${formatted}`;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatScore(value) {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

function parseDate(dateString) {
  if (!dateString) {
    return null;
  }
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInput(date) {
  const safeDate = new Date(date);
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfWeek(date) {
  const start = startOfDay(date);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(start, offset);
}

function isWithinWeek(value, weekStart, weekEnd) {
  if (!value) {
    return false;
  }
  const date = startOfDay(new Date(value));
  return date >= weekStart && date <= weekEnd;
}

function daysBetween(start, end) {
  return Math.round((startOfDay(end) - startOfDay(start)) / 86400000);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomFrom(items) {
  return items[Math.floor(Math.random() * items.length)];
}
