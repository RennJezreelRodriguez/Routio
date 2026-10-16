import React from 'react';
import { BottomSheet } from './Components/BottomSheet.jsx';
import InstallPrompt from './InstallPrompt.jsx';
import BackupReminder from './BackupReminder.jsx';

// ==========================================================================
// 1. Helpers & Local-Time Date Storage Setup
// ==========================================================================
if (!window.storage) {
  window.storage = {
    async get(key) {
      const val = localStorage.getItem(key);
      return val ? { value: val } : null;
    },
    async set(key, value) {
      localStorage.setItem(key, value);
    }
  };
}

const DEFAULT_CATEGORIES = [
  { key: 'health', label: 'Health', icon: '♥', units: ['kg', 'lbs', 'reps', 'km'] },
  { key: 'finance', label: 'Finance', icon: '◆', units: ['$', '€', '£', '₱', '¥', '₹'] },
  { key: 'growth', label: 'Growth', icon: '⊙', units: ['pages', 'courses', 'hrs'] },
  { key: 'career', label: 'Career', icon: '★', units: ['projects', 'hrs', 'clients'] },
];

const GOAL_TYPES = [
  { key: 'measurable', name: 'Track by numbers', desc: "A starting point and a target you're working toward." },
  { key: 'milestone', name: 'Track by checkpoints', desc: "A series of steps you'll complete along the way." },
  { key: 'habit', name: 'Track by consistency', desc: "Something you'll show up for again and again." },
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MOTIVATIONAL_QUOTES = [
  "Small daily improvements over time lead to stunning results.",
  "Consistency is what transforms averages into excellence.",
  "You didn't come this far only to come this far.",
  "Focus on the step in front of you, not the whole staircase.",
  "Discipline is choosing between what you want now and what you want most."
];

function uid() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  if (window.crypto && window.crypto.getRandomValues) {
    return 'id_' + Array.from(window.crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
  }
  return "id_" + Math.random().toString(36).slice(2, 10);
}

function formatDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayKey() {
  return formatDateKey(new Date());
}

function formatPrettyDate(dateKey) {
  if (!dateKey) return "";
  const [y, m, d] = dateKey.split("-");
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  return dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function isActionScheduledForDay(action, dayIndex) {
  if (!action.scheduleType || action.scheduleType === "daily") return true;
  return Array.isArray(action.days) && action.days.includes(dayIndex);
}

function formatScheduleLabel(action) {
  if (!action.scheduleType || action.scheduleType === "daily") return "Daily";
  if (!action.days || action.days.length === 0) return "No days";
  if (action.days.length === 7) return "Daily";
  return action.days.map(i => DAYS_OF_WEEK[i]).join(", ");
}

function calculateValueProgress(goal) {
  const start = goal.startValue ?? 0;
  const target = goal.targetValue ?? 0;
  const current = goal.currentValue ?? start;

  if (target === start) return { pct: 100, direction: "flat" };

  const direction = target > start ? "up" : "down";
  const raw = direction === "up"
    ? ((current - start) / (target - start)) * 100
    : ((start - current) / (start - target)) * 100;

  return { pct: Math.max(0, Math.min(100, Math.round(raw))), direction };
}

function formatNum(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return 0;
  if (Number.isInteger(n)) return n;
  return Math.round(n * 100) / 100;
}

function getActionState(goal, dateKey, actionId) {
  return goal.history?.[dateKey]?.[actionId] || { completed: false, count: 0 };
}

function calculateGoalStats(goal) {
  const actions = goal.actions || [];
  if (actions.length === 0) return { streak: 0 };

  let streak = 0;
  let d = new Date();
  let missedDaysAllowed = 3; 

  while (true) {
    const key = formatDateKey(d);
    const dayIndex = d.getDay();
    const scheduledActions = actions.filter(a => isActionScheduledForDay(a, dayIndex));

    if (scheduledActions.length > 0) {
      const allDone = scheduledActions.every(a => {
        const state = getActionState(goal, key, a.id);
        if (a.type === "counter") {
          return (state.count || 0) >= (a.target || 1);
        }
        return state.completed;
      });

      if (allDone) {
        streak++;
        missedDaysAllowed = 3; 
      } else {
        if (key === getTodayKey()) {
          // Keep checking past days
        } else {
          missedDaysAllowed--;
          if (missedDaysAllowed < 0) {
            break; 
          }
        }
      }
    }

    d.setDate(d.getDate() - 1);
    if (streak > 365) break;
  }

  return { streak };
}

function getCurrentWeekDates() {
  const now = new Date();
  const currentDay = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - currentDay);

  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    weekDates.push({
      dayName: DAYS_OF_WEEK[i],
      dateKey: formatDateKey(d),
      dayIndex: i
    });
  }
  return weekDates;
}

function getCurrentMonthDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const monthDates = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    monthDates.push({
      dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
      dayNum: i,
      dateKey: formatDateKey(d),
      dayIndex: d.getDay()
    });
  }
  return monthDates;
}

function SymbolButton({ symbol, label, onClick, hasBadge }) {
  return (
    <div className="icon-btn-wrapper" data-tooltip={label}>
      <button className="icon-btn smooth-transition" onClick={onClick} type="button">
        {symbol}
        {hasBadge && <span className="dot-badge" />}
      </button>
    </div>
  );
}

function ValueProgressBar({ goal }) {
  if (goal.targetValue === undefined || goal.targetValue === null || goal.targetValue === "" || Number.isNaN(Number(goal.targetValue))) {
    return null;
  }

  const { pct } = React.useMemo(
    () => calculateValueProgress(goal),
    [goal.currentValue, goal.startValue, goal.targetValue]
  );

  return (
    <div className="goal-progress-inline">
      <div className="goal-progress-track">
        <div className="goal-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="goal-progress-label">
        {formatNum(goal.currentValue)}{goal.unit} / {formatNum(goal.targetValue)}{goal.unit} ({pct}%)
      </span>
    </div>
  );
}

function ValueLogModal({ goal, onSubmit, onClose }) {
  const [mode, setMode] = React.useState("change");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");

  function submit() {
    const num = Number(amount);
    if (Number.isNaN(num) || amount.trim() === "") return;

    const resultingValue = mode === "change" ? goal.currentValue + num : num;
    const delta = mode === "change" ? num : num - goal.currentValue;

    onSubmit({ delta, resultingValue, note: note.trim() });
  }

  return (
    <BottomSheet isOpen={true} onClose={onClose} title="Log a Progress Update">
      <div className="value-log-tabs">
        <button
          type="button"
          className={`value-log-tab smooth-transition ${mode === "change" ? "active" : ""}`}
          onClick={() => setMode("change")}
        >
          +/- Change
        </button>
        <button
          type="button"
          className={`value-log-tab smooth-transition ${mode === "total" ? "active" : ""}`}
          onClick={() => setMode("total")}
        >
          New Total
        </button>
      </div>

      <label className="field">
        <span>
          {mode === "change"
            ? `Amount${goal.unit ? ` (${goal.unit})` : ""}`
            : `New Total${goal.unit ? ` (${goal.unit})` : ""}`}
        </span>
        <input
          type="number"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          autoFocus
        />
      </label>

      <label className="field">
        <span>Note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className="modal-actions">
        <div className="spacer" />
        <button className="btn ghost smooth-transition" onClick={onClose}>Cancel</button>
        <button className="btn primary smooth-transition" onClick={submit}>Save</button>
      </div>
    </BottomSheet>
  );
}

function CompletionModal({ goalTitle, onClose }) {
  const randomQuote = React.useMemo(() => {
    return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  }, []);

  return (
    <BottomSheet isOpen={true} onClose={onClose} title="Milestone Achieved">
      <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
        <h3 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "20px", marginBottom: "8px" }}>
          Incredible work on "{goalTitle}"!
        </h3>
        <p style={{ fontSize: "13px", color: "var(--graphite)", fontStyle: "italic", lineHeight: "1.5", margin: "16px 0" }}>
          "{randomQuote}"
        </p>
      </div>

      <div className="modal-actions">
        <div className="spacer" />
        <button className="btn primary smooth-transition" onClick={onClose} style={{ width: "100%" }}>
          Continue Journey
        </button>
      </div>
    </BottomSheet>
  );
}

