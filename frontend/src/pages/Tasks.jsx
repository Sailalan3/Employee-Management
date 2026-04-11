import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { endpoints } from "../services/api.js";
import { formatDate } from "../utils/format.js";
import { toast } from "../utils/toast.js";

const COLUMNS = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showProject, setShowProject] = useState(false);
  const [filterProject, setFilterProject] = useState("");

  const load = async () => {
    try {
      const [t, p, e] = await Promise.all([
        endpoints.listTasks(),
        endpoints.listProjects(),
        endpoints.listEmployees(),
      ]);
      setTasks(t.data.tasks || []);
      setProjects(p.data.projects || []);
      setEmployees(e.data.employees || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      filterProject
        ? tasks.filter((t) => t.projectId === filterProject)
        : tasks,
    [tasks, filterProject]
  );

  const byStatus = useMemo(() => {
    const groups = { todo: [], in_progress: [], review: [], done: [] };
    for (const t of filtered) {
      (groups[t.status] || groups.todo).push(t);
    }
    return groups;
  }, [filtered]);

  const moveTask = async (task, status) => {
    try {
      await endpoints.updateTask(task._id, { status });
      toast.success(`Moved to ${status.replace("_", " ")}`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks & Projects"
        subtitle={`${tasks.length} tasks · ${projects.length} projects`}
        actions={
          <>
            <button className="btn-ghost" onClick={() => setShowProject(true)}>
              + Project
            </button>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              + Task
            </button>
          </>
        }
      />

      <div className="glass p-3 flex flex-wrap items-center gap-3">
        <select
          className="input max-w-[240px]"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="text-xs text-slate-500">
          Showing {filtered.length} of {tasks.length}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className="glass p-3 min-h-[240px]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">{col.label}</div>
              <span className="chip">{byStatus[col.key].length}</span>
            </div>
            <div className="space-y-2">
              {byStatus[col.key].map((t) => (
                <TaskCard
                  key={t._id}
                  task={t}
                  employees={employees}
                  onMove={(s) => moveTask(t, s)}
                />
              ))}
              {!byStatus[col.key].length && (
                <div className="text-xs text-slate-500 text-center py-8">Empty</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <TaskModal
          projects={projects}
          employees={employees}
          onCancel={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await load();
          }}
        />
      )}
      {showProject && (
        <ProjectModal
          onCancel={() => setShowProject(false)}
          onCreated={async () => {
            setShowProject(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

const nextStatus = { todo: "in_progress", in_progress: "review", review: "done", done: "todo" };

function TaskCard({ task, employees, onMove }) {
  const assignee = employees.find((e) => e.employeeId === task.assigneeId);
  return (
    <div
      className="group rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-3 cursor-pointer transition"
      onClick={() => onMove(nextStatus[task.status])}
      title="Click to advance status"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm text-white">{task.title}</div>
        <StatusBadge status={task.priority} />
      </div>
      {task.description && (
        <div className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</div>
      )}
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span>{assignee?.name || (task.assigneeId ? `#${task.assigneeId}` : "Unassigned")}</span>
        {task.dueDate && <span>Due {formatDate(task.dueDate)}</span>}
      </div>
    </div>
  );
}

function TaskModal({ projects, employees, onCancel, onCreated }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    projectId: "",
    assigneeId: "",
    priority: "medium",
    dueDate: "",
    estimatedHours: 0,
  });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await endpoints.createTask({
        ...form,
        projectId: form.projectId || undefined,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : undefined,
        dueDate: form.dueDate || undefined,
      });
      toast.success("Task created");
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed");
    }
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="glass-strong w-full max-w-lg p-6 animate-fade-in">
        <h2 className="text-lg font-semibold mb-4">New task</h2>
        <div className="space-y-3">
          <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <textarea className="input" placeholder="Description (optional)" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">No project</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            <select className="input" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
              <option value="">Unassigned</option>
              {employees.map((e) => <option key={e.employeeId} value={e.employeeId}>{e.name || `#${e.employeeId}`}</option>)}
            </select>
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </div>
  );
}

function ProjectModal({ onCancel, onCreated }) {
  const [form, setForm] = useState({ name: "", description: "", status: "active" });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await endpoints.createProject(form);
      toast.success("Project created");
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed");
    }
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="glass-strong w-full max-w-md p-6 animate-fade-in">
        <h2 className="text-lg font-semibold mb-4">New project</h2>
        <div className="space-y-3">
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <textarea className="input" placeholder="Description" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {["planning", "active", "on_hold", "completed"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </div>
  );
}
