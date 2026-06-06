/**
 * STUDENT LIFE OS — script.js
 * Full vanilla JS, no backend, all data in localStorage
 * Modular structure with clear section comments
 */

'use strict';

/* =====================================================
   1. STATE & STORAGE HELPERS
   ===================================================== */

const STORE_KEY = 'slos_v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveState(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('LocalStorage save failed:', e);
  }
}

// Deep-merge defaults into state so old saves still work
function getState() {
  const saved = loadState();
  const defaults = {
    theme: 'dark',
    xp: 0,
    streak: 0,
    lastActiveDate: '',
    xpHistory: {},          // { 'YYYY-MM-DD': xp }
    streakHistory: {},      // { 'YYYY-MM-DD': true }
    tasksDoneTotal: 0,
    morning: {
      wakeupTime: '',
      routines: [
        { id: 'r1', label: '💧 Drink Water',   xp: 5,  completed: false, custom: false },
        { id: 'r2', label: '🏃 Exercise',       xp: 15, completed: false, custom: false },
        { id: 'r3', label: '📖 Reading',        xp: 10, completed: false, custom: false },
        { id: 'r4', label: '📝 Planning',       xp: 5,  completed: false, custom: false },
        { id: 'r5', label: '🧘 Meditation',     xp: 5,  completed: false, custom: false },
      ],
    },
    focus: {
      mainGoal: '',
      priorities: ['', '', ''],
      tasks: [],
    },
    habits: [],             // { id, name, emoji, streak, lastDone, history:{} }
    skills: [],             // { id, name, emoji, days, lastPracticed, streak, history:{} }
    til: [],                // { id, title, body, category, date }
    projects: [],           // { id, name, notes, status, progress }
    ideas: [],              // { id, title, desc, category, date }
    missions: [],           // { id, title, progress, completed }
    reflections: [],        // { id, date, completed, learned, wrong, improve, tomorrow }
  };
  return deepMerge(defaults, saved);
}

function deepMerge(defaults, saved) {
  const out = { ...defaults };
  for (const key of Object.keys(saved)) {
    if (
      saved[key] !== null &&
      typeof saved[key] === 'object' &&
      !Array.isArray(saved[key]) &&
      typeof defaults[key] === 'object' &&
      !Array.isArray(defaults[key])
    ) {
      out[key] = deepMerge(defaults[key] || {}, saved[key]);
    } else {
      out[key] = saved[key];
    }
  }
  return out;
}

let STATE = getState();

function persist() {
  saveState(STATE);
}

/* =====================================================
   2. DATE / TIME UTILITIES
   ===================================================== */

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()];
}

/* =====================================================
   3. XP / LEVEL SYSTEM
   ===================================================== */

const LEVELS = [
  { level: 1, name: 'Student',  min: 0    },
  { level: 2, name: 'Learner',  min: 200  },
  { level: 3, name: 'Builder',  min: 500  },
  { level: 4, name: 'Creator',  min: 1000 },
  { level: 5, name: 'Master',   min: 2000 },
];

function getLevelInfo(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.min) current = l;
  }
  const nextIdx = LEVELS.findIndex(l => l.level === current.level) + 1;
  const next = LEVELS[nextIdx] || null;
  const pct = next
    ? Math.min(100, Math.round(((xp - current.min) / (next.min - current.min)) * 100))
    : 100;
  return { ...current, next, pct };
}

function awardXP(amount, label) {
  const prevLevel = getLevelInfo(STATE.xp).level;
  STATE.xp += amount;
  const today = todayStr();
  STATE.xpHistory[today] = (STATE.xpHistory[today] || 0) + amount;
  persist();
  showXPToast(`+${amount} XP — ${label}`);
  const newLevel = getLevelInfo(STATE.xp).level;
  if (newLevel > prevLevel) showLevelUp(getLevelInfo(STATE.xp));
  updateXPUI();
}

