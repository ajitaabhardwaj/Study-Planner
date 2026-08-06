"use client";

import {
  AlarmClock,
  ArrowRight,
  CalendarCheck,
  Check,
  ClipboardList,
  Clock3,
  Lightbulb,
  Pause,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "study-planner-v2";
const todayKey = () => new Date().toISOString().slice(0, 10);
const displayDate = (dateKey) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateKey}T00:00:00`));
const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const emptyPrepTopic = () => ({
  id: uid(),
  title: "",
  level: "medium",
  duration: 1,
  durationUnit: "hours",
});

const emptyPrepDayItem = () => ({
  title: "",
  duration: 1,
  durationUnit: "hours",
  level: "medium",
});

const starterState = {
  tasks: [],
  todos: [],
  prepPlan: [],
};

function loadState() {
  if (typeof window === "undefined") return starterState;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...starterState, ...saved } : starterState;
  } catch {
    return starterState;
  }
}

function formatMinutes(minutes) {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function formatHoursFromMinutes(minutes) {
  const hours = Math.max(0, Number(minutes || 0) / 60);
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

function formatSeconds(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function priorityRank(priority) {
  return { high: 0, medium: 1, low: 2, revision: 3 }[priority] ?? 1;
}

function topicLevel(item) {
  return item.level || item.priority || "medium";
}

function prepItemMeta(item) {
  return item.level === "revision"
    ? `${formatHoursFromMinutes(item.minutes)} review`
    : `${topicLevel(item)} level · ${formatHoursFromMinutes(item.minutes)}`;
}

export default function StudyPlanner() {
  const [activeTab, setActiveTab] = useState("today");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const dateInputRef = useRef(null);
  const [state, setState] = useState(starterState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState(null);
  const [todoForm, setTodoForm] = useState({
    title: "",
    detail: "",
    dueDate: selectedDate,
    dueTime: "",
    plannedHours: "",
    durationUnit: "hours",
    priority: "medium",
  });
  const [prepForm, setPrepForm] = useState({
    days: 7,
    hoursPerDay: 3,
    topics: [emptyPrepTopic()],
  });

  useEffect(() => {
    setState(loadState());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [isLoaded, state]);

  useEffect(() => {
    setTodoForm((current) => ({ ...current, dueDate: selectedDate }));
  }, [selectedDate]);

  useEffect(() => {
    if (!runningTaskId) return;
    const interval = setInterval(() => {
      setState((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === runningTaskId
            ? {
                ...task,
                achievedSeconds: task.achievedSeconds + 1,
                status: task.status === "done" ? "done" : "active",
              }
            : task.status === "active"
              ? { ...task, status: "planned" }
              : task,
        ),
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [runningTaskId]);

  const todaysTasks = useMemo(
    () => state.tasks.filter((task) => task.date === selectedDate),
    [selectedDate, state.tasks],
  );

  const metrics = useMemo(() => {
    const planned = todaysTasks.reduce(
      (sum, task) => sum + Number(task.plannedMinutes || 0),
      0,
    );
    const achievedSeconds = todaysTasks.reduce(
      (sum, task) => sum + Number(task.achievedSeconds || 0),
      0,
    );
    const done = todaysTasks.filter((task) => task.status === "done").length;
    return {
      planned,
      achievedSeconds,
      completion: todaysTasks.length
        ? Math.round((done / todaysTasks.length) * 100)
        : 0,
      productivity: planned
        ? Math.min(160, Math.round((achievedSeconds / 60 / planned) * 100))
        : 0,
    };
  }, [todaysTasks]);

  function startTask(taskId) {
    setRunningTaskId(taskId);
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? { ...task, status: "active" }
          : task.status === "active"
            ? { ...task, status: "planned" }
            : task,
      ),
    }));
  }

  function pauseTask() {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === runningTaskId ? { ...task, status: "planned" } : task,
      ),
    }));
    setRunningTaskId(null);
  }

  function completeTimedTask(taskId) {
    if (taskId === runningTaskId) setRunningTaskId(null);
    setState((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      return {
        ...current,
        tasks: current.tasks.filter((item) => item.id !== taskId),
        todos: current.todos.map((todo) =>
          todo.id === task?.sourceTodoId
            ? {
                ...todo,
                status: "complete",
                completedAt: Date.now(),
                plannedTaskId: null,
              }
            : todo,
        ),
      };
    });
  }

  function addTodo(event) {
    event.preventDefault();
    if (!todoForm.title.trim()) return;
    const plannedDuration = Number(todoForm.plannedHours);
    const plannedMinutes =
      Number.isFinite(plannedDuration) && plannedDuration > 0
        ? todoForm.durationUnit === "minutes"
          ? plannedDuration
          : plannedDuration * 60
        : null;
    setState((current) => ({
      ...current,
      todos: [
        {
          id: uid(),
          title: todoForm.title.trim(),
          detail: todoForm.detail.trim(),
          dueDate: todoForm.dueDate || "",
          dueTime: todoForm.dueTime || "",
          plannedMinutes,
          priority: todoForm.priority,
          status: "open",
          createdAt: Date.now(),
          completedAt: null,
        },
        ...current.todos,
      ],
    }));
    setTodoForm({
      title: "",
      detail: "",
      dueDate: selectedDate,
      dueTime: "",
      plannedHours: "",
      durationUnit: "hours",
      priority: "medium",
    });
  }

  function updateTodo(todoId, changes) {
    setState((current) => ({
      ...current,
      todos: current.todos.map((todo) =>
        todo.id === todoId ? { ...todo, ...changes } : todo,
      ),
    }));
  }

  function deleteTodo(todoId) {
    setState((current) => ({
      ...current,
      todos: current.todos.filter((todo) => todo.id !== todoId),
    }));
  }

  function todoToTask(todo) {
    if (todo.plannedTaskId || !Number(todo.plannedMinutes)) return;
    const taskId = uid();
    setState((current) => ({
      ...current,
      tasks: [
        {
          id: taskId,
          title: todo.title,
          plannedMinutes: Number(todo.plannedMinutes),
          achievedSeconds: 0,
          status: "planned",
          category: "To-Do",
          sourceTodoId: todo.id,
          notes:
            todo.detail ||
            [todo.dueDate ? `Due ${todo.dueDate}` : "", todo.dueTime ? `at ${todo.dueTime}` : ""]
              .filter(Boolean)
              .join(" "),
          date: selectedDate,
          createdAt: Date.now(),
        },
        ...current.tasks,
      ],
      todos: current.todos.map((item) =>
        item.id === todo.id ? { ...item, plannedTaskId: taskId } : item,
      ),
    }));
    setActiveTab("today");
  }

  function generatePrepPlan(event) {
    event.preventDefault();
    const days = Math.max(1, Math.floor(Number(prepForm.days) || 1));
    const hoursPerDay = Math.max(1, Math.floor(Number(prepForm.hoursPerDay) || 1));
    const dailyCapacity = hoursPerDay * 60;
    const topics = prepForm.topics
      .map((topic, index) => {
        const durationValue = Math.max(1, Math.floor(Number(topic.duration ?? topic.hours) || 1));
        const durationUnit = topic.durationUnit || "hours";
        return {
          id: uid(),
          title: topic.title.trim(),
          level: topic.level,
          minutes: durationUnit === "minutes" ? durationValue : durationValue * 60,
          done: false,
          order: index,
        };
      })
      .filter((topic) => topic.title)
      .sort(
        (a, b) =>
          priorityRank(a.level) - priorityRank(b.level) || a.order - b.order,
      );

    const plan = Array.from({ length: days }, (_, index) => ({
      id: uid(),
      day: index + 1,
      capacity: dailyCapacity,
      items: [],
    }));

    const usedForDay = (day) =>
      day.items.reduce((sum, item) => sum + item.minutes, 0);
    const addToBestDay = (item) => {
      const bestDay = plan
        .map((day) => ({
          day,
          used: usedForDay(day),
          remaining: dailyCapacity - usedForDay(day),
        }))
        .filter((entry) => entry.remaining >= item.minutes)
        .sort((a, b) => b.remaining - a.remaining || a.day.day - b.day.day)[0];

      const target =
        bestDay?.day ||
        plan
          .map((day) => ({ day, used: usedForDay(day) }))
          .sort((a, b) => a.used - b.used || a.day.day - b.day.day)[0].day;
      target.items.push(item);
    };

    topics.forEach((topic) => {
      let remaining = topic.minutes;
      let part = 1;
      while (remaining > 0) {
        const chunkMinutes = Math.min(remaining, dailyCapacity);
        addToBestDay({
          ...topic,
          id: uid(),
          title:
            topic.minutes > dailyCapacity
              ? `${topic.title} - part ${part}`
              : topic.title,
          minutes: chunkMinutes,
        });
        remaining -= chunkMinutes;
        part += 1;
      }
    });

    const totalTopicMinutes = topics.reduce((sum, topic) => sum + topic.minutes, 0);
    const totalCapacity = days * dailyCapacity;
    if (topics.length && totalTopicMinutes < totalCapacity) {
      plan.forEach((day) => {
        const remaining = dailyCapacity - usedForDay(day);
        if (remaining > 0) {
          day.items.push({
            id: uid(),
            title: "Revision",
            level: "revision",
            minutes: remaining,
            done: false,
            order: 999,
          });
        }
      });
    }

    setState((current) => ({ ...current, prepPlan: plan }));
  }

  function updatePrepItemDone(itemId, done) {
    setState((current) => ({
      ...current,
      prepPlan: current.prepPlan.map((day) => ({
        ...day,
        items: day.items.map((item) =>
          item.id === itemId ? { ...item, done } : item,
        ),
      })),
    }));
  }

  function addPrepItemToDay(dayId, item) {
    const durationValue = Math.max(1, Math.floor(Number(item.duration) || 1));
    const minutes = item.durationUnit === "minutes" ? durationValue : durationValue * 60;
    const title = item.title.trim();
    if (!title) return false;

    setState((current) => ({
      ...current,
      prepPlan: current.prepPlan.map((day) =>
        day.id === dayId
          ? {
              ...day,
              items: [
                ...day.items,
                {
                  id: uid(),
                  title,
                  level: item.level || "medium",
                  minutes,
                  done: false,
                  order: day.items.length,
                  manual: true,
                },
              ],
            }
          : day,
      ),
    }));
    return true;
  }

  function prepItemToTask(item) {
    setState((current) => ({
      ...current,
      tasks: [
        {
          id: uid(),
          title: item.title,
          plannedMinutes: item.minutes,
          achievedSeconds: 0,
          status: "planned",
          category: "Prep",
          notes: `Level: ${topicLevel(item)}`,
          date: selectedDate,
          createdAt: Date.now(),
        },
        ...current.tasks,
      ],
    }));
    setActiveTab("today");
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Study Planner</p>
          <h1>Plan the day, run the clock, protect the focus.</h1>
        </div>
        <div className="today-chip">
          <button
            className="calendar-pick-button"
            type="button"
            onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
            aria-label="Choose planner date"
          >
            <CalendarCheck size={18} />
          </button>
          <span>{displayDate(selectedDate)}</span>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value || todayKey())}
            aria-label="Choose planner date"
          />
        </div>
      </section>

      <nav className="tabs" aria-label="Planner sections">
        <TabButton active={activeTab === "today"} onClick={() => setActiveTab("today")} icon={Clock3} label="Today" />
        <TabButton active={activeTab === "prep"} onClick={() => setActiveTab("prep")} icon={Sparkles} label="Prep Plan" />
      </nav>

      {activeTab === "today" && (
        <TodayView
          tasks={todaysTasks}
          selectedDate={selectedDate}
          metrics={metrics}
          runningTaskId={runningTaskId}
          startTask={startTask}
          pauseTask={pauseTask}
          completeTimedTask={completeTimedTask}
          todoForm={todoForm}
          setTodoForm={setTodoForm}
          addTodo={addTodo}
          todos={state.todos}
          updateTodo={updateTodo}
          deleteTodo={deleteTodo}
          todoToTask={todoToTask}
        />
      )}

      {activeTab === "prep" && (
        <PrepView
          prepForm={prepForm}
          setPrepForm={setPrepForm}
          generatePrepPlan={generatePrepPlan}
          prepPlan={state.prepPlan}
          prepItemToTask={prepItemToTask}
          updatePrepItemDone={updatePrepItemDone}
          addPrepItemToDay={addPrepItemToDay}
        />
      )}
    </main>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button className={`tab-button ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}

