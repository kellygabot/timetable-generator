// ═══════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════
const state = {
  school: {
    name: "",
    year: "",
    semester: "1st Semester",
    numDays: 5,
    periodsPerDay: 8,
    startTime: "07:00",
    numBreaks: 2,
    breaks: [
      { afterPeriod: 3, duration: 15 },
      { afterPeriod: 6, duration: 50 },
    ],
  },
  gradeLevels: [], // [{id,level,label,color,breaks:[{afterPeriod,duration}],sections:[{id,name,subjects:[{code,name,periodsPerWeek,durationMinutes,teacherId,color}]}]}]
  teachers: [], // [{id,name,dept,maxPeriods}]
  constraints: {
    noTeacherConflict: true,
    allPeriodsPlaced: true,
    noBackToBack: true,
    maxConsec: true,
    balance: true,
    morningCore: true,
    afternoonPE: true,
    minTeacherIdle: true,
  },
  results: null,
  currentAlgo: "ga",
  fitnessHistory: [],
  frozen: {}, // {classId: {'d_p': true}} — frozen slots
};
let selectedClassId = null;
let resultViewClass = null;
let dayViewMode = "week";
let resultViewDay = 0;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS_S = ["MON", "TUE", "WED", "THU", "FRI"];
const GRADE_COLORS = {
  7: "#d94f1e",
  8: "#2e8a5a",
  9: "#5c3fa0",
  10: "#c48010",
  11: "#c02020",
  12: "#8c1e5a",
};
let colorCounter = 0;

// ═══════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════
function showPanel(name) {
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById("panel-" + name).classList.add("active");
  const items = document.querySelectorAll(".nav-item");
  const labels = [
    "school",
    "import",
    "teachers",
    "classes",
    "constraints",
    "generate",
    "conflicts",
    "results",
    "teacher-view",
  ];
  const idx = labels.indexOf(name);
  if (idx >= 0) items[idx].classList.add("active");
  if (name === "teachers") {
    renderTeacherTable();
    drawTeacherLoadChart();
  }
  if (name === "classes") renderClassPicker();
  if (name === "constraints") renderConstraints();
  if (name === "conflicts") renderConflictsPanel();
  if (name === "results") {
    renderResultNav();
    renderResultView();
  }
  if (name === "teacher-view") {
    renderTeacherSelect();
    renderTeacherView();
  }
}

// ═══════════════════════════════════════════════════════
// SCHOOL SETUP
// ═══════════════════════════════════════════════════════
document.getElementById("numBreaks").addEventListener("input", renderBreaks);
document
  .getElementById("periodsPerDay")
  .addEventListener("input", updateSchoolPreview);
document
  .getElementById("numDays")
  .addEventListener("change", updateSchoolPreview);
document
  .getElementById("startTime")
  .addEventListener("change", updateSchoolPreview);

function renderBreaks() {
  const n = parseInt(document.getElementById("numBreaks").value);
  state.school.numBreaks = n;
  // Ensure breaks array has right length
  while (state.school.breaks.length < n)
    state.school.breaks.push({
      afterPeriod: state.school.breaks.length + 1,
      duration: 15,
    });
  state.school.breaks = state.school.breaks.slice(0, n);
  const periods = parseInt(document.getElementById("periodsPerDay").value);
  const c = document.getElementById("break-config");
  c.innerHTML = "";
  if (n === 0) return;
  let html = "";
  for (let i = 0; i < n; i++) {
    const defaultAfter =
      state.school.breaks[i]?.afterPeriod ||
      Math.round(((i + 1) * periods) / (n + 1));
    const defaultDur = state.school.breaks[i]?.duration || 15;
    html += `<div class="break-row" style="margin-bottom:10px;padding:10px;background:var(--s3);border-radius:var(--r-sm);border:1px solid var(--border)">
      <div style="font-size:11px;font-family:var(--mono);color:var(--accent);min-width:60px">Break ${i + 1}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1">
        <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">After Period #</label>
          <input type="number" class="ba-p" data-idx="${i}" min="1" max="${periods - 1}" value="${defaultAfter}" oninput="syncBreaks()"></div>
        <div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Duration (min)</label>
          <input type="number" class="ba-d" data-idx="${i}" min="5" max="120" value="${defaultDur}" oninput="syncBreaks()"></div>
      </div>
    </div>`;
  }
  c.innerHTML = html;
}

function syncBreaks() {
  const ps = document.querySelectorAll(".ba-p");
  const ds = document.querySelectorAll(".ba-d");
  state.school.breaks = Array.from(ps).map((p, i) => ({
    afterPeriod: parseInt(p.value) || 1,
    duration: parseInt(ds[i]?.value) || 15,
  }));
  // Sync template to all grade levels that still have default breaks
  state.gradeLevels.forEach((g) => {
    if (!g._customBreaks) g.breaks = state.school.breaks.map((b) => ({ ...b }));
  });
}