function showXPToast(msg) {
  const toast = document.getElementById('xpToast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function showLevelUp(levelInfo) {
  const el = document.createElement('div');
  el.className = 'level-up-toast';
  el.innerHTML = `🎉 LEVEL UP!<br>You are now a <strong>${levelInfo.name}</strong>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function updateXPUI() {
  const info = getLevelInfo(STATE.xp);
  // Sidebar
  setText('sidebarLevel', `Lv.${info.level}`);
  setText('sidebarLevelName', info.name);
  setText('sidebarXpVal', `${STATE.xp} XP`);
  setStyle('sidebarXpBar', 'width', `${info.pct}%`);
  // Dashboard
  setText('dashXp', STATE.xp);
  setText('dashLevel', info.level);
  setText('dashLevelName', info.name);
  // Streak
  setText('sidebarStreak', STATE.streak);
  setText('dashStreak', STATE.streak);
}

/* =====================================================
   4. STREAK SYSTEM
   ===================================================== */

function checkAndUpdateStreak() {
  const today = todayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  if (STATE.lastActiveDate === today) return; // already counted
  if (STATE.lastActiveDate === yStr) {
    STATE.streak += 1;
  } else if (STATE.lastActiveDate !== today) {
    STATE.streak = 1;
  }
  STATE.lastActiveDate = today;
  STATE.streakHistory[today] = true;
  persist();
}

/* =====================================================
   5. NAVIGATION
   ===================================================== */

function initNav() {
  // Sidebar links
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.section);
    });
  });
  // Bottom nav
  document.querySelectorAll('.bottom-nav .bn-item').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.section);
    });
  });
  // Drawer links
  document.querySelectorAll('[data-drawer]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.section);
      closeDrawer();
    });
  });
  // Mobile menu
  document.getElementById('mobileMenuBtn').addEventListener('click', openDrawer);
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
  document.getElementById('drawerThemeBtn').addEventListener('click', toggleTheme);
}

function navigateTo(sectionId) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  // Show target
  const target = document.getElementById(`section-${sectionId}`);
  if (target) target.classList.add('active');
  // Update nav active states
  document.querySelectorAll('.nav-item').forEach(l => {
    l.classList.toggle('active', l.dataset.section === sectionId);
  });
  document.querySelectorAll('.bn-item').forEach(l => {
    l.classList.toggle('active', l.dataset.section === sectionId);
  });
  // Refresh section-specific renders
  const refreshMap = {
    dashboard: renderDashboard,
    morning: renderMorning,
    focus: renderFocus,
    habits: renderHabits,
    skills: renderSkills,
    til: renderTIL,
    projects: renderProjects,
    ideas: renderIdeas,
    missions: renderMissions,
    evening: renderEvening,
    analytics: renderAnalytics,
  };
  if (refreshMap[sectionId]) refreshMap[sectionId]();
}

function openDrawer() {
  document.getElementById('mobileDrawer').classList.add('open');
  document.getElementById('drawerOverlay').style.display = 'block';
}
function closeDrawer() {
  document.getElementById('mobileDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').style.display = 'none';
}

/* =====================================================
   6. THEME
   ===================================================== */

function initTheme() {
  applyTheme(STATE.theme || 'dark');
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
}

function toggleTheme() {
  STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
  applyTheme(STATE.theme);
  persist();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.querySelector('.theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  const drawerBtn = document.getElementById('drawerThemeBtn');
  if (drawerBtn) drawerBtn.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
}

/* =====================================================
   7. LIVE CLOCK & DATE
   ===================================================== */

function startClock() {
  function tick() {
    const now = new Date();
    const dateEl = document.getElementById('liveDate');
    const clockEl = document.getElementById('liveClock');
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

/* =====================================================
   8. MOTIVATIONAL QUOTES
   ===================================================== */

const QUOTES = [
  "The secret of getting ahead is getting started. — Mark Twain",
  "It does not matter how slowly you go as long as you do not stop. — Confucius",
  "You don't have to be great to start, but you have to start to be great. — Zig Ziglar",
  "Small daily improvements over time lead to stunning results. — Robin Sharma",
  "Discipline is doing what needs to be done, even when you don't want to. — Unknown",
  "An investment in knowledge pays the best interest. — Benjamin Franklin",
  "Learning never exhausts the mind. — Leonardo da Vinci",
  "The expert in anything was once a beginner. — Helen Hayes",
  "Push yourself, because no one else is going to do it for you. — Unknown",
  "Your future is created by what you do today, not tomorrow. — Robert Kiyosaki",
  "Study hard, for the well is deep and our brains are shallow. — Richard Baxter",
  "The more that you read, the more things you will know. — Dr. Seuss",
  "Don't watch the clock; do what it does. Keep going. — Sam Levenson",
  "Success is the sum of small efforts repeated day in and day out. — Robert Collier",
  "Believe you can and you're halfway there. — Theodore Roosevelt",
  "Knowledge is power. — Francis Bacon",
  "The journey of a thousand miles begins with one step. — Lao Tzu",
  "You are never too old to set another goal or to dream a new dream. — C.S. Lewis",
  "Genius is 1% inspiration and 99% perspiration. — Thomas Edison",
  "The only way to do great work is to love what you do. — Steve Jobs",
];

let quoteIndex = Math.floor(Math.random() * QUOTES.length);

function renderQuote() {
  setText('quoteText', QUOTES[quoteIndex]);
}
function nextQuote() {
  quoteIndex = (quoteIndex + 1) % QUOTES.length;
  renderQuote();
}

/* =====================================================
   9. DASHBOARD
   ===================================================== */

function renderDashboard() {
  renderQuote();
  updateXPUI();

  // Tasks done total
  setText('dashTasksDone', STATE.tasksDoneTotal || 0);

  // Habit ring
  const today = todayStr();
  const habits = STATE.habits;
  const doneHabits = habits.filter(h => h.history && h.history[today]).length;
  const totalHabits = habits.length;
  setRing('habitRing', doneHabits, totalHabits);
  setText('habitBadge', `${doneHabits}/${totalHabits}`);
  setText('habitPct', totalHabits ? `${Math.round((doneHabits / totalHabits) * 100)}%` : '0%');

  // Morning ring
  const routines = STATE.morning.routines;
  const doneRoutines = routines.filter(r => r.completed).length;
  const totalRoutines = routines.length;
  setRing('morningRing', doneRoutines, totalRoutines);
  setText('morningBadge', `${doneRoutines}/${totalRoutines}`);
  setText('morningPct', totalRoutines ? `${Math.round((doneRoutines / totalRoutines) * 100)}%` : '0%');

  // Mission preview
  const missionPreview = document.getElementById('missionPreview');
  if (missionPreview) {
    missionPreview.innerHTML = '';
    const missions = STATE.missions.slice(0, 3);
    if (!missions.length) {
      missionPreview.innerHTML = '<p style="font-size:0.78rem;color:var(--text3)">No missions yet</p>';
    } else {
      missions.forEach(m => {
        const pct = m.completed ? 100 : (m.progress || 0);
        missionPreview.innerHTML += `
          <div class="mini-progress-item">
            <span>${m.title}</span>
            <div class="mini-progress-bar-wrap">
              <div class="mini-progress-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>`;
      });
    }
    setText('missionBadge', `${STATE.missions.filter(m => m.completed).length}/${STATE.missions.length}`);
  }

  // Skill preview
  const skillPreview = document.getElementById('skillPreview');
  if (skillPreview) {
    skillPreview.innerHTML = '';
    const topSkills = [...STATE.skills].sort((a, b) => b.days - a.days).slice(0, 4);
    if (!topSkills.length) {
      skillPreview.innerHTML = '<p style="font-size:0.78rem;color:var(--text3)">No skills yet</p>';
    } else {
      const maxDays = Math.max(...topSkills.map(s => s.days), 1);
      topSkills.forEach(s => {
        const pct = Math.min(100, Math.round((s.days / Math.max(maxDays, 100)) * 100));
        skillPreview.innerHTML += `
          <div class="skill-preview-item">
            <div class="skill-preview-name">
              <span>${s.emoji || '⚔️'} ${s.name}</span>
              <span>${s.days}d</span>
            </div>
            <div class="skill-preview-bar-wrap">
              <div class="skill-preview-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>`;
      });
    }
  }
}