function ValueHistoryList({ goal, onDeleteEntry }) {
  const entries = [...(goal.valueLog || [])].reverse();

  if (entries.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--graphite)", textAlign: "center", padding: "20px 0" }}>
        No progress updates logged yet.
      </div>
    );
  }

  return (
    <div className="value-history-list">
      {entries.map(entry => (
        <div key={entry.id} className="value-history-item smooth-transition">
          <div className="value-history-main">
            <span className={`value-history-delta ${entry.delta >= 0 ? "positive" : "negative"}`}>
              {entry.delta >= 0 ? "+" : ""}{formatNum(entry.delta)}{goal.unit}
            </span>
            <span className="value-history-date">
              {formatPrettyDate(formatDateKey(new Date(entry.date)))}
            </span>
          </div>
          <div className="value-history-sub">
            <span>→ {formatNum(entry.resultingValue)}{goal.unit}</span>
            {entry.note && <span className="value-history-note">{entry.note}</span>}
          </div>
          <button
            className="value-history-delete smooth-transition"
            onClick={() => onDeleteEntry(entry.id)}
            aria-label="Delete entry"
            title="Delete entry"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ==========================================================================
// 2. Goal Modal
// ==========================================================================
function GoalModal({ goalToEdit, categories, onSave, onClose }) {
  const isEditing = !!goalToEdit;
  const [step, setStep] = React.useState(1);
  const [title, setTitle] = React.useState(goalToEdit?.title || "");
  const [category, setCategory] = React.useState(goalToEdit?.category || categories[0]?.label || "Growth");
  const [goalType, setGoalType] = React.useState(goalToEdit?.goalType || (goalToEdit?.actions?.length > 0 ? 'habit' : 'measurable'));
  
  const [startVal, setStartVal] = React.useState(goalToEdit?.startValue ?? "");
  const [targetVal, setTargetVal] = React.useState(goalToEdit?.targetValue ?? "");
  const [selectedUnit, setSelectedUnit] = React.useState(goalToEdit?.unit || "");
  const [milestones, setMilestones] = React.useState(
    goalToEdit?.actions?.map(a => a.name) || ["", ""]
  );
  
  const [hasDeadline, setHasDeadline] = React.useState(!!goalToEdit?.targetDate);
  const [targetDate, setTargetDate] = React.useState(goalToEdit?.targetDate || "");

  const [showReveal, setShowReveal] = React.useState(false);
  const [preparedGoalData, setPreparedGoalData] = React.useState(null);

  const selectedCatObj = categories.find(c => c.label === category) || categories[0];

  function handleNext() {
    if (step === 1 && (!title.trim() || !category)) return;
    if (step === 2 && !goalType) return;
    
    if (step === 3) {
      if (goalType === 'measurable' && targetVal === "") return;
      if (goalType === 'milestone' && milestones.filter(m => m.trim()).length === 0) return;
    }

    if (step === 2 && goalType === 'habit') {
      setStep(4);
      return;
    }

    if (step < 4) {
      setStep(step + 1);
    } else {
      const useNumbers = goalType === 'measurable' && targetVal !== "";
      const start = useNumbers ? (Number(startVal) || 0) : 0;
      const target = useNumbers ? Number(targetVal) : null;

      let actions = goalToEdit?.actions || [];
      if (!isEditing || actions.length === 0) {
        actions = [];
        if (goalType === 'habit') {
          actions.push({
            id: uid(),
            name: title.trim(),
            type: 'checkbox',
            target: 1,
            step: 1,
            unit: '',
            scheduleType: 'daily',
            days: [0, 1, 2, 3, 4, 5, 6]
          });
        } else if (goalType === 'milestone') {
          milestones.filter(m => m.trim()).forEach(m => {
            actions.push({
              id: uid(),
              name: m.trim(),
              type: 'checkbox',
              target: 1,
              step: 1,
              unit: '',
              scheduleType: 'daily',
              days: [0, 1, 2, 3, 4, 5, 6]
            });
          });
        }
      }

      const constructedGoal = {
        id: goalToEdit ? goalToEdit.id : uid(),
        title: title.trim(),
        category: selectedCatObj ? selectedCatObj.label : "Growth",
        archived: goalToEdit ? goalToEdit.archived : false,
        completed: goalToEdit ? goalToEdit.completed : false,
        goalType,
        unit: useNumbers ? selectedUnit.trim() : "",
        startValue: start,
        targetValue: target,
        currentValue: goalToEdit ? goalToEdit.currentValue : start,
        valueLog: goalToEdit ? goalToEdit.valueLog : [],
        actions,
        history: goalToEdit ? goalToEdit.history : {},
        notes: goalToEdit ? goalToEdit.notes : {},
        targetDate: hasDeadline ? targetDate : null
      };

      setPreparedGoalData(constructedGoal);
      onSave(constructedGoal, false);

      if (isEditing) {
        onClose();
      } else {
        setShowReveal(true);
      }
    }
  }

  function handleFinalize() {
    if (preparedGoalData) {
      onSave(preparedGoalData, true);
    }
  }

  return (
    <BottomSheet isOpen={true} onClose={onClose} title={isEditing ? "Edit Goal Workspace" : "New Goal Workspace"}>
      <div style={{ padding: "10px 4px 6px", minHeight: "260px" }}>
        {!showReveal ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                {[1, 2, 3, 4].map(i => (
                  <div 
                    key={i} 
                    style={{ 
                      width: i === step ? "16px" : "6px", 
                      height: "6px", 
                      borderRadius: i === step ? "3px" : "50%", 
                      background: i === step ? "var(--ink)" : i < step ? "var(--graphite)" : "var(--line)",
                      transition: "all 1s cubic-bezier(0.16, 1, 0.3, 1)"
                    }} 
                  />
                ))}
              </div>
            </div>

            {step === 1 && (
              <div>
                <div style={{ fontSize: "13px", color: "var(--graphite)", marginBottom: "10px" }}>What are you working toward?</div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNext(); }}
                  placeholder="Name your goal"
                  autoFocus
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--line)",
                    color: "var(--ink)",
                    fontFamily: "Fraunces, Georgia, serif",
                    fontSize: "24px",
                    fontWeight: 450,
                    padding: "6px 2px 14px",
                    outline: "none",
                    marginBottom: "22px"
                  }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                  {categories.map(c => {
                    const isSelected = category === c.label;
                    return (
                      <div
                        key={c.key || c.label}
                        onClick={() => setCategory(c.label)}
                        className="smooth-transition"
                        style={{
                          background: isSelected ? "var(--paper)" : "var(--card)",
                          border: `1px solid ${isSelected ? "var(--ink)" : "var(--line)"}`,
                          borderRadius: "12px",
                          padding: "14px 6px 10px",
                          textAlign: "center",
                          cursor: "pointer"
                        }}
                      >
                        <span style={{ fontSize: "20px", marginBottom: "6px", display: "block" }}>{c.icon}</span>
                        <span style={{ fontSize: "11px", color: isSelected ? "var(--ink)" : "var(--graphite)" }}>{c.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div style={{ fontSize: "13px", color: "var(--graphite)", marginBottom: "14px" }}>How do you want to be held accountable?</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {GOAL_TYPES.map(t => {
                    const isSelected = goalType === t.key;
                    return (
                      <div
                        key={t.key}
                        onClick={() => setGoalType(t.key)}
                        className="smooth-transition"
                        style={{
                          background: isSelected ? "var(--paper)" : "var(--card)",
                          border: `1px solid ${isSelected ? "var(--ink)" : "var(--line)"}`,
                          borderRadius: "12px",
                          padding: "16px 18px",
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ fontSize: "15px", fontWeight: 500, marginBottom: "3px" }}>{t.name}</div>
                        <div style={{ fontSize: "12.5px", color: "var(--graphite)", lineHeight: "1.4" }}>{t.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && goalType !== 'habit' && (
              <div>
                <div style={{ fontSize: "13px", color: "var(--graphite)", marginBottom: "14px" }}>
                  {goalType === 'measurable' ? 'Set your numbers' : 'Lay out your checkpoints'}
                </div>

                {goalType === 'measurable' && (
                  <div>
                    <div className="field-row">
                      <label className="field">
                        <span>Starting point</span>
                        <input type="number" value={startVal} onChange={(e) => setStartVal(e.target.value)} />
                      </label>
                      <label className="field">
                        <span>Target</span>
                        <input type="number" value={targetVal} onChange={(e) => setTargetVal(e.target.value)} />
                      </label>
                    </div>
                    {selectedCatObj && selectedCatObj.units && (
                      <>
                        <label style={{ fontSize: "11.5px", color: "var(--graphite)", display: "block", margin: "14px 0 6px" }}>Unit / Currency</label>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                          {selectedCatObj.units.map(u => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setSelectedUnit(u)}
                              className="smooth-transition"
                              style={{
                                fontSize: "12px",
                                padding: "6px 12px",
                                borderRadius: "20px",
                                border: `1px solid ${selectedUnit === u ? "var(--ink)" : "var(--line)"}`,
                                color: selectedUnit === u ? "var(--ink)" : "var(--graphite)",
                                background: selectedUnit === u ? "var(--paper)" : "transparent",
                                cursor: "pointer"
                              }}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={selectedUnit}
                          onChange={(e) => setSelectedUnit(e.target.value)}
                          placeholder="Or type any custom currency or unit..."
                          style={{
                            width: "100%",
                            background: "var(--card)",
                            border: "1px solid var(--line)",
                            borderRadius: "9px",
                            color: "var(--ink)",
                            padding: "9px 12px",
                            fontSize: "13.5px",
                            outline: "none"
                          }}
                        />
                      </>
                    )}
                  </div>
                )}

                {goalType === 'milestone' && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {milestones.map((ms, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="text"
                          value={ms}
                          onChange={(e) => {
                            const updated = [...milestones];
                            updated[idx] = e.target.value;
                            setMilestones(updated);
                          }}
                          placeholder={`Checkpoint ${idx + 1}`}
                          style={{
                            flex: 1,
                            background: "var(--card)",
                            border: "1px solid var(--line)",
                            borderRadius: "9px",
                            color: "var(--ink)",
                            padding: "9px 12px",
                            fontSize: "13.5px",
                            outline: "none"
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setMilestones(milestones.filter((_, i) => i !== idx))}
                          aria-label="Remove checkpoint"
                          style={{ background: "none", border: "none", color: "var(--graphite)", cursor: "pointer", fontSize: "18px", width: "40px", height: "40px", flexShrink: 0 }}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMilestones([...milestones, ''])}
                      style={{
                        marginTop: "4px",
                        background: "none",
                        border: "1px dashed var(--line)",
                        color: "var(--graphite)",
                        borderRadius: "9px",
                        padding: "9px",
                        fontSize: "12.5px",
                        cursor: "pointer",
                        width: "100%"
                      }}
                    >
                      + add a checkpoint
                    </button>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div style={{ textAlign: "center", padding: "6px 0 4px" }}>
                <div style={{ fontSize: "12.5px", color: "var(--graphite)", marginBottom: "14px", letterSpacing: "0.02em" }}>You're committing to</div>
                <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "28px", fontWeight: 450, lineHeight: 1.25, marginBottom: "18px" }}>
                  {title || "Untitled goal"}
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: "18px", fontSize: "12.5px", color: "var(--graphite)", marginBottom: "20px" }}>
                  <span>{selectedCatObj ? selectedCatObj.label : "—"}</span>
                  {goalType === 'measurable' && <span><b>{startVal || 0}</b> &rarr; <b>{targetVal || '?'}</b> {selectedUnit}</span>}
                  {goalType === 'milestone' && <span><b>{milestones.filter(m => m.trim()).length}</b> checkpoints</span>}
                  {goalType === 'habit' && <span><b>Consistency Habit</b></span>}
                </div>

                <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px", textAlign: "left" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13.5px", cursor: "pointer", marginBottom: "10px" }}>
                    <input
                      type="checkbox"
                      checked={hasDeadline}
                      onChange={(e) => setHasDeadline(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "var(--ink)", cursor: "pointer" }}
                    />
                    <span>Set a Target Deadline</span>
                  </label>
                  {hasDeadline && (
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      style={{
                        width: "100%",
                        background: "var(--card)",
                        border: "1px solid var(--line)",
                        borderRadius: "9px",
                        color: "var(--ink)",
                        padding: "9px 12px",
                        fontSize: "13.5px",
                        outline: "none"
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "30px" }}>
              <button
                type="button"
                onClick={() => {
                  if (step === 4 && goalType === 'habit') {
                    setStep(2);
                  } else {
                    setStep(step - 1);
                  }
                }}
                style={{ background: "none", border: "none", color: "var(--graphite)", fontSize: "13.5px", cursor: "pointer", visibility: step === 1 ? "hidden" : "visible" }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="smooth-transition"
                style={{
                  background: "var(--ink)",
                  color: "var(--card)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "11px 22px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                {step === 4 ? (isEditing ? "Save changes" : "Create goal") : "Continue"}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0 10px" }}>
            <div style={{ width: "46px", height: "46px", borderRadius: "50%", border: "1px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "var(--ink)", fontSize: "20px" }}>✓</div>
            <div style={{ fontSize: "12px", color: "var(--graphite)", letterSpacing: "0.06em", marginBottom: "10px" }}>DAY 1 OF YOUR JOURNEY</div>
            <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "26px", marginBottom: "22px" }}>{title}</div>
            <div style={{ height: "5px", background: "var(--paper)", borderRadius: "3px", overflow: "hidden", marginBottom: "26px" }}>
              <div style={{ height: "100%", width: "100%", background: "var(--ink)", transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)" }} />
            </div>
            <button
              type="button"
              onClick={handleFinalize}
              className="smooth-transition"
              style={{
                background: "var(--ink)",
                color: "var(--card)",
                border: "none",
                borderRadius: "10px",
                padding: "11px 22px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                width: "100%"
              }}
            >
              View goal
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

// ==========================================================================
// 2.5 Stepped Action Modal
// ==========================================================================
const DAY_LABELS_MAP = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };
const DAY_INDEX_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function SteppedActionModal({ initialAction, onSave, onDelete, onClose }) {
  const isEdit = !!initialAction;
  const [modalStep, setModalStep] = React.useState(1);
  const totalModalSteps = 3;

  const [name, setName] = React.useState(initialAction?.name || "");
  const [type, setType] = React.useState(initialAction?.type || "checkbox");
  const [countTarget, setCountTarget] = React.useState(initialAction?.target > 1 ? initialAction.target : "");
  const [freq, setFreq] = React.useState(initialAction?.scheduleType === "specific" ? "specific" : "everyday");
  
  const initialDaysStr = initialAction?.days 
    ? Object.keys(DAY_INDEX_MAP).filter(k => initialAction.days.includes(DAY_INDEX_MAP[k]))
    : [];
  const [selectedDays, setSelectedDays] = React.useState(initialDaysStr);

  function toggleDayChip(dayKey) {
    if (selectedDays.includes(dayKey)) {
      setSelectedDays(selectedDays.filter(d => d !== dayKey));
    } else {
      setSelectedDays([...selectedDays, dayKey]);
    }
  }

  function isStepValid() {
    if (modalStep === 1) {
      if (!name.trim() || !type) return false;
      if (type === 'counter' && (!countTarget || Number(countTarget) <= 0)) return false;
      return true;
    }
    if (modalStep === 2) {
      if (freq === 'everyday') return true;
      if (freq === 'specific' && selectedDays.length > 0) return true;
      return false;
    }
    return true;
  }

  function handleNext() {
    if (!isStepValid()) return;
    if (modalStep < totalModalSteps) {
      setModalStep(modalStep + 1);
    } else {
      const daysIndices = freq === 'everyday' 
        ? [0, 1, 2, 3, 4, 5, 6] 
        : selectedDays.map(d => DAY_INDEX_MAP[d]);

      onSave({
        id: initialAction?.id || uid(),
        name: name.trim(),
        type,
        target: type === 'checkbox' ? 1 : Number(countTarget) || 1,
        step: 1,
        unit: '',
        scheduleType: freq === 'everyday' ? 'daily' : 'specific',
        days: daysIndices,
      });
    }
  }

  function handleBack() {
    if (modalStep > 1) setModalStep(modalStep - 1);
  }

  return (
    <BottomSheet isOpen={true} onClose={onClose} title={isEdit ? "Edit Routine" : "Add Routine"}>
      <div style={{ padding: "10px 4px 6px", minHeight: "220px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                style={{ 
                  width: i === modalStep ? "16px" : "6px", 
                  height: "6px", 
                  borderRadius: i === modalStep ? "3px" : "50%", 
                  background: i === modalStep ? "var(--ink)" : i < modalStep ? "var(--graphite)" : "var(--line)",
                  transition: "all 1s cubic-bezier(0.16, 1, 0.3, 1)"
                }} 
              />
            ))}
          </div>
        </div>

        {modalStep === 1 && (
          <div>
            <input
              type="text"
              className="name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNext(); }}
              placeholder="Name this routine"
              autoFocus
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--line)",
                color: "var(--ink)",
                fontFamily: "Fraunces, Georgia, serif",
                fontSize: "22px",
                padding: "4px 2px 12px",
                outline: "none"
              }}
            />
            <div className="type-toggle" style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
              <div
                className={`type-opt smooth-transition ${type === 'checkbox' ? 'selected' : ''}`}
                onClick={() => setType('checkbox')}
                style={{
                  flex: 1,
                  background: type === 'checkbox' ? "var(--paper)" : "var(--card)",
                  border: `1px solid ${type === 'checkbox' ? "var(--ink)" : "var(--line)"}`,
                  borderRadius: "10px",
                  padding: "10px",
                  textAlign: "center",
                  cursor: "pointer",
                  fontSize: "13.5px",
                  color: type === 'checkbox' ? "var(--ink)" : "var(--graphite)"
                }}
              >
                Check off
              </div>
              <div
                className={`type-opt smooth-transition ${type === 'counter' ? 'selected' : ''}`}
                onClick={() => setType('counter')}
                style={{
                  flex: 1,
                  background: type === 'counter' ? "var(--paper)" : "var(--card)",
                  border: `1px solid ${type === 'counter' ? "var(--ink)" : "var(--line)"}`,
                  borderRadius: "10px",
                  padding: "10px",
                  textAlign: "center",
                  cursor: "pointer",
                  fontSize: "13.5px",
                  color: type === 'counter' ? "var(--ink)" : "var(--graphite)"
                }}
              >
                Count a number
              </div>
            </div>

            {type === 'counter' && (
              <div className="count-field" style={{ marginTop: "16px", display: "block" }}>
                <input
                  type="number"
                  value={countTarget}
                  onChange={(e) => setCountTarget(e.target.value)}
                  placeholder="Target per log"
                  style={{
                    width: "100%",
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderRadius: "9px",
                    color: "var(--ink)",
                    padding: "10px 12px",
                    fontSize: "13.5px",
                    outline: "none"
                  }}
                />
              </div>
            )}
          </div>
        )}

        {modalStep === 2 && (
          <div>
            <div className="freq-toggle" style={{ display: "flex", gap: "8px" }}>
              <div
                className={`freq-opt smooth-transition ${freq === 'everyday' ? 'selected' : ''}`}
                onClick={() => setFreq('everyday')}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "12px",
                  borderRadius: "10px",
                  border: `1px solid ${freq === 'everyday' ? "var(--ink)" : "var(--line)"}`,
                  color: freq === 'everyday' ? "var(--ink)" : "var(--graphite)",
                  background: freq === 'everyday' ? "var(--paper)" : "transparent",
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                Everyday
              </div>
              <div
                className={`freq-opt smooth-transition ${freq === 'specific' ? 'selected' : ''}`}
                onClick={() => setFreq('specific')}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "12px",
                  borderRadius: "10px",
                  border: `1px solid ${freq === 'specific' ? "var(--ink)" : "var(--line)"}`,
                  color: freq === 'specific' ? "var(--ink)" : "var(--graphite)",
                  background: freq === 'specific' ? "var(--paper)" : "transparent",
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                Specific days
              </div>
            </div>

            {freq === 'specific' && (
              <div className="day-picker show" style={{ display: "flex", gap: "6px", marginTop: "14px" }}>
                {Object.keys(DAY_INDEX_MAP).map(dKey => {
                  const isSelected = selectedDays.includes(dKey);
                  return (
                    <div
                      key={dKey}
                      className={`day-chip smooth-transition ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleDayChip(dKey)}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        padding: "9px 0",
                        borderRadius: "9px",
                        border: `1px solid ${isSelected ? "var(--ink)" : "var(--line)"}`,
                        color: isSelected ? "var(--ink)" : "var(--graphite)",
                        background: isSelected ? "var(--paper)" : "transparent",
                        fontSize: "12px",
                        cursor: "pointer",
                        textTransform: "uppercase"
                      }}
                    >
                      {dKey[0]}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {modalStep === 3 && (
          <div className="confirm-wrap" style={{ textAlign: "center", padding: "8px 0" }}>
            <div className="confirm-title" style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "22px", marginBottom: "10px" }}>{name}</div>
            <div className="confirm-sub" style={{ fontSize: "13px", color: "var(--graphite)" }}>
              {type === 'checkbox' ? 'Check off' : `Log a number (target ${countTarget})`} &middot; <b>{freq === 'everyday' ? 'every day' : selectedDays.map(d => DAY_LABELS_MAP[d]).join(', ')}</b>
            </div>
          </div>
        )}

        <div className="modal-btn-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "26px" }}>
          <button
            type="button"
            onClick={handleBack}
            style={{ background: "none", border: "none", color: "var(--graphite)", fontSize: "13px", cursor: "pointer", visibility: modalStep === 1 ? "hidden" : "visible" }}
          >
            Back
          </button>
          {isEdit && modalStep === 1 && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete routine "${initialAction.name}"?`)) {
                  onDelete(initialAction.id);
                }
              }}
              style={{ background: "none", border: "none", color: "var(--danger)", fontSize: "13px", cursor: "pointer" }}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            disabled={!isStepValid()}
            onClick={handleNext}
            className="smooth-transition"
            style={{
              background: isStepValid() ? "var(--ink)" : "var(--card)",
              color: isStepValid() ? "var(--card)" : "var(--graphite)",
              border: "none",
              borderRadius: "10px",
              padding: "10px 20px",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: isStepValid() ? "pointer" : "not-allowed"
            }}
          >
            {modalStep === totalModalSteps ? (isEdit ? "Save" : "Add routine") : "Continue"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ==========================================================================
// 2.6 Categories Management Modal
// ==========================================================================
function CategoriesModal({ categories, goals, onUpdateCategories, onClose }) {
  const [catList, setCatList] = React.useState(categories);
  const [newLabel, setNewLabel] = React.useState("");
  const [newIcon, setNewIcon] = React.useState("⭐");

  function handleAdd() {
    if (!newLabel.trim()) return;
    const key = newLabel.toLowerCase().replace(/\s+/g, '_');
    if (catList.some(c => c.key === key)) return;
    const updated = [...catList, { key, label: newLabel.trim(), icon: newIcon || '📌', units: ['units'] }];
    setCatList(updated);
    setNewLabel("");
    onUpdateCategories(updated);
  }

  function handleRemove(key) {
    if (catList.length <= 1) {
      alert("You must keep at least one category.");
      return;
    }
    const target = catList.find(c => c.key === key);
    const affectedCount = (goals || []).filter(g => !g.archived && g.category === target?.label).length;
    if (affectedCount > 0) {
      const ok = confirm(
        `${affectedCount} goal${affectedCount === 1 ? "" : "s"} currently use "${target.label}". ` +
        `They'll keep that label but won't show up when filtering by category anymore. Remove it anyway?`
      );
      if (!ok) return;
    }
    const updated = catList.filter(c => c.key !== key);
    setCatList(updated);
    onUpdateCategories(updated);
  }

  return (
    <BottomSheet isOpen={true} onClose={onClose} title="Manage Categories">
      <div style={{ padding: "10px 0" }}>
        <p style={{ fontSize: "13px", color: "var(--graphite)", marginBottom: "16px" }}>Add custom categories or remove old ones.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto", marginBottom: "16px" }}>
          {catList.map(c => (
            <div key={c.key} className="smooth-transition" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card)", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <span>{c.icon} {c.label}</span>
              <button onClick={() => handleRemove(c.key)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "13px" }}>Remove</button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
          <input
            type="text"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="Icon"
            style={{ width: "50px", textAlign: "center", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "8px", color: "var(--ink)" }}
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Category Name"
            style={{ flex: 1, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "8px", padding: "8px 12px", color: "var(--ink)", outline: "none" }}
          />
          <button onClick={handleAdd} className="btn primary smooth-transition" style={{ padding: "8px 14px" }}>Add</button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ==========================================================================
// 2.7 Error Boundary — keeps one corrupted goal from blanking the whole app
// ==========================================================================
class WorkspaceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("Routio workspace error:", error, info);
  }
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "20px", marginBottom: "10px" }}>
            Something went wrong loading this goal.
          </div>
          <p style={{ fontSize: "13px", color: "var(--graphite)", marginBottom: "20px" }}>
            Its data may be corrupted or from an incompatible backup. Your other goals are unaffected.
          </p>
          <button className="btn primary smooth-transition" onClick={this.props.onBack}>
            ← Back to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================================================
// 3. Goal Workspace Component
// ==========================================================================
function GoalWorkspace({ goal, categories, onBack, onUpdateGoal, onDeleteGoal, onArchiveGoal, onOpenEditGoal, originStyle }) {
  const [actionModalOpen, setActionModalOpen] = React.useState(false);
  const [goalSettingsModalOpen, setGoalSettingsModalOpen] = React.useState(false);
  const [valueLogModalOpen, setValueLogModalOpen] = React.useState(false);
  const [completionModalOpen, setCompletionModalOpen] = React.useState(false);
  const [editingAction, setEditingAction] = React.useState(null);
  const [selectedDateKey, setSelectedDateKey] = React.useState(getTodayKey());
  const [trackerMode, setTrackerMode] = React.useState("week"); 
  const [expandedDayKey, setExpandedDayKey] = React.useState(null);

  const [todayKey, setTodayKey] = React.useState(getTodayKey());
  React.useEffect(() => {
    function refreshToday() {
      setTodayKey(prev => {
        const current = getTodayKey();
        return prev === current ? prev : current;
      });
    }
    const interval = setInterval(refreshToday, 60 * 1000);
    document.addEventListener("visibilitychange", refreshToday);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshToday);
    };
  }, []);

  const [y, m, d] = selectedDateKey.split("-");
  const currentDateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const dayIndex = currentDateObj.getDay();

  const stats = React.useMemo(() => calculateGoalStats(goal), [goal, todayKey]);
  const weekDates = React.useMemo(() => getCurrentWeekDates(), [todayKey]);
  const monthDates = React.useMemo(() => getCurrentMonthDates(), [todayKey]);

  const daysLeft = React.useMemo(() => {
    if (!goal.targetDate) return null;
    const diff = new Date(goal.targetDate) - new Date(todayKey);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [goal.targetDate, todayKey]);

  function saveAction(action) {
    const safeActions = goal.actions || [];
    const exists = safeActions.some(a => a.id === action.id);
    const updatedActions = exists
      ? safeActions.map(a => a.id === action.id ? action : a)
      : [...safeActions, action];

    onUpdateGoal({ ...goal, actions: updatedActions });
    setActionModalOpen(false);
    setEditingAction(null);
  }

  function deleteAction(actionId) {
    if (!confirm("Delete this routine? Its logged history will be kept but it will no longer be tracked.")) return;
    const updatedActions = (goal.actions || []).filter(a => a.id !== actionId);
    onUpdateGoal({ ...goal, actions: updatedActions });
    setActionModalOpen(false);
    setEditingAction(null);
  }

  function toggleActionCheck(actionId) {
    const currentState = getActionState(goal, selectedDateKey, actionId);
    const updatedHistory = {
      ...(goal.history || {}),
      [selectedDateKey]: {
        ...(goal.history?.[selectedDateKey] || {}),
        [actionId]: { ...currentState, completed: !currentState.completed }
      }
    };
    onUpdateGoal({ ...goal, history: updatedHistory });
  }

  function incrementCounter(action, delta) {
    const currentState = getActionState(goal, selectedDateKey, action.id);
    const currentCount = currentState.count || 0;
    const nextCount = Math.max(0, currentCount + (delta * (action.step || 1)));
    const target = action.target || 1;

    const updatedHistory = {
      ...(goal.history || {}),
      [selectedDateKey]: {
        ...(goal.history?.[selectedDateKey] || {}),
        [action.id]: { ...currentState, count: nextCount, completed: nextCount >= target }
      }
    };
    onUpdateGoal({ ...goal, history: updatedHistory });
  }

  function handleNoteChange(dateKey, noteText) {
    const updatedNotes = {
      ...(goal.notes || {}),
      [dateKey]: noteText
    };
    onUpdateGoal({ ...goal, notes: updatedNotes });
  }

  function logValueUpdate({ delta, resultingValue, note }) {
    const entry = { id: uid(), date: new Date().toISOString(), delta, resultingValue, note };
    const newLog = [...(goal.valueLog || []), entry];
    onUpdateGoal({ ...goal, currentValue: resultingValue, valueLog: newLog });
    setValueLogModalOpen(false);
  }

  function deleteValueLogEntry(entryId) {
    if (!confirm("Delete this progress entry? This can't be undone.")) return;
    const newLog = (goal.valueLog || []).filter(e => e.id !== entryId);
    const recomputedValue = (goal.startValue ?? 0) + newLog.reduce((sum, e) => sum + e.delta, 0);
    onUpdateGoal({ ...goal, currentValue: recomputedValue, valueLog: newLog });
  }

  function getDayBreakdown(dateKey) {
    const [yr, mn, dy] = dateKey.split("-");
    const dateObj = new Date(Number(yr), Number(mn) - 1, Number(dy));
    const dIdx = dateObj.getDay();
    const scheduled = (goal.actions || []).filter(a => isActionScheduledForDay(a, dIdx));
    const done = [];
    const missed = [];

    scheduled.forEach(a => {
      const state = getActionState(goal, dateKey, a.id);
      const isFinished = a.type === "counter" ? (state.count || 0) >= (a.target || 1) : state.completed;
      if (isFinished) {
        done.push(a);
      } else {
        missed.push(a);
      }
    });

    return { scheduled, done, missed };
  }

  return (
    <div className="workspace smooth-transition" style={originStyle}>
      <div>
        <button className="back-btn smooth-transition" onClick={onBack}>← Back to Dashboard</button>
        <div className="workspace-header">
          <div>
            <div className="card-category">
              {goal.category} {goal.completed && "• Completed"}
              {daysLeft !== null && (
                <span className="smooth-transition" style={{ marginLeft: "8px", padding: "2px 6px", borderRadius: "6px", background: daysLeft < 0 ? "var(--danger-light, #fee2e2)" : "var(--paper)", color: daysLeft < 0 ? "var(--danger)" : "var(--graphite)", fontSize: "11px" }}>
                  {daysLeft < 0 ? "Deadline passed" : `${daysLeft} days left`}
                </span>
              )}
            </div>
            <h2 className="card-title" style={{ fontSize: 26, marginTop: 4 }}>{goal.title}</h2>
            <ValueProgressBar goal={goal} />
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <SymbolButton 
              symbol={goal.completed ? "↺" : "✓"} 
              label={goal.completed ? "Reopen Goal" : "Complete Goal"} 
              onClick={() => {
                const nextState = !goal.completed;
                onUpdateGoal({ ...goal, completed: nextState });
                if (nextState) setCompletionModalOpen(true);
              }} 
            />
            <SymbolButton symbol="⚙" label="Workspace Settings" onClick={() => setGoalSettingsModalOpen(true)} />
          </div>
        </div>
      </div>

      <div className="workspace-stats-bar">
        {goal.targetValue !== undefined && goal.targetValue !== null && goal.targetValue !== "" && !Number.isNaN(Number(goal.targetValue)) ? (
          <>
            <div className="stat-pill smooth-transition">
              <span className="label">Current Progress</span>
              <span className="value">{formatNum(goal.currentValue)}{goal.unit}</span>
            </div>
            <div className="stat-pill smooth-transition">
              <span className="label">Target Goal</span>
              <span className="value">{formatNum(goal.targetValue)}{goal.unit}</span>
            </div>
            <div className="stat-pill smooth-transition">
              <span className="label">Started At</span>
              <span className="value">{formatNum(goal.startValue)}{goal.unit}</span>
            </div>
          </>
        ) : (
          <div className="stat-pill smooth-transition" style={{ gridColumn: "span 3" }}>
            <span className="label">Status</span>
            <span className="value">{goal.completed ? "Achieved" : "Active"}</span>
          </div>
        )}
        <div className="stat-pill smooth-transition">
          <span className="label">Streak</span>
          <span className={`streak-badge ${stats.streak > 0 ? "lit" : "unlit"}`}>🔥 {stats.streak} days</span>
        </div>
      </div>

      <div className="action-section">
        <div className="section-title">
          <span>Habits & Routines</span>
          <SymbolButton symbol="+" label="Add Routine" onClick={() => { setEditingAction(null); setActionModalOpen(true); }} />
        </div>

        {(goal.actions || []).length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--graphite)", textAlign: "center", padding: "20px 0" }}>
            No routines configured yet. Add routines to help you reach this goal.
          </div>
        ) : (
          <div className="action-list">
            {(goal.actions || []).map((a) => {
              const isScheduled = isActionScheduledForDay(a, dayIndex);
              const state = getActionState(goal, selectedDateKey, a.id);

              return (
                <div key={a.id} className={`action-item smooth-transition ${!isScheduled ? "unscheduled" : ""}`} style={{ opacity: isScheduled ? 1 : 0.5 }}>
                  <div className="action-left" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {a.type === "counter" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button className="btn ghost smooth-transition" style={{ padding: "4px 10px" }} onClick={() => incrementCounter(a, -1)}>-</button>
                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: "60px", textAlign: "center" }}>{state.count || 0} / {a.target} {a.unit}</span>
                        <button className="btn ghost smooth-transition" style={{ padding: "4px 10px" }} onClick={() => incrementCounter(a, 1)}>+</button>
                      </div>
                    ) : (
                      <input
                        type="checkbox"
                        checked={!!state.completed}
                        onChange={() => toggleActionCheck(a.id)}
                        style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--ink)" }}
                      />
                    )}
                    <div>
                      <span className="action-label" style={{ textDecoration: state.completed ? "line-through" : "none", fontWeight: 500 }}>{a.name}</span>
                      <span className="action-schedule-tag">{formatScheduleLabel(a)}</span>
                    </div>
                  </div>
                  <div className="action-right">
                    <SymbolButton symbol="✎" label="Edit Routine" onClick={() => { setEditingAction(a); setActionModalOpen(true); }} />
                    <SymbolButton symbol="×" label="Delete Routine" onClick={() => deleteAction(a.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="action-section smooth-transition" style={{ background: "var(--card)", padding: "20px", borderRadius: "14px", border: "1px solid var(--line)" }}>
        <div className="section-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "15px", fontWeight: 600 }}>Timeline</span>
          <div className="value-log-tabs" style={{ margin: 0, width: "160px" }}>
            <button
              type="button"
              className={`value-log-tab smooth-transition ${trackerMode === "week" ? "active" : ""}`}
              onClick={() => { setTrackerMode("week"); setExpandedDayKey(null); }}
              style={{ padding: "6px 0", fontSize: "11px" }}
            >
              Week
            </button>
            <button
              type="button"
              className={`value-log-tab smooth-transition ${trackerMode === "month" ? "active" : ""}`}
              onClick={() => { setTrackerMode("month"); setExpandedDayKey(null); }}
              style={{ padding: "6px 0", fontSize: "11px" }}
            >
              Month
            </button>
          </div>
        </div>

        {trackerMode === "week" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "10px" }}>
            {weekDates.map(w => {
              const isSelected = selectedDateKey === w.dateKey;
              const isToday = w.dateKey === todayKey;
              const hasNote = !!goal.notes?.[w.dateKey];

              const scheduledActions = (goal.actions || []).filter(a => isActionScheduledForDay(a, w.dayIndex));
              const allDone = scheduledActions.length > 0 && scheduledActions.every(a => {
                const state = getActionState(goal, w.dateKey, a.id);
                return a.type === "counter" ? (state.count || 0) >= (a.target || 1) : state.completed;
              });
              const someDone = scheduledActions.some(a => {
                const state = getActionState(goal, w.dateKey, a.id);
                return a.type === "counter" ? (state.count || 0) > 0 : state.completed;
              });

              let statusBg = "var(--card)";
              let borderColor = "var(--line)";
              if (allDone) {
                statusBg = "var(--moss-light)";
                borderColor = "var(--moss)";
              } else if (someDone) {
                statusBg = "var(--paper)";
                borderColor = "var(--graphite)";
              }

              return (
                <button
                  key={w.dateKey}
                  onClick={() => {
                    if (isSelected && expandedDayKey === w.dateKey) {
                      setSelectedDateKey(todayKey);
                      setExpandedDayKey(null);
                    } else {
                      setSelectedDateKey(w.dateKey);
                      setExpandedDayKey(w.dateKey);
                    }
                  }}
                  className={`day-box smooth-transition ${hasNote ? "has-note" : ""}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "14px 4px",
                    borderRadius: "10px",
                    background: statusBg,
                    color: "inherit",
                    border: isSelected ? "2px solid var(--ink)" : `1px solid ${borderColor}`,
                    cursor: "pointer",
                    width: "100%",
                    height: "auto"
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--graphite)" }}>
                    {w.dayName}
                  </span>
                  {isToday && <span style={{ fontSize: "9px", fontWeight: 600, color: "var(--ink)", marginTop: "6px", background: "var(--line)", padding: "1px 6px", borderRadius: "4px" }}>Today</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" }}>
            {monthDates.map(w => {
              const isSelected = selectedDateKey === w.dateKey;
              const isToday = w.dateKey === todayKey;
              const hasNote = !!goal.notes?.[w.dateKey];

              const scheduledActions = (goal.actions || []).filter(a => isActionScheduledForDay(a, w.dayIndex));
              const allDone = scheduledActions.length > 0 && scheduledActions.every(a => {
                const state = getActionState(goal, w.dateKey, a.id);
                return a.type === "counter" ? (state.count || 0) >= (a.target || 1) : state.completed;
              });
              const someDone = scheduledActions.some(a => {
                const state = getActionState(goal, w.dateKey, a.id);
                return a.type === "counter" ? (state.count || 0) > 0 : state.completed;
              });

              let statusBg = "var(--card)";
              let borderColor = "var(--line)";
              if (allDone) {
                statusBg = "var(--moss-light)";
                borderColor = "var(--moss)";
              } else if (someDone) {
                statusBg = "var(--paper)";
                borderColor = "var(--graphite)";
              }

              return (
                <button
                  key={w.dateKey}
                  onClick={() => {
                    if (isSelected && expandedDayKey === w.dateKey) {
                      setSelectedDateKey(todayKey);
                      setExpandedDayKey(null);
                    } else {
                      setSelectedDateKey(w.dateKey);
                      setExpandedDayKey(w.dateKey);
                    }
                  }}
                  className={`day-box smooth-transition ${hasNote ? "has-note" : ""}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 2px",
                    borderRadius: "8px",
                    background: statusBg,
                    color: "inherit",
                    border: isSelected ? "2px solid var(--ink)" : `1px solid ${borderColor}`,
                    cursor: "pointer",
                    width: "100%",
                    height: "auto"
                  }}
                >
                  <span style={{ fontSize: "10px", color: "var(--graphite)" }}>{w.dayName}</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, margin: "2px 0" }}>{w.dayNum}</span>
                  {isToday && <span style={{ fontSize: "8px", fontWeight: 600, color: "var(--ink)", background: "var(--line)", padding: "1px 4px", borderRadius: "3px" }}>Today</span>}
                </button>
              );
            })}
          </div>
        )}

        {expandedDayKey && (() => {
          const { scheduled, done, missed } = getDayBreakdown(expandedDayKey);
          const currentNote = goal.notes?.[expandedDayKey] || "";

          return (
            <div className="day-drawer smooth-transition">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--line)", paddingBottom: "8px" }}>
                <span style={{ fontWeight: 600, fontFamily: "Fraunces, Georgia, serif", fontSize: "15px" }}>
                  Routine Log — {formatPrettyDate(expandedDayKey)}
                </span>
                <button 
                  onClick={() => setExpandedDayKey(null)} 
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--graphite)", padding: "0 4px" }}
                >
                  ✕
                </button>
              </div>

              {scheduled.length === 0 ? (
                <div style={{ color: "var(--graphite)", fontStyle: "italic", padding: "4px 0 8px" }}>No routines scheduled for this day.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--moss)", display: "block", marginBottom: "4px" }}>✓ Completed ({done.length}):</span>
                    {done.length === 0 ? (
                      <span style={{ color: "var(--graphite)", fontSize: "12px", paddingLeft: "10px" }}>None completed</span>
                    ) : (
                      done.map(a => <div key={a.id} style={{ fontSize: "12px", paddingLeft: "12px", color: "var(--ink)" }}>• {a.name}</div>)
                    )}
                  </div>

                  <div>
                    <span style={{ fontWeight: 600, color: "var(--danger)", display: "block", marginBottom: "4px", marginTop: "4px" }}>✕ Missed ({missed.length}):</span>
                    {missed.length === 0 ? (
                      <span style={{ color: "var(--graphite)", fontSize: "12px", paddingLeft: "10px" }}>None missed</span>
                    ) : (
                      missed.map(a => <div key={a.id} style={{ fontSize: "12px", paddingLeft: "12px", color: "var(--graphite)" }}>• {a.name}</div>)
                    )}
                  </div>
                </div>
              )}

              <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "12px" }}>
                <label className="field" style={{ margin: 0 }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>Reason / Note for this day:</span>
                  <input
                    type="text"
                    value={currentNote}
                    onChange={(e) => handleNoteChange(expandedDayKey, e.target.value)}
                    style={{
                      width: "100%",
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "12px",
                      padding: "8px",
                      background: "var(--card)",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      color: "var(--ink)",
                      outline: "none"
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })()}
      </div>

      {goal.targetValue !== undefined && goal.targetValue !== null && goal.targetValue !== "" && !Number.isNaN(Number(goal.targetValue)) && (
        <div className="action-section">
          <div className="section-title">
            <span>Milestones</span>
            <SymbolButton symbol="+" label="Update Milestone" onClick={() => setValueLogModalOpen(true)} />
          </div>
          <ValueHistoryList goal={goal} onDeleteEntry={deleteValueLogEntry} />
        </div>
      )}

      {valueLogModalOpen && (
        <ValueLogModal
          goal={goal}
          onSubmit={logValueUpdate}
          onClose={() => setValueLogModalOpen(false)}
        />
      )}

      {completionModalOpen && (
        <CompletionModal
          goalTitle={goal.title}
          onClose={() => setCompletionModalOpen(false)}
        />
      )}

      {actionModalOpen && (
        <SteppedActionModal 
          initialAction={editingAction} 
          onSave={saveAction} 
          onDelete={deleteAction}
          onClose={() => { setActionModalOpen(false); setEditingAction(null); }} 
        />
      )}

      {goalSettingsModalOpen && (
        <BottomSheet isOpen={true} onClose={() => setGoalSettingsModalOpen(false)} title="Workspace Settings">
          <div style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: "10px" }}>
            <p style={{ fontSize: "13px", color: "var(--graphite)", marginBottom: "8px" }}>Manage workspace settings or remove this goal.</p>
            <button 
              className="btn primary smooth-transition" 
              onClick={() => {
                setGoalSettingsModalOpen(false);
                onOpenEditGoal(goal);
              }}
            >
              Edit Goal Details
            </button>
            <div className="modal-actions" style={{ marginTop: "10px" }}>
              <button 
                className="btn ghost smooth-transition" 
                onClick={() => {
                  onArchiveGoal(goal.id, !goal.archived);
                  setGoalSettingsModalOpen(false);
                  onBack();
                }}
              >
                {goal.archived ? "Unarchive" : "Archive"}
              </button>
              <button 
                className="btn ghost danger smooth-transition" 
                onClick={() => {
                  if (confirm(`Delete "${goal.title}"?`)) {
                    onDeleteGoal(goal.id);
                    setGoalSettingsModalOpen(false);
                    onBack();
                  }
                }}
              >
                Delete
              </button>
              <div className="spacer" />
              <button className="btn ghost smooth-transition" onClick={() => setGoalSettingsModalOpen(false)}>Close</button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

// ==========================================================================
// 4. Main App Container View Switcher
// ==========================================================================
function RoutioApp() {
  const [goals, setGoals] = React.useState(null);
  const [categories, setCategories] = React.useState(DEFAULT_CATEGORIES);
  const [activeGoalId, setActiveGoalId] = React.useState(null);
  const [goalModal, setGoalModal] = React.useState(false);
  const [editingGoalObj, setEditingGoalObj] = React.useState(null);
  const [categoriesModalOpen, setCategoriesModalOpen] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [showCompleted, setShowCompleted] = React.useState(false);
  const [lastBackup, setLastBackup] = React.useState(null);
  const [theme, setTheme] = React.useState("light");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = React.useState("all");
  
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [isEditingLayout, setIsEditingLayout] = React.useState(false);
  const [menuOrigin, setMenuOrigin] = React.useState("100% 0%");
  const [workspaceOrigin, setWorkspaceOrigin] = React.useState("center center");

  const [draggedGoalId, setDraggedGoalId] = React.useState(null);
  const dragStartRef = React.useRef({ startX: 0, startY: 0 });
  const cardRefs = React.useRef({});
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("action_goals_data");
        if (res && res.value) {
          try {
            const parsed = JSON.parse(res.value);
            setGoals(Array.isArray(parsed) ? parsed : []);
          } catch (parseError) {
            console.error("Corrupted local storage payload detected:", parseError);
            alert("Warning: Local goal data appears corrupted. Initializing fresh workspace state.");
            setGoals([]);
          }
        } else {
          setGoals([]);
        }

        const catRes = await window.storage.get("routio_custom_categories");
        if (catRes && catRes.value) {
          try {
            const parsedCats = JSON.parse(catRes.value);
            if (Array.isArray(parsedCats)) setCategories(parsedCats);
          } catch {}
        }

        const backupMeta = await window.storage.get("action_goals_backup_date");
        if (backupMeta) setLastBackup(backupMeta.value);

        const savedTheme = localStorage.getItem("routio_app_theme") || "light";
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);

      } catch {
        setGoals([]);
      }
    })();
  }, []);

  React.useEffect(() => {
    if (goals === null) return;
    (async () => {
      try {
        await window.storage.set("action_goals_data", JSON.stringify(goals));
      } catch (storageError) {
        console.error("Storage write failed (Quota Exceeded?):", storageError);
        alert("Error: Storage limit reached. Please export your backup and clear space.");
      }
    })();
  }, [goals]);

  function handleUpdateCategories(newCats) {
    setCategories(newCats);
    window.storage.set("routio_custom_categories", JSON.stringify(newCats));
  }

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("routio_app_theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  }

  function saveGoal(goalData, openWorkspace = false) {
    setGoals(prev => {
      const exists = prev.some(g => g.id === goalData.id);
      if (exists) {
        return prev.map(g => g.id === goalData.id ? goalData : g);
      }
      return [...prev, goalData];
    });
    setGoalModal(false);
    setEditingGoalObj(null);
    if (openWorkspace) {
      setActiveGoalId(goalData.id);
    }
  }

  function updateGoal(updated) {
    setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
  }

  function toggleArchiveGoal(id, archiveState) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, archived: archiveState } : g));
  }

  function deleteGoal(id) {
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  function handlePointerDown(e, goalId) {
    if (!isEditingLayout) return;
    if (e.button !== undefined && e.button !== 0) return;
    const node = cardRefs.current[goalId];
    if (!node) return;

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY
    };

    node.style.zIndex = '9999';
    node.style.boxShadow = '0 20px 40px rgba(0,0,0,0.25)';

    setDraggedGoalId(goalId);
  }

  const lastSwapRef = React.useRef(0);
  const draggedGoalIdRef = React.useRef(null);
  draggedGoalIdRef.current = draggedGoalId;

  React.useEffect(() => {
    if (!draggedGoalId) return;

    let rafId = null;

    function handlePointerMove(e) {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const node = cardRefs.current[draggedGoalId];
        if (!node) return;

        const dx = e.clientX - dragStartRef.current.startX;
        const dy = e.clientY - dragStartRef.current.startY;
        node.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;

        const now = Date.now();
        if (now - lastSwapRef.current < 60) return;

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const currentDragId = draggedGoalIdRef.current;
        const targetCard = elements.find(el => el.classList && el.classList.contains('card') && el.dataset.goalid && el.dataset.goalid !== currentDragId);

        if (targetCard) {
          lastSwapRef.current = now;
          const targetId = targetCard.dataset.goalid;
          setGoals(prevGoals => {
            const active = prevGoals.filter(g => !g.archived);
            const archived = prevGoals.filter(g => g.archived);
            const draggedIndex = active.findIndex(g => g.id === currentDragId);
            const targetIndex = active.findIndex(g => g.id === targetId);
            if (draggedIndex === -1 || targetIndex === -1) return prevGoals;
            const [moved] = active.splice(draggedIndex, 1);
            active.splice(targetIndex, 0, moved);
            return [...active, ...archived];
          });
        }
      });
    }

    function handlePointerUp() {
      cancelAnimationFrame(rafId);
      const node = cardRefs.current[draggedGoalId];
      if (node) {
        node.style.zIndex = '';
        node.style.boxShadow = '';
        node.style.transform = '';
      }
      setDraggedGoalId(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [draggedGoalId]);

  function exportBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ goals, categories }, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `routio_tracker_backup_${formatDateKey(new Date())}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();

    const todayStr = formatDateKey(new Date());
    setLastBackup(todayStr);
    window.storage.set("action_goals_backup_date", todayStr);
    setMenuOpen(false);
  }

  function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        const parsedGoals = Array.isArray(imported) ? imported : imported.goals;
        const isValid = Array.isArray(parsedGoals) && parsedGoals.every(g => 
          g && typeof g.id === 'string' && 
          typeof g.title === 'string'
        );

        if (isValid) {
          if (!window.confirm("Restoring a backup will replace all your current goals. Continue?")) return;
          const sanitized = parsedGoals.map(g => ({
            ...g,
            category: g.category || "Growth",
            actions: Array.isArray(g.actions) ? g.actions : [],
            history: g.history && typeof g.history === 'object' ? g.history : {},
            notes: g.notes && typeof g.notes === 'object' ? g.notes : {},
            valueLog: Array.isArray(g.valueLog) ? g.valueLog : [],
          }));
          setGoals(sanitized);
          if (imported.categories && Array.isArray(imported.categories)) {
            handleUpdateCategories(imported.categories);
          }
          alert("Backup successfully restored!");
        } else {
          alert("Invalid backup file format.");
        }
      } catch {
        alert("Failed to parse backup file.");
      }
    };
    reader.readAsText(file);
    setMenuOpen(false);
  }

  const activeGoals = React.useMemo(() => {
    if (!goals) return [];
    return goals.filter(g => {
      if (g.archived || g.completed) return false;
      const matchesSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategoryFilter === 'all' || g.category === selectedCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [goals, searchQuery, selectedCategoryFilter]);

  const completedList = React.useMemo(() => {
    if (!goals) return [];
    return goals.filter(g => {
      if (g.archived || !g.completed) return false;
      const matchesSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategoryFilter === 'all' || g.category === selectedCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [goals, searchQuery, selectedCategoryFilter]);

  const archivedList = goals?.filter(g => g.archived) || [];

  const needsBackupNotice = React.useMemo(() => {
    if (!lastBackup) return true;
    const daysSince = (new Date() - new Date(lastBackup)) / (1000 * 60 * 60 * 24);
    return daysSince > 14;
  }, [lastBackup]);

  const hasMeaningfulData = React.useMemo(() => {
    if (!goals || goals.length === 0) return false;
    return goals.some(g => (g.valueLog && g.valueLog.length > 0) || (g.actions && g.actions.length > 0));
  }, [goals]);

  const activeGoal = goals?.find(g => g.id === activeGoalId);

  return (
    <div 
      className="app smooth-transition"
      style={{
        userSelect: draggedGoalId ? "none" : "auto",
        WebkitUserSelect: draggedGoalId ? "none" : "auto",
        touchAction: draggedGoalId ? "none" : "auto"
      }}
    >
      <InstallPrompt />
      <BackupReminder
        hasData={hasMeaningfulData}
        needsBackup={needsBackupNotice}
        onBackupNow={exportBackup}
      />
      <div className="header">
        <h1 
          onClick={(e) => {
            const target = e.currentTarget;
            requestAnimationFrame(() => {
              const rect = target.getBoundingClientRect();
              const xPct = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
              const yPct = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
              setWorkspaceOrigin(`${xPct}% ${yPct}%`);
              setActiveGoalId(null);
            });
          }} 
          style={{ cursor: "pointer", transition: "opacity 0.2s ease" }}
          title="Back to Homescreen"
          onMouseEnter={(e) => e.currentTarget.style.opacity = "0.7"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
        >
          Routio
        </h1>
        <div className="header-right" style={{ display: "flex", alignItems: "center", gap: "6px", position: "relative" }}>
          <SymbolButton 
            symbol={theme === "light" ? "○" : "●"} 
            label="Toggle Dark/Light Mode" 
            onClick={toggleTheme} 
          />

          {isEditingLayout ? (
            <button
              onClick={() => setIsEditingLayout(false)}
              className="smooth-transition"
              style={{
                background: "var(--ink)",
                color: "var(--card)",
                border: "none",
                borderRadius: "20px",
                padding: "6px 14px",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
              }}
            >
              Done Editing
            </button>
          ) : (
            <SymbolButton 
              symbol="☰" 
              label="Open Menu" 
              onClick={(e) => {
                const target = e.currentTarget;
                requestAnimationFrame(() => {
                  const rect = target.getBoundingClientRect();
                  const xPct = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
                  const yPct = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
                  setMenuOrigin(`${xPct}% ${yPct}%`);
                  setMenuOpen(!menuOpen);
                });
              }} 
              hasBadge={needsBackupNotice}
            />
          )}

          {menuOpen && !isEditingLayout && (
            <div className="smooth-transition" style={{
              position: "absolute",
              right: 0,
              top: "42px",
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "8px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              minWidth: "180px",
              transformOrigin: menuOrigin,
              animation: "bloomOpen 1s cubic-bezier(0.16, 1, 0.3, 1) both"
            }}>
              <button
                onClick={() => { setIsEditingLayout(true); setMenuOpen(false); }}
                className="smooth-transition"
                style={{ background: "none", border: "none", textAlign: "left", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <span>↕</span> Edit Dashboard Layout
              </button>
              <button
                onClick={() => { setCategoriesModalOpen(true); setMenuOpen(false); }}
                className="smooth-transition"
                style={{ background: "none", border: "none", textAlign: "left", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <span>⚙</span> Manage Categories
              </button>
              <button
                onClick={exportBackup}
                className="smooth-transition"
                style={{ background: "none", border: "none", textAlign: "left", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <span>↓</span> Backup JSON Data
              </button>
              <button
                onClick={() => { fileInputRef.current?.click(); setMenuOpen(false); }}
                className="smooth-transition"
                style={{ background: "none", border: "none", textAlign: "left", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <span>↑</span> Restore Data File
              </button>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={importBackup} />
        </div>
      </div>

      {goals === null ? (
        <div style={{ color: "var(--graphite)", fontSize: 13, textAlign: "center", padding: "40px" }}>Loading workspace…</div>
      ) : activeGoal ? (
        <WorkspaceErrorBoundary resetKey={activeGoal.id} onBack={() => setActiveGoalId(null)}>
          <GoalWorkspace 
            goal={activeGoal} 
            categories={categories}
            originStyle={{ transformOrigin: workspaceOrigin }}
            onBack={() => {
              const headingEl = document.querySelector('.header h1');
              if (headingEl) {
                const rect = headingEl.getBoundingClientRect();
                const xPct = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
                const yPct = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
                setWorkspaceOrigin(`${xPct}% ${yPct}%`);
              }
              setActiveGoalId(null);
            }} 
            onUpdateGoal={updateGoal} 
            onArchiveGoal={toggleArchiveGoal}
            onDeleteGoal={deleteGoal}
            onOpenEditGoal={(g) => { setEditingGoalObj(g); setGoalModal(true); }}
          />
        </WorkspaceErrorBoundary>
      ) : (
        <div style={{ transformOrigin: workspaceOrigin, animation: "bloomOpen 1s cubic-bezier(0.16, 1, 0.3, 1) both" }}>
          {isEditingLayout && (
            <div className="smooth-transition" style={{ background: "var(--paper)", border: "1px dashed var(--ink)", borderRadius: "10px", padding: "10px 16px", marginBottom: "16px", textAlign: "center", fontSize: "13px", color: "var(--ink)" }}>
              📱 <b>Layout Edit Mode Active</b> — Press and drag any card around to rearrange your home layout. Click <b>Done Editing</b> above when finished.
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search goals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="smooth-transition"
              style={{ flex: 1, minWidth: "180px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "10px", padding: "10px 14px", fontSize: "13.5px", color: "var(--ink)", outline: "none" }}
            />
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="smooth-transition"
              style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "10px", padding: "10px 14px", fontSize: "13.5px", color: "var(--ink)", outline: "none", cursor: "pointer" }}
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.key || c.label} value={c.label}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>

          <div className="grid">
            {activeGoals.map(g => {
              const isDragging = draggedGoalId === g.id;
              const cardStats = calculateGoalStats(g);
              const isConsistencyGoal = g.goalType === 'habit';

              return (
                <div 
                  key={g.id}
                  ref={el => cardRefs.current[g.id] = el}
                  data-goalid={g.id}
                  className="card smooth-transition" 
                  onPointerDown={(e) => handlePointerDown(e, g.id)}
                  onClick={(e) => {
                    if (!isEditingLayout) {
                      const target = e.currentTarget;
                      requestAnimationFrame(() => {
                        const rect = target.getBoundingClientRect();
                        const xPct = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
                        const yPct = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
                        setWorkspaceOrigin(`${xPct}% ${yPct}%`);
                        setActiveGoalId(g.id);
                      });
                    }
                  }}
                  style={{ 
                    border: isEditingLayout ? "2px dashed var(--graphite)" : undefined,
                    opacity: isDragging ? 0.85 : 1,
                    cursor: isEditingLayout ? "grab" : "pointer",
                    touchAction: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="card-category">{g.category} {g.completed && "• Completed"}</div>
                      {isConsistencyGoal && (
                        <span style={{ 
                          fontSize: "10.5px", 
                          padding: "2px 6px", 
                          borderRadius: "6px", 
                          background: "var(--paper)", 
                          color: "var(--graphite)",
                          fontWeight: 500 
                        }}>
                          Active
                        </span>
                      )}
                    </div>
                    <h3 className="card-title" style={{ marginTop: "6px" }}>{g.title}</h3>
                  </div>

                  <div style={{ marginTop: "auto", paddingTop: "12px" }}>
                    {isConsistencyGoal ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span className={`streak-badge ${cardStats.streak > 0 ? "lit" : "unlit"}`} style={{ fontSize: "12px" }}>
                          🔥 {cardStats.streak} day streak
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--graphite)" }}>
                          {g.actions?.length || 0} routine{(g.actions?.length || 0) === 1 ? "" : "s"}
                        </span>
                      </div>
                    ) : (
                      <ValueProgressBar goal={g} />
                    )}
                  </div>
                </div>
              );
            })}

            {!isEditingLayout && (
              <button className="card add-slot smooth-transition" onClick={() => { setEditingGoalObj(null); setGoalModal(true); }}>
                <div style={{ fontSize: 22, marginBottom: 2 }}>+</div>
                <div style={{ fontSize: 12 }}>New Goal</div>
              </button>
            )}
          </div>

          {completedList.length > 0 && !isEditingLayout && (
            <div className="archive-section">
              <button className="archive-toggle smooth-transition" onClick={() => setShowCompleted(!showCompleted)}>
                {showCompleted ? "↓ Hide Completed Goals" : `→ Show Completed Goals (${completedList.length})`}
              </button>

              {showCompleted && (
                <div className="grid" style={{ marginTop: 16 }}>
                  {completedList.map(g => (
                    <div 
                      key={g.id} 
                      className="card smooth-transition" 
                      onClick={(e) => {
                        const target = e.currentTarget;
                        requestAnimationFrame(() => {
                          const rect = target.getBoundingClientRect();
                          const xPct = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
                          const yPct = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
                          setWorkspaceOrigin(`${xPct}% ${yPct}%`);
                          setActiveGoalId(g.id);
                        });
                      }}
                    >
                      <div className="card-category">{g.category} • Completed</div>
                      <h3 className="card-title">{g.title}</h3>
                      <div style={{ marginTop: "auto" }}>
                        <ValueProgressBar goal={g} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {archivedList.length > 0 && !isEditingLayout && (
            <div className="archive-section">
              <button className="archive-toggle smooth-transition" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? "↓ Hide Archived Workspaces" : `→ Show Archived Workspaces (${archivedList.length})`}
              </button>

              {showArchived && (
                <div className="grid" style={{ marginTop: 16 }}>
                  {archivedList.map(g => (
                    <div 
                      key={g.id} 
                      className="card smooth-transition" 
                      style={{ opacity: 0.6 }} 
                      onClick={(e) => {
                        const target = e.currentTarget;
                        requestAnimationFrame(() => {
                          const rect = target.getBoundingClientRect();
                          const xPct = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
                          const yPct = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
                          setWorkspaceOrigin(`${xPct}% ${yPct}%`);
                          setActiveGoalId(g.id);
                        });
                      }}
                    >
                      <div className="card-category">{g.category} (Archived)</div>
                      <h3 className="card-title">{g.title}</h3>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {goalModal && (
        <GoalModal 
          goalToEdit={editingGoalObj} 
          categories={categories}
          onSave={saveGoal} 
          onClose={() => { setGoalModal(false); setEditingGoalObj(null); }} 
        />
      )}

      {categoriesModalOpen && (
        <CategoriesModal
          categories={categories}
          goals={goals}
          onUpdateCategories={handleUpdateCategories}
          onClose={() => setCategoriesModalOpen(false)}
        />
      )}
    </div>
  );
}

export default RoutioApp;