function updateSchoolPreview() {
  state.school.numDays = parseInt(document.getElementById("numDays").value);
  state.school.periodsPerDay = parseInt(
    document.getElementById("periodsPerDay").value,
  );
  state.school.startTime =
    document.getElementById("startTime").value || "07:00";

  const d = state.school;
  const totalBreakMins = d.breaks.reduce((a, b) => a + b.duration, 0);
  const sl = d.numDays * d.periodsPerDay;
  const totalClasses = state.gradeLevels.reduce(
    (a, g) => a + g.sections.length,
    0,
  );

  document.getElementById("school-preview").innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;">
      ${kv("Days", DAYS.slice(0, d.numDays).join(", "))}
      ${kv("Periods / Day", d.periodsPerDay)}
      ${kv("Subject Duration", "Set per subject")}
      ${kv("Breaks / Day", d.breaks.length + " · " + d.breaks.map((b, i) => `Break ${i + 1}: ${b.duration}min`).join(", "))}
      ${kv("Slots / Week", sl)}
      ${kv("Start Time", d.startTime)}
      ${kv("Grade Levels", state.gradeLevels.length)}
      ${kv("Total Classes", totalClasses)}
    </div>`;
  updateTopChips();
}

function kv(k, v) {
  return `<div style="color:var(--text3);font-size:11px">${k}</div><div style="font-size:13px;font-weight:500">${v}</div>`;
}

function updateTopChips() {
  const tc = state.gradeLevels.reduce((a, g) => a + g.sections.length, 0);
  document.getElementById("chip-classes").textContent = tc + " classes";
  document.getElementById("chip-teachers").textContent =
    state.teachers.length + " teachers";
  document.getElementById("nb-teachers").textContent = state.teachers.length;
  document.getElementById("nb-classes").textContent = tc;
}

// Grade level UI
function renderGradeLevelManager() {
  const el = document.getElementById("grade-level-manager");
  if (state.gradeLevels.length === 0) {
    el.innerHTML =
      '<div style="color:var(--text3);font-size:13px;padding:8px 0">No grade levels added. Click + Add Grade Level.</div>';
  } else {
    el.innerHTML = state.gradeLevels
      .map((g) => {
        const breaks = g.breaks || [];
        return `
      <div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:${breaks.length ? "10px" : "0"}">
          <div style="width:8px;height:8px;border-radius:50%;background:${g.color};flex-shrink:0"></div>
          <div style="flex:1;font-size:13px;font-weight:500">${g.label}</div>
          <div style="font-size:12px;color:var(--text2)">${g.sections.length} section${g.sections.length !== 1 ? "s" : ""}</div>
          <button class="btn btn-secondary btn-sm" onclick="editGradeBreaks('${g.id}')">⏱ Breaks</button>
          <button class="btn btn-danger btn-sm" onclick="removeGrade('${g.id}')">✕</button>
        </div>
        <div id="grade-breaks-${g.id}" style="display:none" class="grade-break-panel">
          <div class="grade-break-title">Break Schedule — ${g.label}</div>
          <div id="grade-breaks-rows-${g.id}">
            ${renderGradeBreakRows(g)}
          </div>
          <div style="margin-top:8px;display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm" onclick="addGradeBreak('${g.id}')">+ Break</button>
            <button class="btn btn-danger btn-sm" onclick="removeLastGradeBreak('${g.id}')">− Remove</button>
          </div>
        </div>
      </div>`;
      })
      .join("");
  }
  renderGradeChips();
  renderClassPicker();
  updateSchoolPreview();
}

function renderGradeBreakRows(g) {
  if (!g.breaks || g.breaks.length === 0)
    return '<div style="font-size:12px;color:var(--text3)">No breaks configured</div>';
  const periods = state.school.periodsPerDay;
  return g.breaks
    .map(
      (b, i) => `
    <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:8px;align-items:center;margin-bottom:6px">
      <div style="font-family:var(--mono);font-size:11px;color:var(--accent);min-width:56px">Break ${i + 1}</div>
      <div>
        <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:2px">After Period #</label>
        <input type="number" min="1" max="${periods - 1}" value="${b.afterPeriod}" style="width:100%"
          oninput="updateGradeBreak('${g.id}',${i},'afterPeriod',this.value)">
      </div>
      <div>
        <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:2px">Duration (min)</label>
        <input type="number" min="5" max="120" value="${b.duration}" style="width:100%"
          oninput="updateGradeBreak('${g.id}',${i},'duration',this.value)">
      </div>
    </div>`,
    )
    .join("");
}

function editGradeBreaks(gid) {
  const panel = document.getElementById("grade-breaks-" + gid);
  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

function updateGradeBreak(gid, idx, field, val) {
  const g = state.gradeLevels.find((g) => g.id === gid);
  if (!g || !g.breaks[idx]) return;
  g.breaks[idx][field] = parseInt(val) || 0;
  g._customBreaks = true;
}

function addGradeBreak(gid) {
  const g = state.gradeLevels.find((g) => g.id === gid);
  if (!g) return;
  const periods = state.school.periodsPerDay;
  g.breaks = g.breaks || [];
  g.breaks.push({
    afterPeriod: Math.min(
      periods - 1,
      (g.breaks[g.breaks.length - 1]?.afterPeriod || 3) + 2,
    ),
    duration: 15,
  });
  g._customBreaks = true;
  document.getElementById("grade-breaks-rows-" + gid).innerHTML =
    renderGradeBreakRows(g);
}

function removeLastGradeBreak(gid) {
  const g = state.gradeLevels.find((g) => g.id === gid);
  if (!g || !g.breaks.length) return;
  g.breaks.pop();
  g._customBreaks = true;
  document.getElementById("grade-breaks-rows-" + gid).innerHTML =
    renderGradeBreakRows(g);
}

function renderGradeChips() {
  document.getElementById("grade-chips").innerHTML = state.gradeLevels
    .map(
      (g) =>
        `<span class="chip" style="background:${g.color}22;color:${g.color};border:1px solid ${g.color}44">${g.label}</span>`,
    )
    .join("");
}

function addGradeModal() {
  document.getElementById("gradeModal").classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
document.getElementById("gm-naming").addEventListener("change", function () {
  document.getElementById("gm-prefix-field").style.display =
    this.value === "custom" ? "block" : "none";
});

function confirmAddGrade() {
  const level = parseInt(document.getElementById("gm-level").value);
  const existing = state.gradeLevels.find((g) => g.level === level);
  if (existing) {
    alert("Grade " + level + " already exists.");
    return;
  }
  const numSections =
    parseInt(document.getElementById("gm-sections").value) || 1;
  const naming = document.getElementById("gm-naming").value;
  const prefix = document.getElementById("gm-prefix").value.trim();
  const sections = [];
  for (let i = 0; i < numSections; i++) {
    let name;
    if (naming === "alpha") name = "Section " + String.fromCharCode(65 + i);
    else if (naming === "num") name = "Section " + (i + 1);
    else {
      const customs = [
        "Rizal",
        "Bonifacio",
        "Mabini",
        "Luna",
        "Aguinaldo",
        "Silang",
      ];
      name = prefix || customs[i] || "Section " + (i + 1);
    }
    sections.push({
      id: "g" + level + "s" + i + "_" + Date.now(),
      name,
      subjects: [],
    });
  }
  const color = GRADE_COLORS[level] || "#888";
  // Copy global break template for this grade
  const gradeBreaks = state.school.breaks.map((b) => ({ ...b }));
  state.gradeLevels.push({
    id: "g" + level,
    level,
    label: "Grade " + level,
    color,
    breaks: gradeBreaks,
    _customBreaks: false,
    sections,
  });
  state.gradeLevels.sort((a, b) => a.level - b.level);
  closeModal("gradeModal");
  renderGradeLevelManager();
}

function removeGrade(id) {
  if (!confirm("Remove this grade level and all its sections?")) return;
  state.gradeLevels = state.gradeLevels.filter((g) => g.id !== id);
  renderGradeLevelManager();
}

// ADD SECTION MODAL
function addSectionModal() {
  const sel = document.getElementById("sm-grade");
  sel.innerHTML = state.gradeLevels
    .map((g) => `<option value="${g.id}">${g.label}</option>`)
    .join("");
  document.getElementById("sectionModal").classList.add("open");
}
function confirmAddSection() {
  const gid = document.getElementById("sm-grade").value;
  const name = document.getElementById("sm-name").value.trim();
  if (!name) return;
  const g = state.gradeLevels.find((g) => g.id === gid);
  if (!g) return;
  g.sections.push({ id: "sect_" + Date.now(), name, subjects: [] });
  closeModal("sectionModal");
  renderGradeLevelManager();
}

// ═══════════════════════════════════════════════════════
// TEACHERS
// ═══════════════════════════════════════════════════════
function addTeacher() {
  const id = document.getElementById("t-id").value.trim();
  const name = document.getElementById("t-name").value.trim();
  const dept = document.getElementById("t-dept").value.trim();
  const maxP = parseInt(document.getElementById("t-maxp").value) || 25;
  if (!id || !name) {
    alert("Teacher ID and Name are required.");
    return;
  }
  if (state.teachers.find((t) => t.id === id)) {
    alert("Teacher ID already exists.");
    return;
  }
  state.teachers.push({ id, name, dept, maxPeriods: maxP, unavailability: [] });
  ["t-id", "t-name", "t-dept"].forEach(
    (i) => (document.getElementById(i).value = ""),
  );
  document.getElementById("t-maxp").value = 25;
  renderTeacherTable();
  drawTeacherLoadChart();
  updateTopChips();
}

function removeTeacher(id) {
  state.teachers = state.teachers.filter((t) => t.id !== id);
  renderTeacherTable();
  drawTeacherLoadChart();
  updateTopChips();
}

// ═══════════════════════════════════════════════════════
// TEACHER AVAILABILITY
// ═══════════════════════════════════════════════════════
let editingTeacherId = null;
let pendingBlocks = [];

function openAvailModal(tid) {
  editingTeacherId = tid;
  const t = state.teachers.find((t) => t.id === tid);
  if (!t) return;
  document.getElementById("availModalTitle").textContent =
    `Availability — ${t.name}`;
  pendingBlocks = (t.unavailability || []).map((b) => ({
    ...b,
    days: [...b.days],
  }));
  renderAvailBlocks();
  document.getElementById("availModal").classList.add("open");
}

function renderAvailBlocks() {
  const container = document.getElementById("availBlocks");
  const empty = document.getElementById("availEmpty");
  if (pendingBlocks.length === 0) {
    container.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  container.innerHTML = pendingBlocks
    .map(
      (b, i) => `
    <div class="avail-block">
      <div>
        <label>Type</label>
        <select onchange="pendingBlocks[${i}].type=this.value" style="width:100%">
          <option value="unavailable" ${b.type === "unavailable" ? "selected" : ""}>🚫 Not available</option>
          <option value="preferred_off" ${b.type === "preferred_off" ? "selected" : ""}>😓 Prefers not to teach</option>
        </select>
      </div>
      <div>
        <label>From</label>
        <input type="time" value="${b.fromTime}" onchange="pendingBlocks[${i}].fromTime=this.value" style="width:100%">
      </div>
      <div>
        <label>To</label>
        <input type="time" value="${b.toTime}" onchange="pendingBlocks[${i}].toTime=this.value" style="width:100%">
      </div>
      <div style="align-self:end">
        <button class="btn btn-danger btn-sm" onclick="removeAvailBlock(${i})">✕</button>
      </div>
      <div style="grid-column:1/-1">
        <label>Days</label>
        <div class="day-check-row">
          ${dayNames
            .map(
              (d, di) => `
            <input type="checkbox" class="day-check" id="dc_${i}_${di}" ${b.days.includes(di) ? "checked" : ""}
              onchange="toggleDay(${i},${di},this.checked)">
            <label for="dc_${i}_${di}">${d}</label>
          `,
            )
            .join("")}
        </div>
      </div>
    </div>`,
    )
    .join("");
}

function addAvailBlock() {
  pendingBlocks.push({
    type: "unavailable",
    days: [0, 1, 2, 3, 4],
    fromTime: "08:00",
    toTime: "11:00",
  });
  renderAvailBlocks();
}

function removeAvailBlock(i) {
  pendingBlocks.splice(i, 1);
  renderAvailBlocks();
}

function toggleDay(blockIdx, dayIdx, checked) {
  const b = pendingBlocks[blockIdx];
  if (checked) {
    if (!b.days.includes(dayIdx)) b.days.push(dayIdx);
  } else {
    b.days = b.days.filter((d) => d !== dayIdx);
  }
}

function saveAvailability() {
  const t = state.teachers.find((t) => t.id === editingTeacherId);
  if (!t) return;
  // Validate: toTime must be after fromTime
  for (const b of pendingBlocks) {
    if (t2m(b.toTime) <= t2m(b.fromTime)) {
      alert(`Block invalid: "To" time must be after "From" time.`);
      return;
    }
    if (b.days.length === 0) {
      alert(`Each block must have at least one day selected.`);
      return;
    }
  }
  t.unavailability = pendingBlocks.map((b) => ({ ...b, days: [...b.days] }));
  closeModal("availModal");
  renderTeacherTable();
}

function getTeacherLoad(tid) {
  let total = 0;
  state.gradeLevels.forEach((g) =>
    g.sections.forEach((s) =>
      s.subjects.forEach((sub) => {
        if (sub.teacherId === tid) total += sub.periodsPerWeek;
      }),
    ),
  );
  return total;
}

function renderTeacherTable() {
  const tbody = document.getElementById("teacherTbody");
  if (state.teachers.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:30px">No teachers added yet</td></tr>';
    return;
  }
  tbody.innerHTML = state.teachers
    .map((t) => {
      const load = getTeacherLoad(t.id);
      const pct = Math.round((load / t.maxPeriods) * 100);
      const pctColor =
        pct > 90
          ? "var(--accent-r)"
          : pct > 70
            ? "var(--accent-y)"
            : "var(--accent-g)";
      const blocks = t.unavailability || [];
      const availCell =
        blocks.length === 0
          ? `<span style="font-size:11px;color:var(--text3)">Always available</span>
         <button class="btn btn-secondary btn-sm" style="margin-left:6px;padding:2px 8px;font-size:10px" onclick="openAvailModal('${t.id}')">+ Set</button>`
          : `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          ${blocks.map((b) => `<span class="avail-tag" title="${formatAvailBlock(b)}">${formatAvailBlockShort(b)}</span>`).join("")}
          <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:10px" onclick="openAvailModal('${t.id}')">✏</button>
         </div>`;
      return `<tr>
      <td><span style="font-family:var(--mono);font-size:12px;color:var(--accent)">${t.id}</span></td>
      <td style="font-weight:500">${t.name}</td>
      <td style="color:var(--text2)">${t.dept || "—"}</td>
      <td style="font-family:var(--mono)">${t.maxPeriods}</td>
      <td style="font-family:var(--mono)">${load}</td>
      <td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:4px;background:var(--border2);border-radius:2px;overflow:hidden"><div style="width:${Math.min(100, pct)}%;height:100%;background:${pctColor}"></div></div><span style="font-family:var(--mono);font-size:11px;color:${pctColor}">${pct}%</span></div></td>
      <td>${availCell}</td>
      <td><button class="btn btn-danger" onclick="removeTeacher('${t.id}')">✕</button></td>
    </tr>`;
    })
    .join("");
}

function formatAvailBlock(b) {
  const dayStr =
    b.days && b.days.length < 5
      ? b.days.map((d) => ["Mon", "Tue", "Wed", "Thu", "Fri"][d]).join(",")
      : "Every day";
  return `${b.type === "unavailable" ? "Unavailable" : "Preferred off"}: ${dayStr} ${b.fromTime}–${b.toTime}`;
}

function formatAvailBlockShort(b) {
  const dayStr =
    b.days && b.days.length < 5
      ? b.days.map((d) => ["M", "T", "W", "Th", "F"][d]).join("")
      : "Daily";
  return `🚫 ${dayStr} ${b.fromTime}–${b.toTime}`;
}

function drawTeacherLoadChart() {
  const canvas = document.getElementById("teacherLoadChart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = 160 * dpr;
  ctx.scale(dpr, dpr);
  const W = canvas.offsetWidth,
    H = 160;
  ctx.clearRect(0, 0, W, H);
  if (state.teachers.length === 0) {
    ctx.fillStyle = "var(--text3)";
    ctx.font = "12px DM Sans";
    ctx.textAlign = "center";
    ctx.fillText("Add teachers to see load chart", W / 2, H / 2);
    return;
  }
  const colors = [
    "#d94f1e",
    "#2e8a5a",
    "#5c3fa0",
    "#c48010",
    "#c02020",
    "#146478",
    "#c02020",
    "#325a1e",
  ];
  const pad = { l: 6, r: 6, t: 16, b: 24 };
  const bw = Math.min(40, (W - pad.l - pad.r) / state.teachers.length - 6);
  const gap = (W - pad.l - pad.r) / state.teachers.length;
  const maxH = H - pad.t - pad.b;
  state.teachers.forEach((t, i) => {
    const load = getTeacherLoad(t.id),
      pct = load / t.maxPeriods;
    const bh = pct * maxH;
    const x = pad.l + i * gap + gap / 2 - bw / 2;
    const y = pad.t + maxH - bh;
    const c =
      pct > 0.9 ? "#c02020" : pct > 0.7 ? "#c48010" : colors[i % colors.length];
    ctx.fillStyle = c + "33";
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c;
    ctx.font = "600 10px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.fillText(load, x + bw / 2, y - 3);
    ctx.fillStyle = "#6b5f52";
    ctx.font = "10px Raleway";
    const lbl = t.id.length > 6 ? t.id.slice(0, 5) + "…" : t.id;
    ctx.fillText(lbl, x + bw / 2, H - 6);
  });
}

// ═══════════════════════════════════════════════════════
// CLASSES
// ═══════════════════════════════════════════════════════
function renderClassPicker() {
  const el = document.getElementById("classPicker");
  if (state.gradeLevels.length === 0) {
    el.innerHTML =
      '<div style="padding:16px;color:var(--text3);font-size:13px">Add grade levels in School Setup first</div>';
    return;
  }
  el.innerHTML = state.gradeLevels
    .map(
      (g) => `
    <div class="cp-grade">
      <div class="cp-grade-label"><div class="gdot" style="background:${g.color}"></div>${g.label}</div>
      ${g.sections
        .map(
          (s) => `
        <div class="cp-section ${selectedClassId === s.id ? "active" : ""}" onclick="selectClass('${s.id}')">
          <span>${s.name}</span>
          <span class="sbadge" style="color:${g.color}">${s.subjects.length}</span>
        </div>`,
        )
        .join("")}
    </div>`,
    )
    .join("");
}

function selectClass(id) {
  selectedClassId = id;
  renderClassPicker();
  renderClassEditor();
}

function findClass(id) {
  for (const g of state.gradeLevels)
    for (const s of g.sections)
      if (s.id === id) return { grade: g, section: s };
  return null;
}

function renderClassEditor() {
  const el = document.getElementById("classEditor");
  if (!selectedClassId) {
    el.innerHTML =
      '<div class="empty-state"><div class="ei">📚</div><p>Select a class</p></div>';
    return;
  }
  const found = findClass(selectedClassId);
  if (!found) return;
  const { grade: g, section: s } = found;

  el.innerHTML = `
    <div class="card fade-up">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <div style="font-family:var(--head);font-size:16px;font-weight:700">${g.label} — ${s.name}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">${s.subjects.length} subjects · ${s.subjects.reduce((a, b) => a + b.periodsPerWeek, 0)} periods/week</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="copySubjectsModal()">⎘ Copy from…</button>
      </div>
      <div class="card-title">Add Subject</div>
      <div class="g2" style="margin-bottom:10px">
        <div class="field"><label>Subject Code</label><input type="text" id="e-code" placeholder="e.g. MATH10" style="text-transform:uppercase"></div>
        <div class="field"><label>Subject Name</label><input type="text" id="e-name" placeholder="e.g. Algebra I"></div>
        <div class="field"><label>Sessions / Week</label><input type="number" id="e-pw" min="1" max="10" value="5"></div>
        <div class="field"><label>Duration per Session (min)</label><input type="number" id="e-dur" min="15" max="180" value="50" placeholder="50"></div>
        <div class="field"><label>Assign Teacher</label>
          <select id="e-teacher">
            <option value="">— Select Teacher —</option>
            ${state.teachers.map((t) => `<option value="${t.id}">${t.name} (${t.id})</option>`).join("")}
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="addSubjectToClass()">+ Add Subject</button>
    </div>

    <div class="card fade-up" style="animation-delay:.05s">
      <div class="card-title">Subjects <span style="color:var(--text3);margin-left:6px">${s.subjects.length} total</span></div>
      <div style="display:flex;flex-direction:column;gap:8px" id="subjList">
        ${
          s.subjects.length === 0
            ? '<div style="color:var(--text3);font-size:13px;padding:8px 0">No subjects added yet</div>'
            : s.subjects
                .map(
                  (sub, i) => `
            <div class="subj-pill fade-up">
              <span class="subj-code sc${sub.color % 10}" style="padding:3px 8px;border-radius:4px">${sub.code}</span>
              <span class="subj-name">${sub.name}</span>
              <span class="subj-meta">${sub.periodsPerWeek}×/wk</span>
              <span class="subj-meta">${sub.durationMinutes || 50}min</span>
              <span class="subj-meta">${teacherName(sub.teacherId)}</span>
              <button class="btn btn-danger" onclick="removeSubjectFromClass(${i})">✕</button>
            </div>`,
                )
                .join("")
        }
      </div>
    </div>`;
}

function teacherName(tid) {
  const t = state.teachers.find((t) => t.id === tid);
  return t ? t.name : tid || "Unassigned";
}

function addSubjectToClass() {
  if (!selectedClassId) return;
  const code = document.getElementById("e-code").value.trim().toUpperCase();
  const name = document.getElementById("e-name").value.trim();
  const pw = parseInt(document.getElementById("e-pw").value) || 1;
  const dur = parseInt(document.getElementById("e-dur").value) || 50;
  const tid = document.getElementById("e-teacher").value;
  if (!code || !name) {
    alert("Code and name required");
    return;
  }
  const found = findClass(selectedClassId);
  if (!found) return;
  const { section: s } = found;
  if (s.subjects.find((sub) => sub.code === code)) {
    alert("Subject code already exists in this class");
    return;
  }
  s.subjects.push({
    code,
    name,
    periodsPerWeek: pw,
    durationMinutes: dur,
    teacherId: tid,
    color: colorCounter++ % 10,
  });
  renderClassEditor();
  renderClassPicker();
  renderTeacherTable();
  drawTeacherLoadChart();
}

function removeSubjectFromClass(idx) {
  const found = findClass(selectedClassId);
  if (!found) return;
  found.section.subjects.splice(idx, 1);
  renderClassEditor();
  renderClassPicker();
  renderTeacherTable();
  drawTeacherLoadChart();
}

function copySubjectsModal() {
  const choices = [];
  state.gradeLevels.forEach((g) =>
    g.sections.forEach((s) => {
      if (s.id !== selectedClassId && s.subjects.length > 0)
        choices.push({
          id: s.id,
          label: `${g.label} – ${s.name} (${s.subjects.length} subjects)`,
        });
    }),
  );
  if (choices.length === 0) {
    alert("No other classes with subjects available.");
    return;
  }
  const sel = choices
    .map((c) => `<option value="${c.id}">${c.label}</option>`)
    .join("");
  const from = prompt(
    "Paste the class ID to copy from (this will overwrite subjects):\n" +
      choices.map((c) => c.id + ": " + c.label).join("\n"),
  );
  if (!from) return;
  const src = choices.find((c) => c.id === from);
  if (!src) {
    alert("Invalid ID");
    return;
  }
  const srcClass = findClass(from);
  const dst = findClass(selectedClassId);
  if (!srcClass || !dst) return;
  dst.section.subjects = srcClass.section.subjects.map((s) => ({ ...s }));
  renderClassEditor();
}

// ═══════════════════════════════════════════════════════
// CONSTRAINTS UI
// ═══════════════════════════════════════════════════════
const HARD_CONSTRAINTS = [
  {
    id: "noTeacherConflict",
    name: "No Teacher Conflicts",
    desc: "A teacher cannot be assigned to two classes in the same period (enforced across ALL classes)",
  },
  {
    id: "allPeriodsPlaced",
    name: "All Periods Scheduled",
    desc: "Every required period per week for each subject must be placed",
  },
  {
    id: "noBackToBack",
    name: "No Back-to-Back Same Subject",
    desc: "Same subject cannot appear in consecutive periods within a class",
  },
];
const SOFT_CONSTRAINTS = [
  {
    id: "maxConsec",
    name: "Max 3 Consecutive Classes",
    desc: "Students should not have more than 3 classes without a break",
  },
  {
    id: "balance",
    name: "Balance Across Days",
    desc: "Distribute each subject's periods evenly across the week",
  },
  {
    id: "morningCore",
    name: "Core Subjects in Morning",
    desc: "Maths, Science, Languages preferred in first 3 periods",
  },
  {
    id: "afternoonPE",
    name: "PE/Electives in Afternoon",
    desc: "Physical Education and elective subjects after midday",
  },
  {
    id: "minTeacherIdle",
    name: "Minimize Teacher Idle Time",
    desc: "Cluster a teacher's periods to reduce gaps in their schedule",
  },
];

function renderConstraints() {
  document.getElementById("hard-constraints").innerHTML = HARD_CONSTRAINTS.map(
    (c) => constraintRow(c, true),
  ).join("");
  document.getElementById("soft-constraints").innerHTML = SOFT_CONSTRAINTS.map(
    (c) => constraintRow(c, false),
  ).join("");
}

function constraintRow(c, hard) {
  const locked =
    hard && (c.id === "noTeacherConflict" || c.id === "allPeriodsPlaced");
  return `<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--border)">
    <div style="flex:1;padding-right:12px">
      <div style="font-size:13px;font-weight:500;margin-bottom:2px">${c.name}</div>
      <div style="font-size:11px;color:var(--text2)">${c.desc}</div>
    </div>
    <label class="toggle"><input type="checkbox" ${state.constraints[c.id] ? "checked" : ""} ${locked ? "disabled" : ""} onchange="state.constraints['${c.id}']=this.checked"><span class="tslider"></span></label>
  </div>`;
}

// ═══════════════════════════════════════════════════════
// ALGO SELECTION
// ═══════════════════════════════════════════════════════
function selAlgo(a) {
  state.currentAlgo = a;
  ["ga", "sa", "cp"].forEach((x) => {
    document.getElementById("algo-" + x).classList.toggle("sel", x === a);
    document.getElementById("params-" + x).style.display =
      x === a ? "block" : "none";
  });
}

// ═══════════════════════════════════════════════════════
// SCHEDULE GENERATION
// ═══════════════════════════════════════════════════════
// Schedule: dict of classId -> day[][period] -> subjectLocalIndex (index in section.subjects) or null
// All classes generated simultaneously to respect cross-class teacher conflicts

function getAllClasses() {
  const classes = [];
  state.gradeLevels.forEach((g) =>
    g.sections.forEach((s) => classes.push({ grade: g, section: s })),
  );
  return classes;
}

// buildTimeSlots: computes actual start/end times for a given day's schedule
// grade: grade level object (for per-grade breaks)
// daySchedule: array of subject indices for that day [si|null, ...]
// subjects: subjects array of the class
function buildTimeSlots(grade, daySchedule, subjects) {
  const { startTime, periodsPerDay } = state.school;
  const breaks = grade && grade.breaks ? grade.breaks : state.school.breaks;
  const slots = [];
  let time = t2m(startTime);
  const len = daySchedule ? daySchedule.length : periodsPerDay;

  for (let p = 0; p < len; p++) {
    const si = daySchedule ? daySchedule[p] : null;
    const sub =
      si !== null && si !== undefined && subjects && subjects[si]
        ? subjects[si]
        : null;
    const dur = sub ? sub.durationMinutes || 50 : 50;
    slots.push({
      period: p + 1,
      start: m2t(time),
      end: m2t(time + dur),
      isBreak: false,
      duration: dur,
    });
    time += dur;
    const brk = breaks.find((b) => b.afterPeriod === p + 1);
    if (brk) {
      const bLabel = brk.duration >= 30 ? "🍽 LUNCH" : "☕ BREAK";
      slots.push({
        period: null,
        start: m2t(time),
        end: m2t(time + brk.duration),
        isBreak: true,
        duration: brk.duration,
        label: bLabel,
      });
      time += brk.duration;
    }
  }
  return slots;
}

// Random schedule: for ALL classes
// ═══════════════════════════════════════════════════════
// FREEZE / UNFREEZE
// ═══════════════════════════════════════════════════════
function toggleFreeze(classId, d, p) {
  if (!state.results) return;
  if (!state.frozen[classId]) state.frozen[classId] = {};
  const key = `${d}_${p}`;
  if (state.frozen[classId][key]) {
    delete state.frozen[classId][key];
    if (Object.keys(state.frozen[classId]).length === 0)
      delete state.frozen[classId];
  } else {
    state.frozen[classId][key] = true;
  }
  updateFreezeUI();
  renderResultView(); // re-render to show updated freeze state
}

function countFrozen() {
  let total = 0;
  for (const cid of Object.keys(state.frozen))
    total += Object.keys(state.frozen[cid]).length;
  return total;
}

function updateFreezeUI() {
  const n = countFrozen();
  const bar = document.getElementById("freeze-bar");
  const label = document.getElementById("freeze-count-label");
  const rerollBtn = document.getElementById("rerollBtn");
  const clearBtn = document.getElementById("clearFreezeBtn");
  if (n > 0) {
    bar.style.display = "flex";
    label.textContent = `${n} frozen`;
    rerollBtn.style.display = "inline-flex";
    clearBtn.style.display = "inline-flex";
  } else {
    bar.style.display = "none";
    rerollBtn.style.display = "none";
    clearBtn.style.display = "none";
  }
}

function clearAllFrozen() {
  state.frozen = {};
  updateFreezeUI();
  renderResultView();
}

function isFrozen(classId, d, p) {
  return !!(state.frozen[classId] && state.frozen[classId][`${d}_${p}`]);
}

async function rerollUnfrozen() {
  if (!state.results) return;
  const classes = getAllClasses();
  if (classes.length === 0) return;

  const btn = document.getElementById("rerollBtn");
  btn.disabled = true;
  btn.textContent = "↻ Rerolling...";

  await sleep(20);

  let res;
  if (state.currentAlgo === "ga") res = runGA();
  else if (state.currentAlgo === "sa") res = runSA();
  else res = runCP();

  const hard = countHardViolations(res.sched);
  const soft = countSoftViolations(res.sched);
  state.results = {
    sched: res.sched,
    fitness: res.fitness,
    hard,
    soft,
    elapsed: 0,
  };

  document.getElementById("st-fit").textContent = res.fitness.toFixed(0);
  document.getElementById("st-hard").textContent = hard;
  document.getElementById("st-hard").style.color =
    hard === 0 ? "var(--accent-g)" : "var(--accent-r)";
  document.getElementById("st-soft").textContent = soft;
  updateConflictBadge();
  renderResultView();
  updateFreezeUI();

  btn.disabled = false;
  btn.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 3h9a3 3 0 0 1 0 6H4M1 3l3-2M1 3l3 2"/><path d="M13 11H4a3 3 0 0 1 0-6h6M13 11l-3-2M13 11l-3 2"/></svg> Reroll Unfrozen';
}

function randomMultiSchedule() {
  const classes = getAllClasses();
  const { numDays, periodsPerDay } = state.school;
  const sched = {};
  classes.forEach(({ section: s }) => {
    sched[s.id] = Array.from({ length: numDays }, () =>
      new Array(periodsPerDay).fill(null),
    );
    const fz = state.frozen[s.id] || {};
    // Lock frozen cells from existing results
    if (state.results?.sched?.[s.id]) {
      for (const key of Object.keys(fz)) {
        const [d, p] = key.split("_").map(Number);
        sched[s.id][d][p] = state.results.sched[s.id][d][p];
      }
    }
    // Count what still needs to be placed (excluding frozen)
    const placed = new Array(s.subjects.length).fill(0);
    for (let d = 0; d < numDays; d++)
      for (let p = 0; p < periodsPerDay; p++) {
        const si = sched[s.id][d][p];
        if (si !== null) placed[si] = (placed[si] || 0) + 1;
      }
    const toPlace = [];
    s.subjects.forEach((sub, si) => {
      const rem = sub.periodsPerWeek - (placed[si] || 0);
      for (let k = 0; k < rem; k++) toPlace.push(si);
    });
    shuffleArr(toPlace);
    let idx = 0;
    for (let d = 0; d < numDays && idx < toPlace.length; d++)
      for (let p = 0; p < periodsPerDay && idx < toPlace.length; p++) {
        if (sched[s.id][d][p] === null) sched[s.id][d][p] = toPlace[idx++];
      }
  });
  return sched;
}

function cloneMS(ms) {
  const c = {};
  for (const [k, v] of Object.entries(ms)) c[k] = v.map((d) => [...d]);
  return c;
}

function fitnessMS(ms) {
  const classes = getAllClasses();
  const { numDays, periodsPerDay } = state.school;
  const HW = parseInt(document.getElementById("hw").value) || 200;
  const SW = parseInt(document.getElementById("sw").value) || 15;
  let score = 5000;

  // Build teacher occupation: teacher_id -> day -> period -> [classId]
  const teacherSlots = {};
  state.teachers.forEach((t) => {
    teacherSlots[t.id] = Array.from({ length: numDays }, () =>
      new Array(periodsPerDay).fill(null),
    );
  });

  classes.forEach(({ grade: g, section: s }) => {
    const sch = ms[s.id];
    if (!sch) return;
    for (let d = 0; d < numDays; d++)
      for (let p = 0; p < periodsPerDay; p++) {
        const si = sch[d][p];
        if (si === null) continue;
        const sub = s.subjects[si];
        if (!sub) continue;
        const tid = sub.teacherId;
        if (!tid) continue;
        if (!teacherSlots[tid])
          teacherSlots[tid] = Array.from({ length: numDays }, () =>
            new Array(periodsPerDay).fill(null),
          );
        if (teacherSlots[tid][d][p] !== null)
          score -= HW; // HARD: teacher conflict
        else teacherSlots[tid][d][p] = s.id;
      }
  });

  // Soft: teacher availability — penalize periods scheduled during unavailable/preferred-off times
  classes.forEach(({ grade: g, section: s }) => {
    const sch = ms[s.id];
    if (!sch) return;
    // Compute period start times for this class's day schedule
    for (let d = 0; d < numDays; d++) {
      // Build period->startMinute map using the grade's break config
      const breaks = g && g.breaks ? g.breaks : state.school.breaks;
      let clock = t2m(state.school.startTime);
      const periodStart = [];
      for (let p = 0; p < periodsPerDay; p++) {
        periodStart.push(clock);
        const si = sch[d][p];
        const sub =
          si !== null && si !== undefined && s.subjects[si]
            ? s.subjects[si]
            : null;
        clock += sub ? sub.durationMinutes || 50 : 50;
        const brk = breaks.find((b) => b.afterPeriod === p + 1);
        if (brk) clock += brk.duration;
      }
      for (let p = 0; p < periodsPerDay; p++) {
        const si = sch[d][p];
        if (si === null) continue;
        const sub = s.subjects[si];
        if (!sub?.teacherId) continue;
        const teacher = state.teachers.find((t) => t.id === sub.teacherId);
        if (!teacher?.unavailability?.length) continue;
        const pStart = periodStart[p];
        const pEnd = pStart + (sub.durationMinutes || 50);
        for (const block of teacher.unavailability) {
          if (!block.days.includes(d)) continue;
          const bFrom = t2m(block.fromTime),
            bTo = t2m(block.toTime);
          // Check overlap: period overlaps with block if pStart < bTo && pEnd > bFrom
          if (pStart < bTo && pEnd > bFrom) {
            const penalty = block.type === "unavailable" ? SW * 3 : SW;
            score -= penalty;
          }
        }
      }
    }
  });

  classes.forEach(({ section: s }) => {
    const sch = ms[s.id];
    if (!sch) return;
    for (let d = 0; d < numDays; d++) {
      let consec = 0;
      for (let p = 0; p < periodsPerDay; p++) {
        const si = sch[d][p];
        const si2 = p < periodsPerDay - 1 ? sch[d][p + 1] : null;
        // Hard: back-to-back same
        if (state.constraints.noBackToBack && si !== null && si === si2)
          score -= HW;
        // Soft: max consecutive
        if (state.constraints.maxConsec) {
          if (si !== null) {
            consec++;
            if (consec > 3) score -= SW;
          } else consec = 0;
        }
        // Soft: morning core
        if (state.constraints.morningCore && p < 3 && si !== null) {
          const n = s.subjects[si]?.name.toLowerCase() || "";
          if (
            n.includes("math") ||
            n.includes("science") ||
            n.includes("sci") ||
            n.includes("english") ||
            n.includes("filipino")
          )
            score += SW;
        }
        // Soft: afternoon PE
        if (
          state.constraints.afternoonPE &&
          p >= Math.ceil(periodsPerDay * 0.6) &&
          si !== null
        ) {
          const n = s.subjects[si]?.name.toLowerCase() || "";
          if (
            n.includes("pe") ||
            n.includes("physical") ||
            n.includes("mapeh") ||
            n.includes("tle") ||
            n.includes("arts") ||
            n.includes("music")
          )
            score += SW;
        }
      }
    }
    // Soft: balance
    if (state.constraints.balance) {
      s.subjects.forEach((_, si) => {
        const perDay = Array(numDays).fill(0);
        for (let d = 0; d < numDays; d++)
          for (let p = 0; p < periodsPerDay; p++)
            if (sch[d][p] === si) perDay[d]++;
        const avg = s.subjects[si].periodsPerWeek / numDays;
        score -= perDay.reduce((a, v) => a + Math.abs(v - avg), 0) * SW * 0.5;
      });
    }
  });

  // Check all periods placed
  classes.forEach(({ section: s }) => {
    const sch = ms[s.id];
    if (!sch) return;
    s.subjects.forEach((sub, si) => {
      let placed = 0;
      for (let d = 0; d < numDays; d++)
        for (let p = 0; p < periodsPerDay; p++) if (sch[d][p] === si) placed++;
      if (placed < sub.periodsPerWeek)
        score -= HW * (sub.periodsPerWeek - placed);
    });
  });

  return score;
}

function repairMS(ms) {
  const classes = getAllClasses();
  const { numDays, periodsPerDay } = state.school;
  classes.forEach(({ section: s }) => {
    if (!ms[s.id])
      ms[s.id] = Array.from({ length: numDays }, () =>
        new Array(periodsPerDay).fill(null),
      );
    const sch = ms[s.id];
    const fz = state.frozen[s.id] || {};
    // Count placed
    const placed = new Array(s.subjects.length).fill(0);
    for (let d = 0; d < numDays; d++)
      for (let p = 0; p < periodsPerDay; p++) {
        const si = sch[d][p];
        if (si !== null) placed[si] = (placed[si] || 0) + 1;
      }
    // Add missing — only into non-frozen empty slots
    s.subjects.forEach((sub, si) => {
      const diff = sub.periodsPerWeek - (placed[si] || 0);
      for (let k = 0; k < diff; k++) {
        const empties = [];
        for (let d = 0; d < numDays; d++)
          for (let p = 0; p < periodsPerDay; p++) {
            if (sch[d][p] === null && !fz[`${d}_${p}`]) empties.push([d, p]);
          }
        if (empties.length > 0) {
          const [d, p] = empties[Math.floor(Math.random() * empties.length)];
          sch[d][p] = si;
        }
      }
    });
    // Remove excess — only from non-frozen slots
    s.subjects.forEach((sub, si) => {
      let cnt = 0;
      for (let d = 0; d < numDays; d++)
        for (let p = 0; p < periodsPerDay; p++) if (sch[d][p] === si) cnt++;
      const exc = cnt - sub.periodsPerWeek;
      for (let e = 0; e < exc; e++) {
        let found = false;
        for (let d = 0; d < numDays && !found; d++)
          for (let p = 0; p < periodsPerDay && !found; p++) {
            if (sch[d][p] === si && !fz[`${d}_${p}`]) {
              sch[d][p] = null;
              found = true;
            }
          }
      }
    });
  });
  return ms;
}

function mutateMS(ms) {
  const s = cloneMS(ms);
  const classes = getAllClasses();
  if (classes.length === 0) return s;
  const cls = classes[Math.floor(Math.random() * classes.length)];
  const { numDays, periodsPerDay } = state.school;
  const sch = s[cls.section.id];
  if (!sch) return s;
  const fz = state.frozen[cls.section.id] || {};
  // Pick two non-frozen slots to swap
  const slots = [];
  for (let d = 0; d < numDays; d++)
    for (let p = 0; p < periodsPerDay; p++)
      if (!fz[`${d}_${p}`]) slots.push([d, p]);
  if (slots.length < 2) return s;
  const [a, b] = [
    slots[Math.floor(Math.random() * slots.length)],
    slots[Math.floor(Math.random() * slots.length)],
  ];
  [sch[a[0]][a[1]], sch[b[0]][b[1]]] = [sch[b[0]][b[1]], sch[a[0]][a[1]]];
  return s;
}

function crossoverMS(a, b) {
  const child = {};
  const classes = getAllClasses();
  const { numDays, periodsPerDay } = state.school;
  classes.forEach(({ section: s }) => {
    const sa = a[s.id],
      sb = b[s.id];
    const fz = state.frozen[s.id] || {};
    if (!sa || !sb) {
      if (sa) child[s.id] = cloneMS({ [s.id]: sa })[s.id];
      return;
    }
    // Crossover per-day, then overwrite frozen slots from existing results
    child[s.id] = sa.map((da, d) =>
      Math.random() < 0.5 ? [...da] : [...sb[d]],
    );
    // Restore frozen slots
    for (const key of Object.keys(fz)) {
      const [d, p] = key.split("_").map(Number);
      if (state.results?.sched?.[s.id])
        child[s.id][d][p] = state.results.sched[s.id][d][p];
    }
  });
  return child;
}

function tournamentMS(pop, scores, k = 3) {
  let best = null,
    bs = -Infinity;
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(Math.random() * pop.length);
    if (scores[idx] > bs) {
      bs = scores[idx];
      best = pop[idx];
    }
  }
  return best;
}

// ─── GA ───
function runGA() {
  const popSize = parseInt(document.getElementById("ga-pop").value);
  const gens = parseInt(document.getElementById("ga-gen").value);
  const mutRate = parseInt(document.getElementById("ga-mut").value) / 100;
  const eliteRate = parseInt(document.getElementById("ga-elite").value) / 100;
  addLog(
    "i",
    `[GA] Pop:${popSize} Gen:${gens} Mut:${(mutRate * 100).toFixed(0)}% Elite:${(eliteRate * 100).toFixed(0)}%`,
  );
  let pop = Array.from({ length: popSize }, () =>
    repairMS(randomMultiSchedule()),
  );
  let scores = pop.map((s) => fitnessMS(s));
  let best = pop[scores.indexOf(Math.max(...scores))];
  let bestF = Math.max(...scores);
  state.fitnessHistory = [];
  const elite = Math.max(1, Math.round(popSize * eliteRate));
  for (let g = 0; g < gens; g++) {
    const idx = [...scores.map((f, i) => [f, i])].sort((a, b) => b[0] - a[0]);
    const newPop = idx.slice(0, elite).map(([, i]) => cloneMS(pop[i]));
    while (newPop.length < popSize) {
      let child = crossoverMS(
        tournamentMS(pop, scores),
        tournamentMS(pop, scores),
      );
      if (Math.random() < mutRate) child = mutateMS(child);
      newPop.push(repairMS(child));
    }
    pop = newPop;
    scores = pop.map((s) => fitnessMS(s));
    const gf = Math.max(...scores);
    if (gf > bestF) {
      bestF = gf;
      best = cloneMS(pop[scores.indexOf(gf)]);
    }
    state.fitnessHistory.push(bestF);
    if (g % Math.ceil(gens / 8) === 0) {
      updateProg(
        Math.round((g / gens) * 100),
        `Gen ${g}/${gens} · Fitness ${bestF.toFixed(0)}`,
      );
      addLog("", `[GA] Gen ${g}: ${bestF.toFixed(0)}`);
    }
  }
  return { sched: best, fitness: bestF };
}

// ─── SA ───
function runSA() {
  let temp = parseInt(document.getElementById("sa-temp").value);
  const cool = parseInt(document.getElementById("sa-cool").value) / 100;
  const iters = parseInt(document.getElementById("sa-iter").value);
  addLog("i", `[SA] T0:${temp} α:${cool} Iter:${iters}`);
  let cur = repairMS(randomMultiSchedule());
  let curF = fitnessMS(cur);
  let best = cloneMS(cur),
    bestF = curF;
  state.fitnessHistory = [];
  for (let i = 0; i < iters; i++) {
    const nb = repairMS(mutateMS(cur));
    const nbF = fitnessMS(nb);
    const d = nbF - curF;
    if (d > 0 || Math.random() < Math.exp(d / temp)) {
      cur = nb;
      curF = nbF;
    }
    if (curF > bestF) {
      best = cloneMS(cur);
      bestF = curF;
    }
    temp *= cool;
    state.fitnessHistory.push(bestF);
    if (i % Math.ceil(iters / 8) === 0) {
      updateProg(
        Math.round((i / iters) * 100),
        `Iter ${i}/${iters} · T:${temp.toFixed(0)} Fit:${bestF.toFixed(0)}`,
      );
      addLog("", `[SA] ${i}: T=${temp.toFixed(0)} f=${bestF.toFixed(0)}`);
    }
  }
  return { sched: best, fitness: bestF };
}

// ─── CP ───
function runCP() {
  const maxBT = parseInt(document.getElementById("cp-bt").value);
  addLog("i", `[CP] MaxBT:${maxBT}`);
  const sched = repairMS(randomMultiSchedule());
  // CP refine: iterate and fix hard violations greedily
  let backtracks = 0;
  const classes = getAllClasses();
  const { numDays, periodsPerDay } = state.school;
  // Detect and resolve teacher conflicts by swapping
  let changed = true,
    passes = 0;
  while (changed && passes < 50 && backtracks < maxBT) {
    changed = false;
    passes++;
    // Build conflict map
    const occ = {};
    classes.forEach(({ section: s }) => {
      for (let d = 0; d < numDays; d++)
        for (let p = 0; p < periodsPerDay; p++) {
          const si = sched[s.id][d][p];
          if (si === null) continue;
          const tid = s.subjects[si]?.teacherId;
          if (!tid) continue;
          const key = `${tid}_${d}_${p}`;
          if (!occ[key]) occ[key] = [];
          occ[key].push({ cid: s.id, d, p, si });
        }
    });
    for (const [, entries] of Object.entries(occ)) {
      if (entries.length < 2) continue;
      // Conflict: try to swap one entry to an empty slot
      const victim = entries[Math.floor(Math.random() * entries.length)];
      const vs = sched[victim.cid];
      const empties = [];
      for (let d = 0; d < numDays; d++)
        for (let p = 0; p < periodsPerDay; p++)
          if (vs[d][p] === null) empties.push([d, p]);
      if (empties.length > 0) {
        const [nd, np] = empties[Math.floor(Math.random() * empties.length)];
        vs[nd][np] = victim.si;
        vs[victim.d][victim.p] = null;
        changed = true;
        backtracks++;
      }
      break;
    }
  }
  const fit = fitnessMS(sched);
  state.fitnessHistory = [fit];
  addLog(
    backtracks < maxBT ? "s" : "w",
    `[CP] Done in ${passes} passes, ${backtracks} moves`,
  );
  return { sched, fitness: fit };
}

async function startGeneration() {
  const classes = getAllClasses();
  if (classes.length === 0) {
    alert("Add grade levels and classes first.");
    return;
  }
  const hasSubjects = classes.some((c) => c.section.subjects.length > 0);
  if (!hasSubjects) {
    alert("Add subjects to at least one class first.");
    return;
  }

  const btn = document.getElementById("genBtn");
  btn.disabled = true;
  btn.textContent = "⏳ Generating...";
  clearLog();
  state.fitnessHistory = [];
  document.getElementById("gen-chip").className = "chip chip-yellow";
  document.getElementById("gen-chip").textContent = "Running";
  updateProg(0, "Starting...");
  const t0 = Date.now();
  addLog(
    "i",
    `[ScheduleForge] ${state.currentAlgo.toUpperCase()} · ${classes.length} classes · ${state.school.numDays}d × ${state.school.periodsPerDay}p`,
  );
  await sleep(20);

  let res;
  if (state.currentAlgo === "ga") res = runGA();
  else if (state.currentAlgo === "sa") res = runSA();
  else res = runCP();

  const elapsed = Date.now() - t0;
  updateProg(100, "Complete!");

  const hard = countHardViolations(res.sched);
  const soft = countSoftViolations(res.sched);
  addLog(
    "s",
    `[DONE] Fitness:${res.fitness.toFixed(0)} Hard:${hard} Soft:${soft} Time:${elapsed}ms`,
  );

  state.results = {
    sched: res.sched,
    fitness: res.fitness,
    hard,
    soft,
    elapsed,
  };

  document.getElementById("st-fit").textContent = res.fitness.toFixed(0);
  document.getElementById("st-hard").textContent = hard;
  document.getElementById("st-hard").style.color =
    hard === 0 ? "var(--accent-g)" : "var(--accent-r)";
  document.getElementById("st-soft").textContent = soft;
  document.getElementById("st-time").textContent = elapsed;
  document.getElementById("gen-chip").className = "chip chip-green";
  document.getElementById("gen-chip").textContent = "Done";
  document.getElementById("chip-status").className = "chip chip-green";
  document.getElementById("chip-status").textContent = "Generated";
  updateConflictBadge();

  btn.disabled = false;
  btn.textContent = "🚀 Generate All Timetables";
  drawFitnessCanvas();
}

// ═══════════════════════════════════════════════════════
// CONFLICT COLLECTION & DISPLAY
// ═══════════════════════════════════════════════════════
let conflictFilter = "all";

function collectConflicts(ms) {
  const conflicts = [];
  const classes = getAllClasses();
  const { numDays, periodsPerDay } = state.school;

  // ── 1. Teacher double-bookings ──
  const occ = {};
  classes.forEach(({ grade: g, section: s }) => {
    const sch = ms[s.id];
    if (!sch) return;
    for (let d = 0; d < numDays; d++)
      for (let p = 0; p < periodsPerDay; p++) {
        const si = sch[d][p];
        if (si === null) continue;
        const sub = s.subjects[si];
        if (!sub?.teacherId) continue;
        const key = `${sub.teacherId}_${d}_${p}`;
        if (!occ[key]) occ[key] = [];
        occ[key].push({
          grade: g.label,
          section: s.name,
          subject: sub.name,
          code: sub.code,
          teacherId: sub.teacherId,
          d,
          p,
        });
      }
  });
  for (const [, entries] of Object.entries(occ)) {
    if (entries.length < 2) continue;
    const e = entries[0];
    const teacher = state.teachers.find((t) => t.id === e.teacherId);
    const classList = entries
      .map((x) => `${x.grade} ${x.section} (${x.code})`)
      .join(" vs ");
    conflicts.push({
      severity: "hard",
      type: "Teacher Conflict",
      desc: `<strong>${teacher?.name || e.teacherId}</strong> is double-booked: ${classList}`,
      loc: `${DAYS_S[e.d]} · Period ${e.p + 1}`,
    });
  }

  // ── 2. Back-to-back same subject ──
  if (state.constraints.noBackToBack) {
    classes.forEach(({ grade: g, section: s }) => {
      const sch = ms[s.id];
      if (!sch) return;
      for (let d = 0; d < numDays; d++)
        for (let p = 0; p < periodsPerDay - 1; p++) {
          const si = sch[d][p];
          if (si !== null && si === sch[d][p + 1]) {
            conflicts.push({
              severity: "hard",
              type: "Back-to-Back",
              desc: `<strong>${s.subjects[si].name}</strong> appears in consecutive periods`,
              loc: `${g.label} ${s.name} · ${DAYS_S[d]} P${p + 1}–P${p + 2}`,
            });
          }
        }
    });
  }

  // ── 3. Missing periods ──
  classes.forEach(({ grade: g, section: s }) => {
    const sch = ms[s.id];
    if (!sch) return;
    s.subjects.forEach((sub, si) => {
      let placed = 0;
      for (let d = 0; d < numDays; d++)
        for (let p = 0; p < periodsPerDay; p++) if (sch[d][p] === si) placed++;
      if (placed < sub.periodsPerWeek) {
        conflicts.push({
          severity: "hard",
          type: "Missing Periods",
          desc: `<strong>${sub.name}</strong> needs ${sub.periodsPerWeek} sessions/week but only ${placed} were placed`,
          loc: `${g.label} ${s.name}`,
        });
      }
    });
  });

  // ── 4. Teacher availability violations ──
  classes.forEach(({ grade: g, section: s }) => {
    const sch = ms[s.id];
    if (!sch) return;
    const breaks = g && g.breaks ? g.breaks : state.school.breaks;
    for (let d = 0; d < numDays; d++) {
      let clock = t2m(state.school.startTime);
      for (let p = 0; p < periodsPerDay; p++) {
        const si = sch[d][p];
        const sub =
          si !== null && si !== undefined && s.subjects[si]
            ? s.subjects[si]
            : null;
        const dur = sub ? sub.durationMinutes || 50 : 50;
        if (sub?.teacherId) {
          const teacher = state.teachers.find((t) => t.id === sub.teacherId);
          if (teacher?.unavailability?.length) {
            const pEnd = clock + dur;
            for (const block of teacher.unavailability) {
              if (!block.days.includes(d)) continue;
              const bFrom = t2m(block.fromTime),
                bTo = t2m(block.toTime);
              if (clock < bTo && pEnd > bFrom) {
                const label =
                  block.type === "unavailable"
                    ? "🚫 Unavailable"
                    : "😓 Prefers off";
                conflicts.push({
                  severity: "avail",
                  type: "Availability",
                  desc: `<strong>${teacher.name}</strong> scheduled during blocked time (${label}: ${block.fromTime}–${block.toTime}) — teaching <strong>${sub.name}</strong>`,
                  loc: `${g.label} ${s.name} · ${DAYS_S[d]} P${p + 1}`,
                });
                break;
              }
            }
          }
        }
        clock += dur;
        const brk = breaks.find((b) => b.afterPeriod === p + 1);
        if (brk) clock += brk.duration;
      }
    }
  });

  // ── 5. Max consecutive ──
  if (state.constraints.maxConsec) {
    classes.forEach(({ grade: g, section: s }) => {
      const sch = ms[s.id];
      if (!sch) return;
      for (let d = 0; d < numDays; d++) {
        let run = 0,
          runStart = 0;
        for (let p = 0; p < periodsPerDay; p++) {
          if (sch[d][p] !== null) {
            if (run === 0) runStart = p;
            run++;
            if (run > 3) {
              conflicts.push({
                severity: "soft",
                type: "Long Run",
                desc: `${run} consecutive periods without a break (max is 3)`,
                loc: `${g.label} ${s.name} · ${DAYS_S[d]} from P${runStart + 1}`,
              });
            }
          } else {
            run = 0;
          }
        }
      }
    });
  }

  // ── 6. Subject imbalance ──
  if (state.constraints.balance) {
    classes.forEach(({ grade: g, section: s }) => {
      const sch = ms[s.id];
      if (!sch) return;
      s.subjects.forEach((sub, si) => {
        const perDay = Array(numDays).fill(0);
        for (let d = 0; d < numDays; d++)
          for (let p = 0; p < periodsPerDay; p++)
            if (sch[d][p] === si) perDay[d]++;
        const max = Math.max(...perDay),
          min = Math.min(
            ...perDay.filter((v) => v > 0 || sub.periodsPerWeek >= numDays),
          );
        if (max - min > 1) {
          conflicts.push({
            severity: "soft",
            type: "Imbalance",
            desc: `<strong>${sub.name}</strong> is unevenly spread (${perDay.map((v, i) => `${DAYS_S[i]}:${v}`).join(" ")})`,
            loc: `${g.label} ${s.name}`,
          });
        }
      });
    });
  }

  return conflicts;
}

function renderConflictsPanel() {
  const el = document.getElementById("conflictsContent");
  if (!state.results) {
    el.innerHTML =
      '<div class="empty-state"><div class="ei">⚠️</div><p>Generate timetables first to see conflicts</p></div>';
    return;
  }
  const all = collectConflicts(state.results.sched);
  const hard = all.filter((c) => c.severity === "hard");
  const avail = all.filter((c) => c.severity === "avail");
  const soft = all.filter((c) => c.severity === "soft");

  const visible =
    conflictFilter === "all"
      ? all
      : conflictFilter === "hard"
        ? hard
        : conflictFilter === "avail"
          ? avail
          : soft;

  const summaryColor =
    hard.length === 0 ? "var(--accent-g)" : "var(--accent-r)";

  el.innerHTML = `
    <div class="conflict-summary">
      <div class="cs-box" style="border-color:${hard.length ? "rgba(255,77,94,.3)" : "rgba(0,196,140,.3)"}">
        <div class="cs-val" style="color:${hard.length ? "var(--accent-r)" : "var(--accent-g)"}">${hard.length}</div>
        <div class="cs-lbl">Hard Violations</div>
      </div>
      <div class="cs-box" style="border-color:rgba(155,109,255,.25)">
        <div class="cs-val" style="color:var(--accent-p)">${avail.length}</div>
        <div class="cs-lbl">Availability Breaches</div>
      </div>
      <div class="cs-box" style="border-color:rgba(255,184,48,.25)">
        <div class="cs-val" style="color:var(--accent-y)">${soft.length}</div>
        <div class="cs-lbl">Soft Violations</div>
      </div>
      <div class="cs-box">
        <div class="cs-val" style="color:var(--text2)">${all.length}</div>
        <div class="cs-lbl">Total Issues</div>
      </div>
    </div>

    ${hard.length === 0 ? `<div style="padding:10px 14px;background:rgba(0,196,140,.08);border:1px solid rgba(0,196,140,.2);border-radius:var(--r-sm);font-size:12px;color:var(--accent-g);margin-bottom:12px">✅ No hard violations — this timetable is valid. ${soft.length + avail.length > 0 ? "Soft/availability issues are preferences only." : "All constraints satisfied."}</div>` : `<div style="padding:10px 14px;background:rgba(255,77,94,.08);border:1px solid rgba(255,77,94,.2);border-radius:var(--r-sm);font-size:12px;color:var(--accent-r);margin-bottom:12px">⚠ ${hard.length} hard violation${hard.length !== 1 ? "s" : ""} found — timetable is not fully valid. Try re-generating with a higher population or more generations.</div>`}

    <div class="conflict-filters">
      <button class="cf-btn ${conflictFilter === "all" ? "active" : ""}" onclick="setConflictFilter('all')">All (${all.length})</button>
      <button class="cf-btn f-hard ${conflictFilter === "hard" ? "active" : ""}" onclick="setConflictFilter('hard')">🔴 Hard (${hard.length})</button>
      <button class="cf-btn f-avail ${conflictFilter === "avail" ? "active" : ""}" onclick="setConflictFilter('avail')">🟣 Availability (${avail.length})</button>
      <button class="cf-btn f-soft ${conflictFilter === "soft" ? "active" : ""}" onclick="setConflictFilter('soft')">🟡 Soft (${soft.length})</button>
    </div>

    ${
      visible.length === 0
        ? `<div style="padding:30px;text-align:center;color:var(--text3);font-size:13px">No violations in this category ✓</div>`
        : `<div class="conflict-list">${visible
            .map(
              (c) => `
          <div class="conflict-item ${c.severity}">
            <span class="ci-badge ${c.severity}">${c.severity.toUpperCase()}</span>
            <span class="ci-type">${c.type}</span>
            <span class="ci-desc">${c.desc}</span>
            <span class="ci-loc">${c.loc}</span>
          </div>`,
            )
            .join("")}
        </div>`
    }`;
}

function setConflictFilter(f) {
  conflictFilter = f;
  renderConflictsPanel();
}

function updateConflictBadge() {
  if (!state.results) return;
  const all = collectConflicts(state.results.sched);
  const hard = all.filter((c) => c.severity === "hard").length;
  const nb = document.getElementById("nb-conflicts");
  nb.style.display = "inline";
  nb.textContent = all.length;
  nb.style.color = hard > 0 ? "var(--accent-r)" : "var(--accent-g)";
}

function countHardViolations(ms) {
  const classes = getAllClasses();
  const { numDays, periodsPerDay } = state.school;
  let v = 0;
  // Teacher conflicts
  const occ = {};
  classes.forEach(({ section: s }) => {
    const sch = ms[s.id];
    if (!sch) return;
    for (let d = 0; d < numDays; d++)
      for (let p = 0; p < periodsPerDay; p++) {
        const si = sch[d][p];
        if (si === null) continue;
        const tid = s.subjects[si]?.teacherId;
        if (!tid) continue;
        const key = `${tid}_${d}_${p}`;
        if (occ[key]) v++;
        else occ[key] = 1;
      }
  });
  // Back-to-back
  if (state.constraints.noBackToBack)
    classes.forEach(({ section: s }) => {
      const sch = ms[s.id];
      if (!sch) return;
      for (let d = 0; d < numDays; d++)
        for (let p = 0; p < periodsPerDay - 1; p++)
          if (sch[d][p] !== null && sch[d][p] === sch[d][p + 1]) v++;
    });
  return v;
}

function countSoftViolations(ms) {
  const classes = getAllClasses();
  const { numDays, periodsPerDay } = state.school;
  let v = 0;
  classes.forEach(({ grade: g, section: s }) => {
    const sch = ms[s.id];
    if (!sch) return;
    // Max consecutive
    for (let d = 0; d < numDays; d++) {
      let c = 0;
      for (let p = 0; p < periodsPerDay; p++) {
        if (sch[d][p] !== null) {
          c++;
          if (c > 3) v++;
        } else c = 0;
      }
    }
    // Teacher availability
    for (let d = 0; d < numDays; d++) {
      const breaks = g && g.breaks ? g.breaks : state.school.breaks;
      let clock = t2m(state.school.startTime);
      for (let p = 0; p < periodsPerDay; p++) {
        const si = sch[d][p];
        const sub =
          si !== null && si !== undefined && s.subjects[si]
            ? s.subjects[si]
            : null;
        const dur = sub ? sub.durationMinutes || 50 : 50;
        if (sub?.teacherId) {
          const teacher = state.teachers.find((t) => t.id === sub.teacherId);
          if (teacher?.unavailability?.length) {
            const pEnd = clock + dur;
            for (const block of teacher.unavailability) {
              if (!block.days.includes(d)) continue;
              const bFrom = t2m(block.fromTime),
                bTo = t2m(block.toTime);
              if (clock < bTo && pEnd > bFrom) {
                v++;
                break;
              }
            }
          }
        }
        clock += dur;
        const brk = breaks.find((b) => b.afterPeriod === p + 1);
        if (brk) clock += brk.duration;
      }
    }
  });
  return v;
}

// ═══════════════════════════════════════════════════════
// RESULTS VIEW
// ═══════════════════════════════════════════════════════
function renderResultNav() {
  const el = document.getElementById("resultNav");
  if (!state.results) {
    el.innerHTML =
      '<div style="padding:16px;color:var(--text3);font-size:13px">Generate timetables first</div>';
    return;
  }
  let html = "";
  state.gradeLevels.forEach((g) => {
    html += `<div class="rn-section"><div class="rn-label" style="display:flex;align-items:center;gap:6px"><div class="rn-dot" style="background:${g.color}"></div>${g.label}</div>`;
    g.sections.forEach((s) => {
      html += `<div class="rn-item ${resultViewClass === s.id ? "active" : ""}" onclick="selectResultClass('${s.id}')"><div class="rn-dot" style="background:${resultViewClass === s.id ? g.color : "var(--text3)"}"></div>${s.name}</div>`;
    });
    html += '</div><div class="rn-divider"></div>';
  });
  el.innerHTML = html;
}

function selectResultClass(id) {
  resultViewClass = id;
  renderResultNav();
  renderResultView();
}

function renderResultView() {
  const scroll = document.getElementById("resultScroll");
  if (!state.results) {
    scroll.innerHTML =
      '<div class="empty-state"><div class="ei">📋</div><p>Generate timetables first</p></div>';
    return;
  }
  if (!resultViewClass) {
    const first = getAllClasses()[0];
    if (first) resultViewClass = first.section.id;
    else {
      scroll.innerHTML =
        '<div class="empty-state"><p>No classes configured</p></div>';
      return;
    }
  }
  const found = findClass(resultViewClass);
  if (!found) {
    scroll.innerHTML = "";
    return;
  }
  const { grade: g, section: s } = found;
  const sch = state.results.sched[s.id];
  if (!sch) {
    scroll.innerHTML =
      '<div class="empty-state"><p>No schedule for this class</p></div>';
    return;
  }
  const { numDays } = state.school;

  if (dayViewMode === "week") {
    scroll.innerHTML = renderWeekTable(s, sch, numDays, g);
  } else {
    renderDayButtons();
    scroll.innerHTML = renderDayTable(s, sch, resultViewDay, g);
  }
}

function renderWeekTable(s, sch, numDays, g) {
  const hard = countHardViolations(state.results.sched);
  const fz = state.frozen[s.id] || {};
  let html = `<div class="tt-wrap">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <span style="font-family:var(--head);font-size:15px;font-weight:700">${g.label} — ${s.name}</span>
      <span class="conflict-tag ${hard === 0 ? "ct-ok" : "ct-hard"}">${hard === 0 ? "✓ No conflicts" : "⚠ " + hard + " conflicts"}</span>
    </div>
    <table class="tt-table"><thead><tr>
      <th>Period</th>`;
  for (let d = 0; d < numDays; d++)
    html += `<th>${DAYS_S[d]}<div style="font-weight:400;color:var(--text3);margin-top:1px">${DAYS[d]}</div></th>`;
  html += "</tr></thead><tbody>";

  const refSlots = buildTimeSlots(g, sch[0], s.subjects);
  let periodCounters = new Array(numDays).fill(0);
  let refPeriod = 0;

  refSlots.forEach((slot) => {
    if (slot.isBreak) {
      html += `<tr><td class="time-col" style="font-size:10px;color:var(--text3)">${slot.start}<br>${slot.end}</td>`;
      for (let d = 0; d < numDays; d++) {
        const dayBreak = (g.breaks || state.school.breaks).find(
          (b) => b.afterPeriod === periodCounters[d],
        );
        const bLabel =
          (dayBreak?.duration || 15) >= 30 ? "🍽 LUNCH" : "☕ BREAK";
        const bDur = dayBreak ? dayBreak.duration : slot.duration;
        html += `<td><div class="tt-break">${bLabel} <span style="margin-left:4px;font-size:9px">${bDur}min</span></div></td>`;
      }
      html += "</tr>";
    } else {
      html += `<tr><td class="time-col"><div style="font-family:var(--mono);font-size:11px;font-weight:600;color:var(--accent)">P${slot.period}</div><div style="font-size:9px;color:var(--text3)">${slot.start}</div></td>`;
      for (let d = 0; d < numDays; d++) {
        const p = periodCounters[d];
        const si = sch[d][p];
        const key = `${d}_${p}`;
        const frozen = !!fz[key];
        if (si !== null && si !== undefined && s.subjects[si]) {
          const sub = s.subjects[si];
          html += `<td><div class="tt-cell-wrap" onclick="toggleFreeze('${s.id}',${d},${p})" title="${frozen ? "Click to unfreeze" : "Click to freeze this slot"}">
            <div class="tt-slot sc${sub.color % 10}${frozen ? " frozen" : ""}">
              <div class="tt-code">${sub.code} <span style="opacity:.5">${sub.durationMinutes || 50}min</span></div>
              <div class="tt-name">${sub.name}</div>
              <div class="tt-teacher">${teacherName(sub.teacherId)}</div>
            </div></div></td>`;
        } else html += `<td><div class="tt-empty">—</div></td>`;
        periodCounters[d]++;
      }
      html += "</tr>";
      refPeriod++;
    }
  });
  html += "</tbody></table></div>";
  return html;
}

function renderDayTable(s, sch, day, g) {
  const slots = buildTimeSlots(g, sch[day], s.subjects);
  const fz = state.frozen[s.id] || {};
  let html = `<div class="tt-wrap">
    <div style="font-family:var(--head);font-size:15px;font-weight:700;margin-bottom:4px">${g?.label || ""} — ${s.name}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px">${DAYS[day]} · Exact times based on subject durations</div>
    <table class="tt-table" style="max-width:500px"><thead><tr><th>Time</th><th>Subject</th></tr></thead><tbody>`;
  let pi = 0;
  slots.forEach((slot) => {
    if (slot.isBreak) {
      html += `<tr><td class="time-col">${slot.start}<br><span style="color:var(--text3)">${slot.end}</span><br><span style="font-size:9px;color:var(--text3)">${slot.duration}min</span></td>
        <td><div class="tt-break">${slot.label || "☕ BREAK"} <span style="font-size:10px;opacity:.6">${slot.duration}min</span></div></td></tr>`;
    } else {
      const si = sch[day][pi];
      const key = `${day}_${pi}`;
      const frozen = !!fz[key];
      html += `<tr><td class="time-col"><div style="font-family:var(--mono);font-size:11px;font-weight:600;color:var(--accent)">P${slot.period}</div>${slot.start}<br><span style="color:var(--text3)">${slot.end}</span></td>`;
      if (si !== null && si !== undefined && s.subjects[si]) {
        const sub = s.subjects[si];
        html += `<td><div class="tt-cell-wrap" onclick="toggleFreeze('${s.id}',${day},${pi})" title="${frozen ? "Click to unfreeze" : "Click to freeze"}">
          <div class="tt-slot sc${sub.color % 10}${frozen ? " frozen" : ""}">
            <div class="tt-code">${sub.code} <span style="opacity:.5">${sub.durationMinutes || 50}min</span></div>
            <div class="tt-name">${sub.name}</div>
            <div class="tt-teacher">${teacherName(sub.teacherId)}</div>
          </div></div></td>`;
      } else html += `<td><div class="tt-empty">—</div></td>`;
      html += "</tr>";
      pi++;
    }
  });
  html += "</tbody></table></div>";
  return html;
}

function setDayView(mode) {
  dayViewMode = mode;
  document
    .querySelectorAll(".vt-btn")
    .forEach((b, i) =>
      b.classList.toggle(
        "active",
        (i === 0 && mode === "week") || (i === 1 && mode === "day"),
      ),
    );
  document.getElementById("day-nav").style.display =
    mode === "day" ? "block" : "none";
  if (mode === "day") renderDayButtons();
  renderResultView();
}

function renderDayButtons() {
  const { numDays } = state.school;
  document.getElementById("dayBtns").innerHTML = DAYS.slice(0, numDays)
    .map(
      (d, i) =>
        `<button class="chip ${i === resultViewDay ? "chip-blue" : "chip-yellow"}" style="cursor:pointer" onclick="selectDay(${i})">${DAYS_S[i]}</button>`,
    )
    .join("");
}

function selectDay(i) {
  resultViewDay = i;
  renderDayButtons();
  renderResultView();
}

// ═══════════════════════════════════════════════════════
// TEACHER VIEW
// ═══════════════════════════════════════════════════════
function renderTeacherSelect() {
  const sel = document.getElementById("teacherSelect");
  sel.innerHTML = state.teachers
    .map((t) => `<option value="${t.id}">${t.name} (${t.id})</option>`)
    .join("");
}

function renderTeacherView() {
  const body = document.getElementById("teacherViewBody");
  if (!state.results) {
    body.innerHTML =
      '<div class="empty-state"><div class="ei">👩‍🏫</div><p>Generate timetables first</p></div>';
    return;
  }
  const tid = document.getElementById("teacherSelect").value;
  if (!tid) {
    body.innerHTML = '<div class="empty-state"><p>Select a teacher</p></div>';
    return;
  }
  const teacher = state.teachers.find((t) => t.id === tid);
  if (!teacher) return;

  const { numDays, periodsPerDay } = state.school;
  const tsch = Array.from({ length: numDays }, () =>
    new Array(periodsPerDay).fill(null),
  );
  const classes = getAllClasses();
  classes.forEach(({ grade: g, section: s }) => {
    const sch = state.results.sched[s.id];
    if (!sch) return;
    for (let d = 0; d < numDays; d++)
      for (let p = 0; p < periodsPerDay; p++) {
        const si = sch[d][p];
        if (si === null) continue;
        const sub = s.subjects[si];
        if (sub?.teacherId === tid)
          tsch[d][p] = {
            className: `${g.label}–${s.name}`,
            subName: sub.name,
            code: sub.code,
            color: sub.color,
            dur: sub.durationMinutes || 50,
          };
      }
  });
  let totalPeriods = 0;
  for (let d = 0; d < numDays; d++)
    for (let p = 0; p < periodsPerDay; p++) if (tsch[d][p]) totalPeriods++;

  const fc = getAllClasses()[0];
  const slots = buildTimeSlots(
    fc?.grade || null,
    (fc ? state.results.sched[fc.section.id] : null)?.[0] || null,
    fc?.section.subjects || [],
  );

  let html = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
    <div style="font-family:var(--head);font-size:17px;font-weight:700">${teacher.name}</div>
    <span class="chip chip-blue">${teacher.dept || "—"}</span>
    <span class="chip chip-green">${totalPeriods}/${teacher.maxPeriods} sessions</span>
    <span class="chip ${totalPeriods > teacher.maxPeriods ? "chip-red" : "chip-yellow"}">${Math.round((totalPeriods / teacher.maxPeriods) * 100)}% load</span>
  </div>
  <div style="overflow-x:auto"><table class="tt-table teacher-view-table" style="min-width:600px"><thead><tr><th>Period</th>`;
  for (let d = 0; d < numDays; d++) html += `<th>${DAYS_S[d]}</th>`;
  html += "</tr></thead><tbody>";
  let pi = 0;
  slots.forEach((slot) => {
    if (slot.isBreak) {
      html += `<tr><td class="time-col" style="font-size:10px">${slot.start}</td>${Array(
        numDays,
      )
        .fill(`<td><div class="tt-break">${slot.label || "☕"}</div></td>`)
        .join("")}</tr>`;
    } else {
      html += `<tr><td class="time-col"><div style="font-family:var(--mono);font-size:11px;font-weight:600;color:var(--accent)">P${slot.period}</div><div style="font-size:9px;color:var(--text3)">${slot.start}</div></td>`;
      for (let d = 0; d < numDays; d++) {
        const e = tsch[d][pi];
        if (e)
          html += `<td class="tcell-own"><div class="tt-slot sc${e.color % 10}"><div class="tt-code">${e.code} <span style="opacity:.5">${e.dur}min</span></div><div class="tt-name">${e.subName}</div><div class="tt-teacher">${e.className}</div></div></td>`;
        else
          html += `<td><div class="tt-empty" style="font-size:13px;color:var(--border3)">—</div></td>`;
      }
      html += "</tr>";
      pi++;
    }
  });
  html += "</tbody></table></div>";
  body.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// FITNESS CANVAS