function setRing(id, done, total) {
  const el = document.getElementById(id);
  if (!el) return;
  const circumference = 213.6;
  const pct = total > 0 ? done / total : 0;
  el.style.strokeDashoffset = circumference - pct * circumference;
}

/* =====================================================
   10. MORNING ROUTINE
   ===================================================== */

function renderMorning() {
  const { routines, wakeupTime } = STATE.morning;
  const wakeEl = document.getElementById('wakeupTime');
  if (wakeEl) wakeEl.value = wakeupTime || '';

  const list = document.getElementById('routineList');
  if (!list) return;
  list.innerHTML = '';

  routines.forEach(r => {
    const div = document.createElement('div');
    div.className = `routine-item${r.completed ? ' completed' : ''}`;
    div.innerHTML = `
      <button class="routine-checkbox" data-id="${r.id}" aria-label="Toggle ${r.label}">✓</button>
      <span class="routine-label">${r.label}</span>
      <span class="routine-xp">+${r.xp} XP</span>
      ${r.custom ? `<button class="routine-delete" data-id="${r.id}" title="Delete">✕</button>` : ''}
    `;
    list.appendChild(div);
  });

  const done = routines.filter(r => r.completed).length;
  setText('morningMeta', `${done} / ${routines.length} complete`);
}

function initMorning() {
  // Wake-up time
  document.getElementById('wakeupTime')?.addEventListener('change', e => {
    STATE.morning.wakeupTime = e.target.value;
    persist();
  });

  // Toggle routine
  document.getElementById('routineList')?.addEventListener('click', e => {
    const btn = e.target.closest('.routine-checkbox');
    const del = e.target.closest('.routine-delete');
    if (btn) {
      const id = btn.dataset.id;
      const r = STATE.morning.routines.find(x => x.id === id);
      if (!r) return;
      if (!r.completed) {
        r.completed = true;
        awardXP(r.xp, r.label);
      } else {
        r.completed = false;
        STATE.xp = Math.max(0, STATE.xp - r.xp);
        persist();
        updateXPUI();
      }
      persist();
      renderMorning();
    }
    if (del) {
      const id = del.dataset.id;
      STATE.morning.routines = STATE.morning.routines.filter(x => x.id !== id);
      persist();
      renderMorning();
    }
  });

  // Add custom routine
  document.getElementById('addRoutineBtn')?.addEventListener('click', () => {
    const input = document.getElementById('newRoutineInput');
    const val = input?.value.trim();
    if (!val) return;
    STATE.morning.routines.push({
      id: uid(),
      label: val,
      xp: 5,
      completed: false,
      custom: true,
    });
    input.value = '';
    persist();
    renderMorning();
  });
  document.getElementById('newRoutineInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addRoutineBtn').click();
  });
}

/* =====================================================
   11. TODAY'S FOCUS
   ===================================================== */

function renderFocus() {
  const { mainGoal, priorities, tasks } = STATE.focus;
  const goalEl = document.getElementById('mainGoal');
  if (goalEl) goalEl.value = mainGoal || '';

  // Priorities
  const pList = document.getElementById('prioritiesList');
  if (pList) {
    pList.innerHTML = '';
    [0, 1, 2].forEach(i => {
      const row = document.createElement('div');
      row.className = 'priority-item';
      row.innerHTML = `
        <span class="priority-num">#${i + 1}</span>
        <input type="text" class="input-field" placeholder="Priority ${i + 1}..." maxlength="100"
          data-priority-idx="${i}" value="${escHtml(priorities[i] || '')}" />
      `;
      pList.appendChild(row);
    });
  }

  // Tasks
  const tasksList = document.getElementById('tasksList');
  if (tasksList) {
    tasksList.innerHTML = '';
    if (!tasks.length) {
      tasksList.innerHTML = `<div class="empty-state"><span class="empty-icon">🎯</span><p>No tasks yet</p></div>`;
    } else {
      tasks.forEach(t => {
        const div = document.createElement('div');
        div.className = `task-item${t.done ? ' done' : ''}`;
        div.innerHTML = `
          <button class="task-check" data-id="${t.id}" aria-label="Toggle task">✓</button>
          <span class="task-text">${escHtml(t.text)}</span>
          <span class="priority-tag ${t.priority}">${t.priority}</span>
          <button class="task-delete" data-id="${t.id}" title="Delete">✕</button>
        `;
        tasksList.appendChild(div);
      });
    }
    const done = tasks.filter(t => t.done).length;
    setText('taskStats', `${done} / ${tasks.length}`);
  }
}