function TodayView(props) {
  const {
    tasks,
    selectedDate,
    metrics,
    runningTaskId,
    startTask,
    pauseTask,
    completeTimedTask,
    todoForm,
    setTodoForm,
    addTodo,
    todos,
    updateTodo,
    deleteTodo,
    todoToTask,
  } = props;

  return (
    <section className="today-command-grid">
      <div className="panel form-panel todo-command-panel">
          <div className="panel-title">
            <ClipboardList size={20} />
            <h2>Write all your to-dos</h2>
            <span className="help-tip" tabIndex="0">
              <Lightbulb size={18} />
              <span className="help-bubble">
                Click Plan on the items you want to schedule for {displayDate(selectedDate)}.
              </span>
            </span>
          </div>
          <p className="panel-guidance">
            Write everything down.
          </p>
          <TodoForm
            todoForm={todoForm}
            setTodoForm={setTodoForm}
            addTodo={addTodo}
          />
      </div>

      <div className="panel todo-list-panel">
        <TodoGroups
          todos={todos}
          selectedDate={selectedDate}
          updateTodo={updateTodo}
          deleteTodo={deleteTodo}
          todoToTask={todoToTask}
        />
      </div>

      <div className="main-column">
        <div className="panel-title planned-list-title">
          <AlarmClock size={20} />
          <h2>Timed plan for {displayDate(selectedDate)}</h2>
        </div>
        <div className="stats-grid">
          <Stat label="Planned" value={formatMinutes(metrics.planned)} />
          <Stat label="Focused" value={formatSeconds(metrics.achievedSeconds)} />
          <Stat label="Tasks Done" value={`${metrics.completion}%`} />
          <Stat label="Plan Hit" value={`${metrics.productivity}%`} />
        </div>
        <div className="task-list">
          {tasks.length === 0 ? (
            <EmptyState title="No timed tasks yet" text="Add the first task and start the clock when you begin." />
          ) : (
            tasks.map((task) => (
              <article className={`task-card ${task.status}`} key={task.id}>
                <div className="task-head">
                  <div>
                    <span className="category-pill">{task.category}</span>
                    <h3>{task.title}</h3>
                    {task.notes && <p>{task.notes}</p>}
                  </div>
                  <div className="timer-readout">{formatSeconds(task.achievedSeconds)}</div>
                </div>
                <div className="progress-line">
                  <span
                    style={{
                      width: `${Math.min(100, (task.achievedSeconds / 60 / task.plannedMinutes) * 100)}%`,
                    }}
                  />
                </div>
                <div className="task-meta">
                  <span>Planned {formatMinutes(task.plannedMinutes)}</span>
                  <span className={`status-text ${task.status}`}>{task.status}</span>
                </div>
                <div className="task-actions">
                  {runningTaskId === task.id ? (
                    <IconButton label="Pause" onClick={pauseTask} icon={Pause} />
                  ) : (
                    <IconButton label="Start" onClick={() => startTask(task.id)} icon={Play} tone="timer" />
                  )}
                  <IconButton label="Done" onClick={() => completeTimedTask(task.id)} icon={Check} tone="timer" />
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function PrepView({
  prepForm,
  setPrepForm,
  generatePrepPlan,
  prepPlan,
  prepItemToTask,
  updatePrepItemDone,
  addPrepItemToDay,
}) {
  const [dayItemForms, setDayItemForms] = useState({});

  function dayItemForm(dayId) {
    return dayItemForms[dayId] || emptyPrepDayItem();
  }

  function updateDayItemForm(dayId, changes) {
    setDayItemForms((current) => ({
      ...current,
      [dayId]: { ...(current[dayId] || emptyPrepDayItem()), ...changes },
    }));
  }

  function submitDayItem(event, dayId) {
    event.preventDefault();
    const added = addPrepItemToDay(dayId, dayItemForm(dayId));
    if (!added) return;
    setDayItemForms((current) => ({ ...current, [dayId]: emptyPrepDayItem() }));
  }
  function updateTopic(topicId, changes) {
    setPrepForm({
      ...prepForm,
      topics: prepForm.topics.map((topic) =>
        topic.id === topicId ? { ...topic, ...changes } : topic,
      ),
    });
  }

  function addTopicRow() {
    setPrepForm({
      ...prepForm,
      topics: [...prepForm.topics, emptyPrepTopic()],
    });
  }

  function removeTopicRow(topicId) {
    const nextTopics = prepForm.topics.filter((topic) => topic.id !== topicId);
    setPrepForm({
      ...prepForm,
      topics: nextTopics.length ? nextTopics : [emptyPrepTopic()],
    });
  }

  return (
    <section className="workspace-grid">
      <div className="panel form-panel prep-command-panel">
        <div className="panel-title">
          <Sparkles size={20} />
          <h2>Generate prep plan</h2>
        </div>
        <form onSubmit={generatePrepPlan} className="stack-form">
          <div className="form-row">
            <label>
              Days
              <input type="number" min="1" step="1" value={prepForm.days} onChange={(e) => setPrepForm({ ...prepForm, days: e.target.value })} />
            </label>
            <label>
              Hours/day
              <input type="number" min="1" step="1" value={prepForm.hoursPerDay} onChange={(e) => setPrepForm({ ...prepForm, hoursPerDay: e.target.value })} />
            </label>
          </div>
          <div className="topic-rows" aria-label="Prep topics">
            <div className="topic-row topic-row-head">
              <span>Topic</span>
              <span>Level</span>
              <span>Duration</span>
              <span>Unit</span>
              <span />
            </div>
            {prepForm.topics.map((topic) => (
              <div className="topic-row" key={topic.id}>
                <input
                  value={topic.title}
                  onChange={(e) => updateTopic(topic.id, { title: e.target.value })}
                  placeholder="Topic or unit"
                  aria-label="Topic"
                />
                <select
                  value={topic.level}
                  onChange={(e) => updateTopic(topic.id, { level: e.target.value })}
                  aria-label="Level"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={topic.duration ?? topic.hours ?? 1}
                  onChange={(e) => updateTopic(topic.id, { duration: e.target.value })}
                  aria-label="Time to allot"
                />
                <select
                  value={topic.durationUnit || "hours"}
                  onChange={(e) => updateTopic(topic.id, { durationUnit: e.target.value })}
                  aria-label="Time unit"
                >
                  <option value="hours">Hours</option>
                  <option value="minutes">Minutes</option>
                </select>
                <IconButton label="Remove" onClick={() => removeTopicRow(topic.id)} icon={Trash2} danger />
              </div>
            ))}
            <button type="button" className="secondary-button" onClick={addTopicRow}>
              <Plus size={18} />
              Add Topic
            </button>
          </div>
          <button className="primary-button" type="submit">
            <Sparkles size={18} />
            Build Plan
          </button>
        </form>
      </div>

      <div className="plan-board">
        {prepPlan.length === 0 ? (
          <EmptyState title="No generated plan yet" text="Add topics with level, duration, and unit, then build the plan." />
        ) : (
          prepPlan.map((day) => {
            const used = day.items.reduce((sum, item) => sum + item.minutes, 0);
            const done = day.items.filter((item) => item.done).length;
            return (
              <article className="day-card" key={day.id}>
                <div className="day-head">
                  <h3>Day {day.day}</h3>
                  <span>{formatMinutes(used)} / {formatMinutes(day.capacity)} · {done}/{day.items.length} done</span>
                </div>
                <form className="prep-day-add" onSubmit={(event) => submitDayItem(event, day.id)}>
                  <input
                    value={dayItemForm(day.id).title}
                    onChange={(event) => updateDayItemForm(day.id, { title: event.target.value })}
                    placeholder="Add task"
                    aria-label={`Add task to day ${day.day}`}
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={dayItemForm(day.id).duration}
                    onChange={(event) => updateDayItemForm(day.id, { duration: event.target.value })}
                    aria-label={`Task duration for day ${day.day}`}
                  />
                  <select
                    value={dayItemForm(day.id).durationUnit}
                    onChange={(event) => updateDayItemForm(day.id, { durationUnit: event.target.value })}
                    aria-label={`Task duration unit for day ${day.day}`}
                  >
                    <option value="hours">Hours</option>
                    <option value="minutes">Minutes</option>
                  </select>
                  <button type="submit" className="prep-day-add-button">
                    <Plus size={15} />
                    <span>Add</span>
                  </button>
                </form>
                <div className="prep-items">
                  {day.items.map((item) => (
                    <div className={`prep-item ${topicLevel(item)} ${item.done ? "done" : ""}`} key={item.id}>
                      <label className="prep-check">
                        <input
                          type="checkbox"
                          checked={Boolean(item.done)}
                          onChange={(e) => updatePrepItemDone(item.id, e.target.checked)}
                        />
                        <span>
                          <strong>{item.title}</strong>
                          <small>{prepItemMeta(item)}</small>
                        </span>
                      </label>
                      <button className="prep-plan-button" type="button" onClick={() => prepItemToTask(item)} title="Add to today" aria-label="Add to today">
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function TodoForm({ todoForm, setTodoForm, addTodo }) {
  return (
    <form onSubmit={addTodo} className="stack-form">
      <label>
        To-do
        <input value={todoForm.title} onChange={(e) => setTodoForm({ ...todoForm, title: e.target.value })} />
      </label>
      <label>
        Detail
        <textarea value={todoForm.detail} onChange={(e) => setTodoForm({ ...todoForm, detail: e.target.value })} />
      </label>
      <div className="form-row">
        <label>
          Due date
          <input type="date" value={todoForm.dueDate} onChange={(e) => setTodoForm({ ...todoForm, dueDate: e.target.value })} />
        </label>
        <label>
          Due time
          <input
            type="time"
            value={todoForm.dueTime}
            onChange={(e) => setTodoForm({ ...todoForm, dueTime: e.target.value })}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Plan duration
          <input
            type="number"
            min="1"
            step="1"
            value={todoForm.plannedHours}
            onChange={(e) => setTodoForm({ ...todoForm, plannedHours: e.target.value })}
          />
        </label>
        <label>
          Unit
          <select
            value={todoForm.durationUnit}
            onChange={(e) => setTodoForm({ ...todoForm, durationUnit: e.target.value })}
          >
            <option value="hours">Hours</option>
            <option value="minutes">Minutes</option>
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          Priority
          <select value={todoForm.priority} onChange={(e) => setTodoForm({ ...todoForm, priority: e.target.value })}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <div className="mini-actions single-action">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setTodoForm({
                ...todoForm,
                detail: "",
                dueDate: "",
                dueTime: "",
                plannedHours: "",
                durationUnit: "hours",
                priority: "medium",
              })
            }
          >
            Clear All
          </button>
        </div>
      </div>
      <button className="primary-button todo-submit-button" type="submit">
        <Plus size={18} />
        Add To-Do
      </button>
    </form>
  );
}

function TodoGroups({ todos, selectedDate, updateTodo, deleteTodo, todoToTask }) {
  const groups = groupTodos(todos, selectedDate);
  return (
      <div className="todo-groups todo-groups-inline">
        {Object.entries(groups).map(([label, items]) => (
          <section className="todo-section" key={label}>
            <h3>{label}</h3>
            {items.length === 0 ? (
              <p className="muted">Nothing here.</p>
            ) : (
              items.map((todo) => (
                <article className={`todo-card ${todo.priority} ${todo.status}`} key={todo.id}>
                  <div>
                    <h4>{todo.title}</h4>
                    {todo.detail && <p>{todo.detail}</p>}
                    <span>
                      {todo.dueDate || "No due date"}
                      {todo.dueTime ? ` at ${todo.dueTime}` : ""}
                      {todo.plannedMinutes ? ` · ${formatHoursFromMinutes(todo.plannedMinutes)}` : ""}
                      {todo.plannedTaskId ? " · planned" : ""}
                    </span>
                  </div>
                  <div className="todo-actions">
                    {todo.status !== "complete" && (
                      todo.plannedTaskId ? (
                        <button className="icon-button planned-button" disabled>
                          <Check size={17} />
                          <span>Planned</span>
                        </button>
                      ) : Number(todo.plannedMinutes) ? (
                        <IconButton label="Plan" onClick={() => todoToTask(todo)} icon={Clock3} tone="plan" />
                      ) : (
                        <span className="todo-note">No time</span>
                      )
                    )}
                    {todo.status !== "complete" && (
                      <IconButton
                        label="Done"
                        onClick={() =>
                          updateTodo(todo.id, {
                            status: "complete",
                            completedAt: Date.now(),
                          })
                        }
                        icon={Check}
                        tone="done"
                      />
                    )}
                    <IconButton label="Delete" onClick={() => deleteTodo(todo.id)} icon={Trash2} danger />
                  </div>
                </article>
              ))
            )}
          </section>
        ))}
      </div>
  );
}

function groupTodos(todos, selectedDate = todayKey()) {
  const sorted = [...todos].sort(
    (a, b) =>
      (a.status === "complete") - (b.status === "complete") ||
      (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99") ||
      (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99") ||
      priorityRank(a.priority) - priorityRank(b.priority),
  );
  const selectedDateLabel =
    selectedDate === todayKey() ? "Today" : displayDate(selectedDate);
  return {
    Overdue: sorted.filter((todo) => todo.status !== "complete" && todo.dueDate && todo.dueDate < selectedDate),
    [selectedDateLabel]: sorted.filter((todo) => todo.status !== "complete" && todo.dueDate === selectedDate),
    Upcoming: sorted.filter((todo) => todo.status !== "complete" && todo.dueDate > selectedDate),
    "No Date": sorted.filter((todo) => todo.status !== "complete" && !todo.dueDate),
    Completed: sorted.filter((todo) => todo.status === "complete"),
  };
}

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function IconButton({ label, onClick, icon: Icon, danger = false, tone = "" }) {
  return (
    <button className={`icon-button ${danger ? "danger" : ""} ${tone ? `tone-${tone}` : ""}`} onClick={onClick} title={label} aria-label={label}>
      <Icon size={17} />
      <span>{label}</span>
    </button>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