// ═══════════════════════════════════════════════════════
function drawFitnessCanvas() {
  const canvas = document.getElementById("fitnessCanvas");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = 90 * dpr;
  ctx.scale(dpr, dpr);
  const W = canvas.offsetWidth,
    H = 90;
  ctx.clearRect(0, 0, W, H);
  const fh = state.fitnessHistory;
  if (fh.length < 2) return;
  const pad = { t: 8, r: 8, b: 16, l: 38 };
  const cw = W - pad.l - pad.r,
    ch = H - pad.t - pad.b;
  const mn = Math.min(...fh),
    mx = Math.max(...fh),
    rng = mx - mn || 1;
  const pts = fh.map((f, i) => [
    pad.l + (i / (fh.length - 1)) * cw,
    pad.t + ch - ((f - mn) / rng) * ch,
  ]);
  const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
  g.addColorStop(0, "rgba(217,79,30,.25)");
  g.addColorStop(1, "rgba(217,79,30,0)");
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pad.t + ch);
  pts.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(pts[pts.length - 1][0], pad.t + ch);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = "#d94f1e";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#6b5f52";
  ctx.font = "9px Courier Prime";
  ctx.textAlign = "right";
  ctx.fillText(mx.toFixed(0), pad.l - 3, pad.t + 8);
  ctx.fillText(mn.toFixed(0), pad.l - 3, pad.t + ch);
  ctx.textAlign = "left";
  ctx.fillText("Fitness over iterations", pad.l, H - 2);
}