function initFocus() {
  // Main goal auto-save
  document.getElementById('mainGoal')?.addEventListener('input', e => {
    STATE.focus.mainGoal = e.target.value;
    persist();
  });

  // Priority auto-save
  document.getElementById('prioritiesList')?.addEventListener('input', e => {
    const idx = e.target.dataset.priorityIdx;
    if (idx !== undefined) {
      STATE.focus.priorities[parseInt(idx)] = e.target.value;
      persist();
    }
  });

  // Add task
  document.getElementById('addTaskBtn')?.addEventListener('click', addTask);
  document.getElementById('newTaskInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  // Task toggle / delete
  document.getElementById('tasksList')?.addEventListener('click', e => {
    const check = e.target.closest('.task-check');
    const del = e.target.closest('.task-delete');
    if (check) {
      const id = check.dataset.id;
      const task = STATE.focus.tasks.find(t => t.id === id);
      if (!task) return;
      if (!task.done) {
        task.done = true;
        STATE.tasksDoneTotal = (STATE.tasksDoneTotal || 0) + 1;
        awardXP(5, 'Task completed');
      } else {
        task.done = false;
        STATE.tasksDoneTotal = Math.max(0, (STATE.tasksDoneTotal || 0) - 1);
        STATE.xp = Math.max(0, STATE.xp - 5);
        persist();
        updateXPUI();
      }
      persist();
      renderFocus();
    }
    if (del) {
      const id = del.dataset.id;
      STATE.focus.tasks = STATE.focus.tasks.filter(t => t.id !== id);
      persist();
      renderFocus();
    }
  });
}

function addTask() {
  const input = document.getElementById('newTaskInput');
  const priority = document.getElementById('taskPriority')?.value || 'medium';
  const val = input?.value.trim();
  if (!val) return;
  STATE.focus.tasks.push({ id: uid(), text: val, priority, done: false });
  input.value = '';
  persist();
  renderFocus();
}

/* =====================================================
   12. HABIT TRACKER
   ===================================================== */

function renderHabits() {
  const grid = document.getElementById('habitsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const today = todayStr();

  if (!STATE.habits.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">🔥</span><p>Add your first habit above</p></div>`;
  } else {
    STATE.habits.forEach(h => {
      const done = !!(h.history && h.history[today]);
      const card = document.createElement('div');
      card.className = `habit-card${done ? ' completed' : ''}`;
      card.innerHTML = `
        <div class="habit-card-header">
          <span class="habit-emoji">${h.emoji || '🔥'}</span>
          <span class="habit-name">${escHtml(h.name)}</span>
          <button class="habit-delete" data-id="${h.id}" title="Delete habit">✕</button>
        </div>
        <div class="habit-streak-row">🔥 ${h.streak || 0} day streak</div>
        <button class="habit-toggle-btn" data-id="${h.id}">
          ${done ? '✅ Done Today' : '○  Mark Complete'}
        </button>
      `;
      grid.appendChild(card);
    });
  }

  renderWeeklyChart();
}

function renderWeeklyChart() {
  const container = document.getElementById('weeklyChart');
  if (!container) return;
  container.innerHTML = '';
  const days = last7Days();

  if (!STATE.habits.length) {
    container.innerHTML = '<p style="font-size:0.8rem;color:var(--text3)">No habits to chart yet.</p>';
    return;
  }

  STATE.habits.forEach(h => {
    const row = document.createElement('div');
    row.className = 'weekly-habit-row';
    let dotsHTML = `<div class="weekly-habit-name">${h.emoji || '🔥'} ${escHtml(h.name)}</div><div class="weekly-dots">`;
    days.forEach(d => {
      const done = h.history && h.history[d];
      dotsHTML += `<div class="weekly-dot${done ? ' done' : ''}" title="${d}">✓</div>`;
    });
    dotsHTML += '</div>';
    row.innerHTML = dotsHTML;
    container.appendChild(row);
  });
}

function initHabits() {
  document.getElementById('addHabitBtn')?.addEventListener('click', () => {
    const nameEl = document.getElementById('newHabitInput');
    const emojiEl = document.getElementById('newHabitEmoji');
    const name = nameEl?.value.trim();
    if (!name) return;
    STATE.habits.push({
      id: uid(),
      name,
      emoji: emojiEl?.value.trim() || '🔥',
      streak: 0,
      lastDone: '',
      history: {},
    });
    nameEl.value = '';
    if (emojiEl) emojiEl.value = '';
    persist();
    renderHabits();
  });

  document.getElementById('newHabitInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addHabitBtn').click();
  });

  document.getElementById('habitsGrid')?.addEventListener('click', e => {
    const toggleBtn = e.target.closest('.habit-toggle-btn');
    const delBtn = e.target.closest('.habit-delete');

    if (toggleBtn) {
      const id = toggleBtn.dataset.id;
      const habit = STATE.habits.find(h => h.id === id);
      if (!habit) return;
      const today = todayStr();
      if (!habit.history) habit.history = {};

      if (!habit.history[today]) {
        // Mark done
        habit.history[today] = true;
        // Update streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);
        if (habit.lastDone === yStr || habit.lastDone === today) {
          habit.streak = (habit.streak || 0) + 1;
        } else {
          habit.streak = 1;
        }
        habit.lastDone = today;
        awardXP(10, `Habit: ${habit.name}`);
      } else {
        // Unmark
        delete habit.history[today];
        habit.streak = Math.max(0, (habit.streak || 1) - 1);
        STATE.xp = Math.max(0, STATE.xp - 10);
        persist();
        updateXPUI();
      }
      persist();
      renderHabits();
    }

    if (delBtn) {
      const id = delBtn.dataset.id;
      if (confirm('Delete this habit?')) {
        STATE.habits = STATE.habits.filter(h => h.id !== id);
        persist();
        renderHabits();
      }
    }
  });
}

/* =====================================================
   13. SKILL BUILDER
   ===================================================== */

const SKILL_LEVELS = [
  { name: 'Beginner',     min: 0   },
  { name: 'Novice',       min: 7   },
  { name: 'Intermediate', min: 21  },
  { name: 'Advanced',     min: 50  },
  { name: 'Expert',       min: 100 },
  { name: 'Master',       min: 200 },
];