// ═══════════════════════════════════════════════════════
// EXPORT CSV
// ═══════════════════════════════════════════════════════
function exportCurrentCSV() {
  if (!state.results || !resultViewClass) return;
  const found = findClass(resultViewClass);
  if (!found) return;
  const { grade: g, section: s } = found;
  const sch = state.results.sched[s.id];
  const { numDays } = state.school;
  const slots = buildTimeSlots(g, sch[0], s.subjects);
  let csv = `Class,${g.label} - ${s.name}\nGenerated,${new Date().toLocaleDateString()}\n\n`;
  csv += "Period,Time," + DAYS.slice(0, numDays).join(",") + "\n";
  let pi = 0;
  slots.forEach((slot) => {
    if (slot.isBreak) {
      csv += `Break (${slot.duration}min),${slot.start}-${slot.end},${Array(numDays).fill("BREAK").join(",")}\n`;
    } else {
      const row = [pi + 1, `${slot.start}-${slot.end}`];
      for (let d = 0; d < numDays; d++) {
        const si = sch[d][pi];
        row.push(
          si !== null && s.subjects[si]
            ? `${s.subjects[si].code} ${s.subjects[si].name} (${s.subjects[si].durationMinutes || 50}min)`
            : "FREE",
        );
      }
      csv += row.join(",") + "\n";
      pi++;
    }
  });
  dlCSV(csv, `${g.label}_${s.name}.csv`);
}

function exportTeacherCSV() {
  if (!state.results) return;
  const tid = document.getElementById("teacherSelect").value;
  const teacher = state.teachers.find((t) => t.id === tid);
  if (!teacher) return;
  const { numDays, periodsPerDay } = state.school;
  const fc = getAllClasses()[0];
  const slots = buildTimeSlots(
    fc?.grade || null,
    (fc ? state.results.sched[fc.section.id] : null)?.[0] || null,
    fc?.section.subjects || [],
  );
  const tsch = Array.from({ length: numDays }, () =>
    new Array(periodsPerDay).fill(null),
  );
  getAllClasses().forEach(({ grade: g, section: s }) => {
    const sch = state.results.sched[s.id];
    if (!sch) return;
    for (let d = 0; d < numDays; d++)
      for (let p = 0; p < periodsPerDay; p++) {
        const si = sch[d][p];
        if (si === null) continue;
        const sub = s.subjects[si];
        if (sub?.teacherId === tid)
          tsch[d][p] =
            `${g.label}-${s.name}: ${sub.name} (${sub.durationMinutes || 50}min)`;
      }
  });
  let csv = `Teacher,${teacher.name} (${tid})\n\nPeriod,Time,${DAYS.slice(0, numDays).join(",")}\n`;
  let pi = 0;
  slots.forEach((slot) => {
    if (slot.isBreak) {
      csv += `Break (${slot.duration}min),${slot.start}-${slot.end},${Array(numDays).fill("BREAK").join(",")}\n`;
    } else {
      csv += `${pi + 1},${slot.start}-${slot.end},${Array.from({ length: numDays }, (_, d) => tsch[d][pi] || "FREE").join(",")}\n`;
      pi++;
    }
  });
  dlCSV(csv, `Teacher_${tid}.csv`);
}