function getSkillLevel(days) {
  let lvl = SKILL_LEVELS[0];
  for (const l of SKILL_LEVELS) {
    if (days >= l.min) lvl = l;
  }
  return lvl;
}

function renderSkills() {
  const grid = document.getElementById('skillsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const today = todayStr();

  if (!STATE.skills.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">⚔️</span><p>Add your first skill above</p></div>`;
    return;
  }

  STATE.skills.forEach(s => {
    const lvl = getSkillLevel(s.days || 0);
    const nextLvl = SKILL_LEVELS[SKILL_LEVELS.indexOf(lvl) + 1];
    const pct = nextLvl
      ? Math.min(100, Math.round(((s.days - lvl.min) / (nextLvl.min - lvl.min)) * 100))
      : 100;
    const practicedToday = s.history && s.history[today];

    const card = document.createElement('div');
    card.className = 'skill-card';
    card.innerHTML = `
      <div class="skill-card-header">
        <span class="skill-emoji">${s.emoji || '⚔️'}</span>
        <span class="skill-name">${escHtml(s.name)}</span>
        <button class="skill-delete" data-id="${s.id}" title="Delete">✕</button>
      </div>
      <div class="skill-level-row">
        <span class="skill-level-name">${lvl.name}</span>
        <span class="skill-days">${s.days || 0} practice days</span>
      </div>
      <div class="skill-bar-wrap">
        <div class="skill-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="skill-actions">
        <button class="skill-practice-btn" data-id="${s.id}" ${practicedToday ? 'disabled' : ''}>
          ${practicedToday ? '✅ Practiced Today' : '▶ Log Practice +20 XP'}
        </button>
        <span class="skill-streak">🔥${s.streak || 0}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function initSkills() {
  document.getElementById('addSkillBtn')?.addEventListener('click', () => {
    const nameEl = document.getElementById('newSkillInput');
    const emojiEl = document.getElementById('newSkillEmoji');
    const name = nameEl?.value.trim();
    if (!name) return;
    STATE.skills.push({
      id: uid(),
      name,
      emoji: emojiEl?.value.trim() || '⚔️',
      days: 0,
      streak: 0,
      lastPracticed: '',
      history: {},
    });
    nameEl.value = '';
    if (emojiEl) emojiEl.value = '';
    persist();
    renderSkills();
  });

  document.getElementById('newSkillInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addSkillBtn').click();
  });

  document.getElementById('skillsGrid')?.addEventListener('click', e => {
    const practiceBtn = e.target.closest('.skill-practice-btn');
    const delBtn = e.target.closest('.skill-delete');

    if (practiceBtn && !practiceBtn.disabled) {
      const id = practiceBtn.dataset.id;
      const skill = STATE.skills.find(s => s.id === id);
      if (!skill) return;
      const today = todayStr();
      if (!skill.history) skill.history = {};
      if (skill.history[today]) return;
      skill.history[today] = true;
      skill.days = (skill.days || 0) + 1;

      // Update streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      if (skill.lastPracticed === yStr) {
        skill.streak = (skill.streak || 0) + 1;
      } else {
        skill.streak = 1;
      }
      skill.lastPracticed = today;
      awardXP(20, `Skill: ${skill.name}`);
      persist();
      renderSkills();
    }

    if (delBtn) {
      const id = delBtn.dataset.id;
      if (confirm('Delete this skill?')) {
        STATE.skills = STATE.skills.filter(s => s.id !== id);
        persist();
        renderSkills();
      }
    }
  });
}

/* =====================================================
   14. TODAY I LEARNED
   ===================================================== */

function renderTIL(searchTerm = '', filterCat = '') {
  const entries = document.getElementById('tilEntries');
  if (!entries) return;
  entries.innerHTML = '';

  let list = [...STATE.til].reverse();
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    list = list.filter(e => e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q));
  }
  if (filterCat) {
    list = list.filter(e => e.category === filterCat);
  }

  if (!list.length) {
    entries.innerHTML = `<div class="empty-state"><span class="empty-icon">📚</span><p>No entries yet. Start learning!</p></div>`;
    return;
  }
  list.forEach(e => {
    const div = document.createElement('div');
    div.className = 'til-entry';
    div.innerHTML = `
      <div class="til-entry-header">
        <span class="til-entry-title">${escHtml(e.title)}</span>
        <div class="til-entry-meta">
          <span class="til-cat-badge">${escHtml(e.category)}</span>
          <span class="til-date">${formatDate(e.date)}</span>
          <button class="til-delete" data-id="${e.id}" title="Delete">✕</button>
        </div>
      </div>
      <div class="til-entry-body">${escHtml(e.body)}</div>
    `;
    entries.appendChild(div);
  });
}

function initTIL() {
  document.getElementById('saveTilBtn')?.addEventListener('click', () => {
    const title = document.getElementById('tilTitle')?.value.trim();
    const body = document.getElementById('tilBody')?.value.trim();
    const category = document.getElementById('tilCategory')?.value || 'General';
    if (!title) { alert('Please enter a title.'); return; }
    STATE.til.push({ id: uid(), title, body, category, date: todayStr() });
    document.getElementById('tilTitle').value = '';
    document.getElementById('tilBody').value = '';
    awardXP(10, 'Learning logged');
    persist();
    renderTIL();
  });

  document.getElementById('tilSearch')?.addEventListener('input', e => {
    renderTIL(e.target.value, document.getElementById('tilFilter')?.value);
  });
  document.getElementById('tilFilter')?.addEventListener('change', e => {
    renderTIL(document.getElementById('tilSearch')?.value, e.target.value);
  });

  document.getElementById('tilEntries')?.addEventListener('click', e => {
    const del = e.target.closest('.til-delete');
    if (del) {
      const id = del.dataset.id;
      STATE.til = STATE.til.filter(x => x.id !== id);
      persist();
      renderTIL(
        document.getElementById('tilSearch')?.value,
        document.getElementById('tilFilter')?.value
      );
    }
  });
}

/* =====================================================
   15. PROJECT TRACKER
   ===================================================== */

function renderProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!STATE.projects.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">🚀</span><p>Add your first project</p></div>`;
    return;
  }

  STATE.projects.forEach(p => {
    const statusClass = p.status.replace(/\s+/g, '-').toLowerCase();
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="project-card-header">
        <span class="project-name">${escHtml(p.name)}</span>
        <button class="project-delete" data-id="${p.id}" title="Delete">✕</button>
      </div>
      ${p.notes ? `<div class="project-notes">${escHtml(p.notes)}</div>` : ''}
      <div class="project-status-row">
        <select class="input-field status-select" data-id="${p.id}">
          <option ${p.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
          <option ${p.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option ${p.status === 'Completed' ? 'selected' : ''}>Completed</option>
        </select>
        <span class="status-badge ${statusClass}">${p.status}</span>
      </div>
      <div class="project-progress-row">
        <div class="project-progress-wrap">
          <div class="project-progress-fill" style="width:${p.progress || 0}%"></div>
        </div>
        <input type="number" class="input-field project-pct-input" data-id="${p.id}"
          value="${p.progress || 0}" min="0" max="100" />
        <span class="project-pct">%</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function initProjects() {
  document.getElementById('addProjectBtn')?.addEventListener('click', () => {
    const name = document.getElementById('newProjectName')?.value.trim();
    const notes = document.getElementById('newProjectNotes')?.value.trim();
    if (!name) return;
    STATE.projects.push({ id: uid(), name, notes, status: 'Not Started', progress: 0 });
    document.getElementById('newProjectName').value = '';
    document.getElementById('newProjectNotes').value = '';
    persist();
    renderProjects();
  });

  document.getElementById('projectsGrid')?.addEventListener('click', e => {
    const del = e.target.closest('.project-delete');
    if (del) {
      if (confirm('Delete project?')) {
        STATE.projects = STATE.projects.filter(p => p.id !== del.dataset.id);
        persist();
        renderProjects();
      }
    }
  });

  document.getElementById('projectsGrid')?.addEventListener('change', e => {
    const sel = e.target.closest('.status-select');
    const pct = e.target.closest('.project-pct-input');
    if (sel) {
      const p = STATE.projects.find(x => x.id === sel.dataset.id);
      if (p) { p.status = sel.value; persist(); renderProjects(); }
    }
    if (pct) {
      const p = STATE.projects.find(x => x.id === pct.dataset.id);
      if (p) {
        p.progress = Math.max(0, Math.min(100, parseInt(pct.value) || 0));
        if (p.progress === 100) p.status = 'Completed';
        persist();
        renderProjects();
      }
    }
  });
}

/* =====================================================
   16. IDEA VAULT
   ===================================================== */

function renderIdeas(searchTerm = '', filterCat = '') {
  const grid = document.getElementById('ideasGrid');
  if (!grid) return;
  grid.innerHTML = '';

  let list = [...STATE.ideas].reverse();
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    list = list.filter(i => i.title.toLowerCase().includes(q) || (i.desc || '').toLowerCase().includes(q));
  }
  if (filterCat) {
    list = list.filter(i => i.category === filterCat);
  }

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">💡</span><p>Your idea vault is empty</p></div>`;
    return;
  }
  list.forEach(idea => {
    const card = document.createElement('div');
    card.className = 'idea-card';
    card.innerHTML = `
      <div class="idea-card-header">
        <span class="idea-title">${escHtml(idea.title)}</span>
        <button class="idea-delete" data-id="${idea.id}" title="Delete">✕</button>
      </div>
      ${idea.desc ? `<div class="idea-desc">${escHtml(idea.desc)}</div>` : ''}
      <div class="idea-footer">
        <span class="idea-cat">${escHtml(idea.category)}</span>
        <span class="idea-date">${formatDate(idea.date)}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function initIdeas() {
  document.getElementById('addIdeaBtn')?.addEventListener('click', () => {
    const title = document.getElementById('newIdeaTitle')?.value.trim();
    const desc = document.getElementById('newIdeaDesc')?.value.trim();
    const category = document.getElementById('ideaCategory')?.value;
    if (!title) return;
    STATE.ideas.push({ id: uid(), title, desc, category, date: todayStr() });
    document.getElementById('newIdeaTitle').value = '';
    document.getElementById('newIdeaDesc').value = '';
    persist();
    renderIdeas();
  });

  document.getElementById('ideaSearch')?.addEventListener('input', e => {
    renderIdeas(e.target.value, document.getElementById('ideaFilter')?.value);
  });
  document.getElementById('ideaFilter')?.addEventListener('change', e => {
    renderIdeas(document.getElementById('ideaSearch')?.value, e.target.value);
  });

  document.getElementById('ideasGrid')?.addEventListener('click', e => {
    const del = e.target.closest('.idea-delete');
    if (del) {
      STATE.ideas = STATE.ideas.filter(i => i.id !== del.dataset.id);
      persist();
      renderIdeas(
        document.getElementById('ideaSearch')?.value,
        document.getElementById('ideaFilter')?.value
      );
    }
  });
}

/* =====================================================
   17. WEEKLY MISSIONS
   ===================================================== */

function renderMissions() {
  const list = document.getElementById('missionsList');
  if (!list) return;
  list.innerHTML = '';

  if (!STATE.missions.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">🏆</span><p>Add your weekly missions</p></div>`;
    setText('missionsMeta', '0% complete');
    return;
  }

  const done = STATE.missions.filter(m => m.completed).length;
  const pct = Math.round((done / STATE.missions.length) * 100);
  setText('missionsMeta', `${pct}% complete`);

  STATE.missions.forEach(m => {
    const div = document.createElement('div');
    div.className = `mission-item${m.completed ? ' completed' : ''}`;
    div.innerHTML = `
      <div class="mission-header">
        <button class="mission-check" data-id="${m.id}" aria-label="Toggle">✓</button>
        <span class="mission-title">${escHtml(m.title)}</span>
        <button class="mission-delete" data-id="${m.id}" title="Delete">✕</button>
      </div>
      <div class="mission-progress-row">
        <div class="mission-progress-wrap">
          <div class="mission-progress-fill" style="width:${m.completed ? 100 : (m.progress || 0)}%"></div>
        </div>
        <input type="number" class="input-field mission-pct-input" data-id="${m.id}"
          value="${m.completed ? 100 : (m.progress || 0)}" min="0" max="100" ${m.completed ? 'disabled' : ''} />
        <span class="mission-pct">%</span>
      </div>
    `;
    list.appendChild(div);
  });
}

function initMissions() {
  document.getElementById('addMissionBtn')?.addEventListener('click', () => {
    const input = document.getElementById('newMissionInput');
    const val = input?.value.trim();
    if (!val) return;
    STATE.missions.push({ id: uid(), title: val, progress: 0, completed: false });
    input.value = '';
    persist();
    renderMissions();
  });

  document.getElementById('newMissionInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addMissionBtn').click();
  });

  document.getElementById('missionsList')?.addEventListener('click', e => {
    const checkBtn = e.target.closest('.mission-check');
    const delBtn = e.target.closest('.mission-delete');

    if (checkBtn) {
      const m = STATE.missions.find(x => x.id === checkBtn.dataset.id);
      if (!m) return;
      if (!m.completed) {
        m.completed = true;
        m.progress = 100;
        awardXP(50, `Mission: ${m.title}`);
      } else {
        m.completed = false;
        m.progress = 0;
        STATE.xp = Math.max(0, STATE.xp - 50);
        persist();
        updateXPUI();
      }
      persist();
      renderMissions();
    }
    if (delBtn) {
      STATE.missions = STATE.missions.filter(x => x.id !== delBtn.dataset.id);
      persist();
      renderMissions();
    }
  });

  document.getElementById('missionsList')?.addEventListener('change', e => {
    const input = e.target.closest('.mission-pct-input');
    if (input) {
      const m = STATE.missions.find(x => x.id === input.dataset.id);
      if (m) {
        m.progress = Math.max(0, Math.min(100, parseInt(input.value) || 0));
        if (m.progress === 100 && !m.completed) {
          m.completed = true;
          awardXP(50, `Mission: ${m.title}`);
        }
        persist();
        renderMissions();
      }
    }
  });
}

/* =====================================================
   18. EVENING REFLECTION
   ===================================================== */

function renderEvening() {
  const today = todayStr();
  const reflectionDate = document.getElementById('reflectionDate');
  if (reflectionDate) reflectionDate.textContent = formatDate(today);

  // Check if today's reflection exists and pre-fill
  const existing = STATE.reflections.find(r => r.date === today);
  if (existing) {
    setValue('reflectCompleted', existing.completed || '');
    setValue('reflectLearned', existing.learned || '');
    setValue('reflectWrong', existing.wrong || '');
    setValue('reflectImprove', existing.improve || '');
    setValue('reflectTomorrow', existing.tomorrow || '');
  }

  renderPastReflections();
}

function renderPastReflections() {
  const container = document.getElementById('pastReflections');
  if (!container) return;
  const past = [...STATE.reflections].reverse().slice(0, 7);
  if (!past.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = '<h3>Past Reflections</h3>';
  past.forEach(r => {
    const div = document.createElement('div');
    div.className = 'reflection-entry';
    div.innerHTML = `
      <button class="reflection-delete" data-id="${r.id}">✕</button>
      <div class="reflection-entry-date">📅 ${formatDate(r.date)}</div>
      <div class="reflection-entry-preview">
        ${r.completed ? `<strong>✅ Completed:</strong> ${escHtml(r.completed.slice(0, 80))}${r.completed.length > 80 ? '...' : ''}` : ''}
        ${r.tomorrow ? `<br><strong>🎯 Tomorrow:</strong> ${escHtml(r.tomorrow.slice(0, 80))}` : ''}
      </div>
    `;
    container.appendChild(div);
  });
}

function initEvening() {
  document.getElementById('saveReflectionBtn')?.addEventListener('click', () => {
    const today = todayStr();
    const completed = document.getElementById('reflectCompleted')?.value.trim();
    const learned = document.getElementById('reflectLearned')?.value.trim();
    const wrong = document.getElementById('reflectWrong')?.value.trim();
    const improve = document.getElementById('reflectImprove')?.value.trim();
    const tomorrow = document.getElementById('reflectTomorrow')?.value.trim();

    if (!completed && !learned && !wrong && !improve && !tomorrow) {
      alert('Please fill in at least one field.');
      return;
    }

    // Remove existing entry for today and replace
    STATE.reflections = STATE.reflections.filter(r => r.date !== today);
    STATE.reflections.push({ id: uid(), date: today, completed, learned, wrong, improve, tomorrow });
    awardXP(15, 'Evening reflection');
    persist();
    renderPastReflections();
    showXPToast('Reflection saved! +15 XP');
  });

  document.getElementById('pastReflections')?.addEventListener('click', e => {
    const del = e.target.closest('.reflection-delete');
    if (del) {
      STATE.reflections = STATE.reflections.filter(r => r.id !== del.dataset.id);
      persist();
      renderPastReflections();
    }
  });
}

/* =====================================================
   19. ANALYTICS
   ===================================================== */

function renderAnalytics() {
  const days = last7Days();

  // Habit completion chart
  renderBarChart('habitChart', days, day => {
    const total = STATE.habits.length;
    if (!total) return 0;
    const done = STATE.habits.filter(h => h.history && h.history[day]).length;
    return Math.round((done / total) * 100);
  }, '%');

  // XP history chart
  const maxXP = Math.max(...days.map(d => STATE.xpHistory[d] || 0), 1);
  renderBarChart('xpChart', days, day => {
    return STATE.xpHistory[day] || 0;
  }, ' XP', maxXP);

  // Skills analytics
  renderSkillsAnalytics();

  // Productivity score
  const score = calcProductivityScore();
  setText('productivityScore', score);

  // Streak dots
  renderStreakDots(days);
}

function renderBarChart(containerId, days, valueFn, suffix, maxOverride = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const values = days.map(valueFn);
  const max = maxOverride || Math.max(...values, 1);

  days.forEach((day, i) => {
    const val = values[i];
    const heightPct = Math.max(4, Math.round((val / max) * 100));
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = `
      <span class="bar-val">${val}${suffix}</span>
      <div class="bar-fill-wrap">
        <div class="bar-fill" style="height:${heightPct}%"></div>
      </div>
      <span class="bar-label">${dayLabel(day)}</span>
    `;
    container.appendChild(col);
  });
}

function renderSkillsAnalytics() {
  const container = document.getElementById('skillsAnalytics');
  if (!container) return;
  container.innerHTML = '';

  if (!STATE.skills.length) {
    container.innerHTML = '<p style="color:var(--text3);font-size:0.85rem">No skills added yet.</p>';
    return;
  }

  const maxDays = Math.max(...STATE.skills.map(s => s.days || 0), 1);
  STATE.skills.forEach(s => {
    const pct = Math.min(100, Math.round(((s.days || 0) / Math.max(maxDays, 200)) * 100));
    const row = document.createElement('div');
    row.className = 'skill-analytics-row';
    row.innerHTML = `
      <span class="skill-analytics-name">${s.emoji || '⚔️'} ${escHtml(s.name)}</span>
      <div class="skill-analytics-bar-wrap">
        <div class="skill-analytics-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="skill-analytics-pct">${s.days || 0}d</span>
    `;
    container.appendChild(row);
  });
}

function calcProductivityScore() {
  const today = todayStr();
  let score = 0;
  const max = 100;

  // Habits (up to 30pts)
  const totalHabits = STATE.habits.length;
  if (totalHabits > 0) {
    const doneHabits = STATE.habits.filter(h => h.history && h.history[today]).length;
    score += Math.round((doneHabits / totalHabits) * 30);
  }

  // Morning routine (up to 20pts)
  const totalRoutines = STATE.morning.routines.length;
  if (totalRoutines > 0) {
    const doneRoutines = STATE.morning.routines.filter(r => r.completed).length;
    score += Math.round((doneRoutines / totalRoutines) * 20);
  }

  // Tasks (up to 20pts)
  const totalTasks = STATE.focus.tasks.length;
  if (totalTasks > 0) {
    const doneTasks = STATE.focus.tasks.filter(t => t.done).length;
    score += Math.round((doneTasks / totalTasks) * 20);
  }

  // Skills practiced today (up to 15pts)
  const skillsToday = STATE.skills.filter(s => s.history && s.history[today]).length;
  score += Math.min(15, skillsToday * 5);

  // TIL entry today (5pts)
  if (STATE.til.some(e => e.date === today)) score += 5;

  // Reflection (10pts)
  if (STATE.reflections.some(r => r.date === today)) score += 10;

  return Math.min(max, score);
}

function renderStreakDots(days) {
  const container = document.getElementById('streakDots');
  if (!container) return;
  container.innerHTML = '';
  days.forEach(day => {
    const active = STATE.streakHistory[day];
    const div = document.createElement('div');
    div.className = `streak-dot-day${active ? ' active' : ''}`;
    div.innerHTML = `
      ${active ? '<span class="dot-fire">🔥</span>' : ''}
      <span>${dayLabel(day)}</span>
    `;
    container.appendChild(div);
  });
}

/* =====================================================
   20. UTILITIES
   ===================================================== */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setStyle(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = val;
}

/* =====================================================
   21. RESET DAILY DATA
   Resets morning routines + focus tasks each new day
   ===================================================== */

function resetDailyIfNewDay() {
  const today = todayStr();
  const lastReset = STATE.lastReset || '';
  if (lastReset === today) return;
  STATE.lastReset = today;

  // Reset morning routine completions
  STATE.morning.routines.forEach(r => { r.completed = false; });

  // Clear completed focus tasks for fresh day
  STATE.focus.tasks = STATE.focus.tasks.filter(t => !t.done);

  // Reset main goal (keep priorities)
  // STATE.focus.mainGoal = ''; // optionally clear

  persist();
}

/* =====================================================
   22. INIT
   ===================================================== */

function init() {
  checkAndUpdateStreak();
  resetDailyIfNewDay();

  initTheme();
  initNav();
  startClock();

  // Section inits
  initMorning();
  initFocus();
  initHabits();
  initSkills();
  initTIL();
  initProjects();
  initIdeas();
  initMissions();
  initEvening();

  // Quote refresh
  document.getElementById('quoteRefresh')?.addEventListener('click', nextQuote);

  // Initial render — Dashboard
  navigateTo('dashboard');
  renderDashboard();

  console.log('✅ Student Life OS loaded. State:', STATE);
}

document.addEventListener('DOMContentLoaded', init);