function dlCSV(csv, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
}

// ═══════════════════════════════════════════════════════
// LOG / PROGRESS
// ═══════════════════════════════════════════════════════
function addLog(type, msg) {
  const area = document.getElementById("logArea");
  const d = document.createElement("div");
  d.className = "le " + (type || "");
  d.textContent = msg;
  area.appendChild(d);
  area.scrollTop = area.scrollHeight;
}
function clearLog() {
  document.getElementById("logArea").innerHTML = "";
}
function updateProg(pct, label) {
  document.getElementById("prog-fill").style.width = pct + "%";
  document.getElementById("prog-pct").textContent = pct + "%";
  document.getElementById("gen-label").textContent = label;
}

// ═══════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════
function t2m(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function m2t(m) {
  const h = Math.floor(m / 60),
    mn = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}
function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════
// DEMO
// ═══════════════════════════════════════════════════════
function loadDemo() {
  document.getElementById("schoolName").value = "Rizal National High School";
  document.getElementById("topSchoolName").textContent =
    "Rizal National High School";
  document.getElementById("schoolYear").value = "2024–2025";
  document.getElementById("numDays").value = "5";
  document.getElementById("periodsPerDay").value = "8";
  document.querySelector("#periodsPerDay + .rv").textContent = "8";
  document.getElementById("periodDuration").value = "50";
  document.querySelector("#periodDuration + .rv").textContent = "50m";
  document.getElementById("numBreaks").value = "2";
  document.querySelector("#numBreaks + .rv").textContent = "2";
  state.school = {
    name: "Rizal NHS",
    numDays: 5,
    periodsPerDay: 8,
    startTime: "07:00",
    numBreaks: 2,
    breaks: [
      { afterPeriod: 3, duration: 15 },
      { afterPeriod: 6, duration: 50 },
    ],
  };
  renderBreaks();

  // Teachers
  state.teachers = [
    {
      id: "T001",
      name: "Ms. Ana Reyes",
      dept: "Mathematics",
      maxPeriods: 30,
      unavailability: [],
    },
    {
      id: "T002",
      name: "Mr. Ben Santos",
      dept: "English",
      maxPeriods: 30,
      unavailability: [],
    },
    {
      id: "T003",
      name: "Ms. Carla Cruz",
      dept: "Science",
      maxPeriods: 28,
      unavailability: [],
    },
    {
      id: "T004",
      name: "Mr. Diego Dela Cruz",
      dept: "Filipino",
      maxPeriods: 28,
      unavailability: [],
    },
    {
      id: "T005",
      name: "Ms. Elena Bautista",
      dept: "Social Studies",
      maxPeriods: 25,
      unavailability: [],
    },
    {
      id: "T006",
      name: "Mr. Frank Garcia",
      dept: "TLE",
      maxPeriods: 25,
      unavailability: [],
    },
    {
      id: "T007",
      name: "Coach Grace Torres",
      dept: "MAPEH",
      maxPeriods: 22,
      unavailability: [
        {
          type: "preferred_off",
          days: [0, 1, 2, 3, 4],
          fromTime: "07:00",
          toTime: "09:00",
        },
      ],
    },
    {
      id: "T008",
      name: "Ms. Helen Lopez",
      dept: "Values Ed.",
      maxPeriods: 20,
      unavailability: [],
    },
    {
      id: "T009",
      name: "Mr. Ivan Mendoza",
      dept: "Mathematics",
      maxPeriods: 28,
      unavailability: [],
    },
    {
      id: "T010",
      name: "Ms. Jane Villanueva",
      dept: "Science",
      maxPeriods: 28,
      unavailability: [],
    },
  ];

  colorCounter = 0;
  const subjectsG7 = [
    {
      code: "MATH7",
      name: "Mathematics",
      periodsPerWeek: 5,
      durationMinutes: 60,
      teacherId: "T001",
      color: colorCounter++ % 10,
    },
    {
      code: "ENG7",
      name: "English Language",
      periodsPerWeek: 5,
      durationMinutes: 60,
      teacherId: "T002",
      color: colorCounter++ % 10,
    },
    {
      code: "SCI7",
      name: "Integrated Science",
      periodsPerWeek: 4,
      durationMinutes: 60,
      teacherId: "T003",
      color: colorCounter++ % 10,
    },
    {
      code: "FIL7",
      name: "Filipino",
      periodsPerWeek: 4,
      durationMinutes: 60,
      teacherId: "T004",
      color: colorCounter++ % 10,
    },
    {
      code: "AP7",
      name: "Araling Panlipunan",
      periodsPerWeek: 3,
      durationMinutes: 50,
      teacherId: "T005",
      color: colorCounter++ % 10,
    },
    {
      code: "TLE7",
      name: "TLE",
      periodsPerWeek: 2,
      durationMinutes: 90,
      teacherId: "T006",
      color: colorCounter++ % 10,
    },
    {
      code: "MAPEH7",
      name: "MAPEH",
      periodsPerWeek: 2,
      durationMinutes: 90,
      teacherId: "T007",
      color: colorCounter++ % 10,
    },
    {
      code: "ESP7",
      name: "ESP / Values",
      periodsPerWeek: 1,
      durationMinutes: 50,
      teacherId: "T008",
      color: colorCounter++ % 10,
    },
  ];
  const subjectsG10 = [
    {
      code: "MATH10",
      name: "Algebra & Geometry",
      periodsPerWeek: 5,
      durationMinutes: 60,
      teacherId: "T009",
      color: colorCounter++ % 10,
    },
    {
      code: "ENG10",
      name: "English Literature",
      periodsPerWeek: 5,
      durationMinutes: 60,
      teacherId: "T002",
      color: colorCounter++ % 10,
    },
    {
      code: "SCI10",
      name: "Integrated Science",
      periodsPerWeek: 4,
      durationMinutes: 60,
      teacherId: "T010",
      color: colorCounter++ % 10,
    },
    {
      code: "FIL10",
      name: "Filipino",
      periodsPerWeek: 4,
      durationMinutes: 60,
      teacherId: "T004",
      color: colorCounter++ % 10,
    },
    {
      code: "AP10",
      name: "Araling Panlipunan",
      periodsPerWeek: 3,
      durationMinutes: 50,
      teacherId: "T005",
      color: colorCounter++ % 10,
    },
    {
      code: "TLE10",
      name: "TLE",
      periodsPerWeek: 2,
      durationMinutes: 90,
      teacherId: "T006",
      color: colorCounter++ % 10,
    },
    {
      code: "MAPEH10",
      name: "MAPEH",
      periodsPerWeek: 2,
      durationMinutes: 90,
      teacherId: "T007",
      color: colorCounter++ % 10,
    },
    {
      code: "ESP10",
      name: "ESP / Values",
      periodsPerWeek: 1,
      durationMinutes: 50,
      teacherId: "T008",
      color: colorCounter++ % 10,
    },
  ];

  state.gradeLevels = [
    {
      id: "g7",
      level: 7,
      label: "Grade 7",
      color: "#d94f1e",
      _customBreaks: false,
      breaks: [
        { afterPeriod: 3, duration: 15 },
        { afterPeriod: 6, duration: 50 },
      ],
      sections: [
        {
          id: "g7s0",
          name: "Section A",
          subjects: subjectsG7.map((s) => ({ ...s })),
        },
        {
          id: "g7s1",
          name: "Section B",
          subjects: subjectsG7.map((s) => ({ ...s })),
        },
        {
          id: "g7s2",
          name: "Section C",
          subjects: subjectsG7.map((s) => ({ ...s })),
        },
      ],
    },
    {
      id: "g10",
      level: 10,
      label: "Grade 10",
      color: "#c48010",
      _customBreaks: true,
      breaks: [
        { afterPeriod: 4, duration: 15 },
        { afterPeriod: 7, duration: 60 },
      ], // Grade 10 has longer lunch!
      sections: [
        {
          id: "g10s0",
          name: "Section A",
          subjects: subjectsG10.map((s) => ({ ...s })),
        },
        {
          id: "g10s1",
          name: "Section B",
          subjects: subjectsG10.map((s) => ({ ...s })),
        },
      ],
    },
  ];

  renderGradeLevelManager();
  updateTopChips();
  updateSchoolPreview();
  renderBreaks();
  alert(
    "Demo data loaded! 5 classes across Grade 7 (3 sections) and Grade 10 (2 sections). Head to Generate → click 🚀",
  );
}

// ═══════════════════════════════════════════════════════
// EXCEL IMPORT / EXPORT
// ═══════════════════════════════════════════════════════
let importedWorkbook = null;
let importedData = { teachers: [], classes: [], subjects: [] };
let previewSheet = "teachers";

// ── Drag & drop wiring ──
(function () {
  const zone = document.getElementById("dropZone");
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) processXLSX(file);
  });
})();

function handleFileSelect(input) {
  if (input.files[0]) processXLSX(input.files[0]);
}

function processXLSX(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      importedWorkbook = XLSX.read(e.target.result, { type: "binary" });
      parseWorkbook();
    } catch (err) {
      showImportMsg("error", "❌ Could not read file: " + err.message);
    }
  };
  reader.readAsBinaryString(file);
}

function parseWorkbook() {
  const wb = importedWorkbook;
  const names = wb.SheetNames.map((n) => n.toLowerCase().trim());

  // Find sheets by name (flexible matching)
  const findSheet = (...keys) => {
    for (const k of keys) {
      const idx = names.findIndex((n) => n.includes(k));
      if (idx >= 0)
        return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[idx]], {
          defval: "",
        });
    }
    return null;
  };

  const rawTeachers = findSheet("teacher");
  const rawClasses = findSheet("class", "section", "grade");
  const rawSubjects = findSheet("subject");

  const errors = [];
  const warnings = [];

  // ── Parse teachers ──
  importedData.teachers = [];
  if (!rawTeachers) {
    errors.push('Missing "teachers" sheet. Expected a sheet named "teachers".');
  } else {
    rawTeachers.forEach((row, i) => {
      const id = String(row["teacher_id"] || row["id"] || "").trim();
      const name = String(row["teacher_name"] || row["name"] || "").trim();
      const dept = String(row["department"] || row["dept"] || "").trim();
      const maxP =
        parseInt(row["max_periods_per_week"] || row["max_periods"] || 30) || 30;
      if (!id || !name) {
        errors.push(
          `Teachers row ${i + 2}: missing teacher_id or teacher_name`,
        );
        return;
      }
      if (importedData.teachers.find((t) => t.id === id)) {
        warnings.push(
          `Teachers row ${i + 2}: duplicate teacher_id "${id}" skipped`,
        );
        return;
      }
      importedData.teachers.push({ id, name, dept, maxPeriods: maxP });
    });
  }

  // ── Parse classes ──
  importedData.classes = [];
  if (!rawClasses) {
    errors.push('Missing "classes" sheet. Expected a sheet named "classes".');
  } else {
    rawClasses.forEach((row, i) => {
      const gl = parseInt(row["grade_level"] || row["grade"] || 0);
      const sect = String(row["section_name"] || row["section"] || "").trim();
      if (!gl || !sect) {
        errors.push(
          `Classes row ${i + 2}: missing grade_level or section_name`,
        );
        return;
      }
      if (gl < 1 || gl > 12) {
        errors.push(`Classes row ${i + 2}: grade_level must be 1–12`);
        return;
      }
      const key = `${gl}__${sect}`;
      if (importedData.classes.find((c) => c.key === key)) {
        warnings.push(`Classes row ${i + 2}: duplicate ${gl}/${sect} skipped`);
        return;
      }
      importedData.classes.push({ key, grade: gl, section: sect });
    });
  }

  // ── Parse subjects ──
  importedData.subjects = [];
  if (!rawSubjects) {
    errors.push('Missing "subjects" sheet. Expected a sheet named "subjects".');
  } else {
    rawSubjects.forEach((row, i) => {
      const gl = parseInt(row["grade_level"] || row["grade"] || 0);
      const sect = String(row["section_name"] || row["section"] || "").trim();
      const code = String(row["subject_code"] || row["code"] || "")
        .trim()
        .toUpperCase();
      const name = String(row["subject_name"] || row["name"] || "").trim();
      const ppw = parseInt(row["periods_per_week"] || row["periods"] || 1) || 1;
      const dur =
        parseInt(
          row["duration_minutes"] ||
            row["duration"] ||
            row["duration_mins"] ||
            50,
        ) || 50;
      const tid = String(row["teacher_id"] || row["teacher"] || "").trim();
      if (!gl || !sect || !code || !name) {
        errors.push(`Subjects row ${i + 2}: missing required fields`);
        return;
      }
      // Warn if teacher not in teachers sheet
      if (tid && !importedData.teachers.find((t) => t.id === tid))
        warnings.push(
          `Subjects row ${i + 2}: teacher_id "${tid}" not found in teachers sheet`,
        );
      importedData.subjects.push({
        grade: gl,
        section: sect,
        code,
        name,
        periodsPerWeek: ppw,
        durationMinutes: dur,
        teacherId: tid,
      });
    });
  }

  // ── Build preview tabs ──
  const sections = ["teachers", "classes", "subjects"];
  const raws = {
    teachers: rawTeachers || [],
    classes: rawClasses || [],
    subjects: rawSubjects || [],
  };
  document.getElementById("previewSection").style.display = "block";
  document.getElementById("sheetTabs").innerHTML = sections
    .map(
      (s) =>
        `<div class="stab ${s === previewSheet ? "active" : ""}" onclick="switchPreview('${s}')">${s} <span style="opacity:.5">(${(raws[s] || []).length})</span></div>`,
    )
    .join("");
  renderPreviewTable(previewSheet, raws[previewSheet] || []);

  // ── Show messages ──
  const msgEl = document.getElementById("importMessages");
  let html = "";
  if (errors.length)
    html += errors.map((e) => `<div class="import-err">⚠ ${e}</div>`).join("");
  if (warnings.length)
    html += warnings
      .map(
        (w) =>
          `<div class="import-ok" style="background:rgba(255,184,48,.08);border-color:rgba(255,184,48,.2);color:var(--accent-y)">ℹ ${w}</div>`,
      )
      .join("");
  if (!errors.length)
    html += `<div class="import-ok">✓ ${importedData.teachers.length} teachers · ${importedData.classes.length} classes · ${importedData.subjects.length} subject rows — ready to apply</div>`;
  msgEl.innerHTML = html;
  document.getElementById("applyImportBtn").disabled = errors.length > 0;
}

function switchPreview(sheet) {
  previewSheet = sheet;
  document
    .querySelectorAll(".stab")
    .forEach((t, i) =>
      t.classList.toggle(
        "active",
        ["teachers", "classes", "subjects"][i] === sheet,
      ),
    );
  // Re-parse to get raw data
  const wb = importedWorkbook;
  const names = wb.SheetNames.map((n) => n.toLowerCase().trim());
  const findSheet = (...keys) => {
    for (const k of keys) {
      const idx = names.findIndex((n) => n.includes(k));
      if (idx >= 0)
        return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[idx]], {
          defval: "",
        });
    }
    return [];
  };
  const raws = {
    teachers: findSheet("teacher"),
    classes: findSheet("class", "section", "grade"),
    subjects: findSheet("subject"),
  };
  renderPreviewTable(sheet, raws[sheet] || []);
}

function renderPreviewTable(sheet, rows) {
  const tbl = document.getElementById("previewTable");
  if (!rows || rows.length === 0) {
    tbl.innerHTML =
      '<tr><td style="padding:20px;color:var(--text3);text-align:center">No data</td></tr>';
    return;
  }
  const keys = Object.keys(rows[0]);
  const maxRows = Math.min(rows.length, 50);
  tbl.innerHTML = `<thead><tr>${keys.map((k) => `<th>${k}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .slice(0, maxRows)
      .map(
        (r) => `<tr>${keys.map((k) => `<td>${r[k] ?? ""}</td>`).join("")}</tr>`,
      )
      .join("")}
    ${rows.length > maxRows ? `<tr><td colspan="${keys.length}" style="text-align:center;color:var(--text3);padding:8px">…and ${rows.length - maxRows} more rows</td></tr>` : ""}</tbody>`;
}

function applyImport() {
  const { teachers: iT, classes: iC, subjects: iS } = importedData;
  const GRADE_COLORS = {
    7: "#d94f1e",
    8: "#2e8a5a",
    9: "#5c3fa0",
    10: "#c48010",
    11: "#c02020",
    12: "#8c1e5a",
  };

  // 1. Merge teachers (add new, skip existing IDs)
  let added = 0;
  iT.forEach((t) => {
    if (!state.teachers.find((x) => x.id === t.id)) {
      state.teachers.push({ ...t, unavailability: t.unavailability || [] });
      added++;
    }
  });

  // 2. Build grade levels & sections from classes sheet
  iC.forEach((c) => {
    let grade = state.gradeLevels.find((g) => g.level === c.grade);
    if (!grade) {
      grade = {
        id: "g" + c.grade,
        level: c.grade,
        label: "Grade " + c.grade,
        color: GRADE_COLORS[c.grade] || "#888",
        sections: [],
      };
      state.gradeLevels.push(grade);
      state.gradeLevels.sort((a, b) => a.level - b.level);
    }
    if (!grade.sections.find((s) => s.name === c.section)) {
      grade.sections.push({
        id:
          "g" +
          c.grade +
          "_" +
          c.section.replace(/\s/g, "_") +
          "_" +
          Date.now(),
        name: c.section,
        subjects: [],
      });
    }
  });

  // 3. Attach subjects
  let sc = 0;
  iS.forEach((sub) => {
    const grade = state.gradeLevels.find((g) => g.level === sub.grade);
    if (!grade) return;
    const section = grade.sections.find((s) => s.name === sub.section);
    if (!section) return;
    if (!section.subjects.find((x) => x.code === sub.code)) {
      section.subjects.push({
        code: sub.code,
        name: sub.name,
        periodsPerWeek: sub.periodsPerWeek,
        durationMinutes: sub.durationMinutes || 50,
        teacherId: sub.teacherId,
        color: colorCounter++ % 10,
      });
      sc++;
    }
  });

  // 4. Refresh all UI
  renderGradeLevelManager();
  renderTeacherTable();
  drawTeacherLoadChart();
  updateTopChips();
  updateSchoolPreview();

  // 5. Mark import badge
  const nb = document.getElementById("nb-import");
  nb.style.display = "inline";

  // 6. Summary
  document.getElementById("importMessages").innerHTML =
    `<div class="import-ok">✅ Import applied — ${added} teachers added · ${iC.length} classes configured · ${sc} subjects loaded. Head to <strong>Generate</strong> when ready.</div>`;

  // Show toast
  setTimeout(() => showPanel("teachers"), 800);
}

// ── Template Download ──
function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1 – teachers
  const teachersData = [
    ["teacher_id", "teacher_name", "department", "max_periods_per_week"],
    ["T001", "Ms. Ana Reyes", "Mathematics", 30],
    ["T002", "Mr. Ben Santos", "English", 30],
    ["T003", "Ms. Carla Cruz", "Science", 28],
    ["T004", "Mr. Diego Dela Cruz", "Filipino", 28],
    ["T005", "Ms. Elena Bautista", "Social Studies", 25],
    ["T006", "Mr. Frank Garcia", "TLE", 25],
    ["T007", "Coach Grace Torres", "MAPEH", 22],
    ["T008", "Ms. Helen Lopez", "Values Education", 20],
  ];
  const wsT = XLSX.utils.aoa_to_sheet(teachersData);
  wsT["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 22 }];
  styleHeaderRow(wsT, teachersData[0].length);
  XLSX.utils.book_append_sheet(wb, wsT, "teachers");

  // Sheet 2 – classes
  const classesData = [
    ["grade_level", "section_name"],
    [7, "Section A"],
    [7, "Section B"],
    [7, "Section C"],
    [8, "Section A"],
    [8, "Section B"],
    [9, "Section A"],
    [9, "Section B"],
    [10, "Section A"],
    [10, "Section B"],
  ];
  const wsC = XLSX.utils.aoa_to_sheet(classesData);
  wsC["!cols"] = [{ wch: 14 }, { wch: 16 }];
  styleHeaderRow(wsC, classesData[0].length);
  XLSX.utils.book_append_sheet(wb, wsC, "classes");

  // Sheet 3 – subjects (one row per class-subject combo)
  const subRows = [
    [
      "grade_level",
      "section_name",
      "subject_code",
      "subject_name",
      "periods_per_week",
      "duration_minutes",
      "teacher_id",
    ],
  ];
  const baseSubjects = [
    ["MATH", "Mathematics", 5, 60, "T001"],
    ["ENG", "English Language", 5, 60, "T002"],
    ["SCI", "Integrated Science", 4, 60, "T003"],
    ["FIL", "Filipino", 4, 60, "T004"],
    ["AP", "Araling Panlipunan", 3, 50, "T005"],
    ["TLE", "Technology & Livelihood", 2, 90, "T006"],
    ["MAPEH", "MAPEH", 2, 90, "T007"],
    ["ESP", "ESP / Values Education", 1, 50, "T008"],
  ];
  [
    [7, "Section A"],
    [7, "Section B"],
    [7, "Section C"],
    [10, "Section A"],
    [10, "Section B"],
  ].forEach(([gl, sect]) => {
    baseSubjects.forEach(([code, name, ppw, dur, tid]) => {
      subRows.push([gl, sect, code + gl, name, ppw, dur, tid]);
    });
  });
  const wsS = XLSX.utils.aoa_to_sheet(subRows);
  wsS["!cols"] = [
    { wch: 13 },
    { wch: 14 },
    { wch: 13 },
    { wch: 26 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
  ];
  styleHeaderRow(wsS, subRows[0].length);
  XLSX.utils.book_append_sheet(wb, wsS, "subjects");

  XLSX.writeFile(wb, "ScheduleForge_Template.xlsx");
}

function styleHeaderRow(ws, cols) {
  // Bold header cells
  for (let c = 0; c < cols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "1A1E2A" } },
      alignment: { horizontal: "center" },
    };
  }
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
renderBreaks();
updateSchoolPreview();
renderConstraints();
selAlgo("ga");
renderGradeLevelManager();
