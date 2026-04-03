import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Avatar from "../components/Avatar.jsx";
import ProgressModal from "../components/ProgressModal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { endpoints } from "../services/api.js";
import { useWallet } from "../context/WalletContext.jsx";
import {
  keccakName,
  parseEmployeeCreatedId,
  describeChainError,
} from "../blockchain/contract.js";
import { shortAddress, toCSV, downloadCSV } from "../utils/format.js";
import { toast } from "../utils/toast.js";

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(null); // { title, step } or null
  const {
    hasMetaMask,
    account,
    onRightChain,
    isOwner,
    ownerAddress,
    connect,
    getWriteContract,
  } = useWallet();

  // Gate every on-chain write. Returns true if we can proceed.
  const ensureReadyToSign = async () => {
    if (!hasMetaMask) {
      toast.error("Install MetaMask to submit on-chain transactions.");
      return false;
    }
    if (!account) {
      const r = await connect();
      if (!r.ok) {
        toast.error(r.error || "Please connect your wallet.");
        return false;
      }
    }
    if (!onRightChain) {
      toast.error("MetaMask is on the wrong network. Switch to Ganache (5777).");
      return false;
    }
    if (ownerAddress && !isOwner) {
      toast.error(
        `Connected as ${account} but contract owner is ${ownerAddress}. Import the deployer key into MetaMask.`
      );
      return false;
    }
    return true;
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await endpoints.listEmployees();
      setEmployees(data.employees || []);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(),
    [employees]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return employees.filter((e) => {
      if (dept && e.department !== dept) return false;
      if (!term) return true;
      return (
        String(e.employeeId).includes(term) ||
        (e.name || "").toLowerCase().includes(term) ||
        (e.email || "").toLowerCase().includes(term) ||
        (e.walletAddress || "").toLowerCase().includes(term) ||
        (e.role || "").toLowerCase().includes(term)
      );
    });
  }, [employees, q, dept]);

  const exportCSV = () => {
    const csv = toCSV(filtered, [
      { header: "ID", value: "employeeId" },
      { header: "Name", value: "name" },
      { header: "Email", value: "email" },
      { header: "Department", value: "department" },
      { header: "Role", value: "role" },
      { header: "Wallet", value: "walletAddress" },
      { header: "Status", value: (r) => (r.isActive ? "active" : "inactive") },
      { header: "TxHash", value: "txHash" },
    ]);
    downloadCSV(`employees-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const onCreate = async (payload) => {
    if (!(await ensureReadyToSign())) return;
    setCreating(true);
    try {
      // 1. Auto-provision a wallet address if HR didn't supply one. We generate
      //    it client-side so it ends up in both the MetaMask tx and the Mongo
      //    mirror with the same value.
      const walletAddress = payload.walletAddress?.trim()
        ? ethers.getAddress(payload.walletAddress.trim())
        : ethers.Wallet.createRandom().address;

      // 2. Submit the tx through MetaMask — this pops the confirmation.
      setProgress({ title: "Confirm in MetaMask…", step: "awaiting signature" });
      const contract = await getWriteContract();
      const tx = await contract.createEmployee(
        keccakName(payload.name),
        payload.department,
        payload.role,
        walletAddress
      );

      // 3. Wait for the tx to be mined, then read the new employeeId from the
      //    EmployeeCreated event in the receipt.
      setProgress({
        title: "Waiting for confirmation…",
        step: `tx ${tx.hash.slice(0, 10)}…`,
      });
      const receipt = await tx.wait();
      const employeeId = parseEmployeeCreatedId(receipt, contract.interface);
      if (!employeeId) {
        throw new Error("Chain accepted the tx but no EmployeeCreated event was emitted.");
      }

      // 4. Tell the backend to mirror this into Mongo + provision login.
      setProgress({ title: "Saving to database…", step: `#${employeeId}` });
      const { data } = await endpoints.mirrorCreateEmployee({
        txHash: tx.hash,
        employeeId,
        name: payload.name,
        email: payload.email,
        department: payload.department,
        role: payload.role,
        walletAddress,
        joinDate: payload.joinDate,
        salary: payload.salary,
        personal: payload.personal,
        education: payload.education,
        documents: payload.documents,
        loginPassword: payload.loginPassword || undefined,
      });

      toast.success(`Employee #${employeeId} created on-chain ✓`);
      if (data?.login?.error) {
        toast.error(`Login not created: ${data.login.error}`);
      } else if (data?.login?.email) {
        toast.success(`Login issued for ${data.login.email}`);
      }
      setShowCreate(false);
      await load();
    } catch (e) {
      toast.error(describeChainError(e) || e?.response?.data?.error || "Failed to create employee");
    } finally {
      setCreating(false);
      setProgress(null);
    }
  };

  const onDeactivate = async (id) => {
    if (!confirm(`Deactivate employee #${id}? You'll need to confirm in MetaMask.`)) {
      return;
    }
    if (!(await ensureReadyToSign())) return;
    try {
      setProgress({ title: "Confirm in MetaMask…", step: `deactivate #${id}` });
      const contract = await getWriteContract();
      let tx;
      try {
        tx = await contract.deactivateEmployee(id);
      } catch (err) {
        // Stale Mongo row: chain doesn't know about this id (e.g. redeployed
        // contract). Fall back to the backend's Mongo-only soft-delete.
        const msg = describeChainError(err);
        if (/doesn't exist on-chain|EmployeeNotFound|already inactive/i.test(msg)) {
          setProgress({ title: "Soft-deleting stale record…", step: `#${id}` });
          const { data } = await endpoints.deleteEmployee(id);
          if (data?.warning) {
            toast.success(`Employee #${id} marked inactive (chain out of sync)`);
          } else {
            toast.success(`Employee #${id} deactivated`);
          }
          await load();
          return;
        }
        throw err;
      }

      setProgress({
        title: "Waiting for confirmation…",
        step: `tx ${tx.hash.slice(0, 10)}…`,
      });
      await tx.wait();

      setProgress({ title: "Saving to database…", step: `#${id}` });
      await endpoints.mirrorDeleteEmployee(id, tx.hash);
      toast.success(`Employee #${id} deactivated ✓`);
      await load();
    } catch (e) {
      toast.error(describeChainError(e) || e?.response?.data?.error || "Failed");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} total · ${employees.filter((e) => e.isActive).length} active`}
        actions={
          <>
            <button className="btn-ghost" onClick={exportCSV}>
              ⬇ Export CSV
            </button>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              + Add Employee
            </button>
          </>
        }
      />

      <div className="glass p-4 flex flex-wrap gap-3 items-center">
        <input
          className="input max-w-xs"
          placeholder="Search name, wallet, email, role..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input max-w-[200px]"
          value={dept}
          onChange={(e) => setDept(e.target.value)}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {(q || dept) && (
          <button
            className="btn-ghost !py-1.5"
            onClick={() => {
              setQ("");
              setDept("");
            }}
          >
            Clear
          </button>
        )}
        <div className="ml-auto text-xs text-slate-500">
          Showing {filtered.length} of {employees.length}
        </div>
      </div>

      <div className="glass overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No employees match"
            hint="Try a different filter, or add a new employee."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 w-14">#</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Wallet</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.employeeId} className="table-row">
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {e.employeeId}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar address={e.walletAddress} name={e.name} size={28} />
                        <span className="text-white">{e.name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{e.email || "—"}</td>
                    <td className="px-4 py-3">{e.department}</td>
                    <td className="px-4 py-3">{e.role}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {shortAddress(e.walletAddress)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.isActive ? "active" : "inactive"} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/employees/${e.employeeId}`}
                          className="btn-ghost !py-1 !px-2 text-xs"
                        >
                          View
                        </Link>
                        {e.isActive && (
                          <button
                            className="btn-ghost !py-1 !px-2 text-xs text-red-300 hover:bg-red-500/10 border-red-500/20"
                            onClick={() => onDeactivate(e.employeeId)}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateEmployeeModal
          onCancel={() => setShowCreate(false)}
          onSubmit={onCreate}
        />
      )}
      <ProgressModal
        open={!!progress}
        title={progress?.title || "Submitting on-chain"}
        hint={progress?.step || "Waiting for block confirmation…"}
      />
    </div>
  );
}

function CreateEmployeeModal({ onCancel, onSubmit }) {
  const [step, setStep] = useState(1); // 1 = core/login, 2 = personal, 3 = education, 4 = docs
  const [form, setForm] = useState({
    // core
    name: "",
    email: "",
    department: "",
    role: "",
    joinDate: "",
    salary: "",
    // login (HR sets initial password; user forced to change on first login)
    loginPassword: "",
    // personal
    personal: {
      dateOfBirth: "",
      gender: "",
      phone: "",
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      nationality: "",
      bio: "",
    },
    // education + documents grow dynamically
    education: [],
    documents: [],
  });

  const updateTop = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const updatePersonal = (k) => (e) =>
    setForm((f) => ({ ...f, personal: { ...f.personal, [k]: e.target.value } }));

  const addEducation = () =>
    setForm((f) => ({
      ...f,
      education: [
        ...f.education,
        { degree: "", field: "", institution: "", year: "", grade: "" },
      ],
    }));
  const updateEducation = (idx, k) => (e) =>
    setForm((f) => {
      const next = [...f.education];
      next[idx] = { ...next[idx], [k]: e.target.value };
      return { ...f, education: next };
    });
  const removeEducation = (idx) =>
    setForm((f) => ({
      ...f,
      education: f.education.filter((_, i) => i !== idx),
    }));

  // Read each file as a base64 data URL — matches the Employee document schema.
  const onFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    const read = (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            name: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            dataUrl: reader.result,
          });
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    const encoded = await Promise.all(files.map(read));
    setForm((f) => ({ ...f, documents: [...f.documents, ...encoded] }));
  };
  const removeDocument = (idx) =>
    setForm((f) => ({
      ...f,
      documents: f.documents.filter((_, i) => i !== idx),
    }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.department || !form.role) {
      toast.error("Name, email, department, and role are required");
      setStep(1);
      return;
    }
    if (form.loginPassword && form.loginPassword.length < 6) {
      toast.error("Initial password must be at least 6 characters");
      setStep(1);
      return;
    }
    // Strip empty education rows before submitting
    const cleanEducation = form.education.filter(
      (r) => r.degree || r.field || r.institution
    );
    onSubmit({
      ...form,
      education: cleanEducation,
      salary: form.salary ? Number(form.salary) : 0,
      joinDate: form.joinDate || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <form
        onSubmit={submit}
        className="glass-strong w-full max-w-3xl p-6 animate-fade-in my-8"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">New employee</h2>
            <p className="text-xs text-slate-500 mt-1">
              Record the employee on-chain and optionally issue login credentials.
            </p>
          </div>
          <StepTabs step={step} setStep={setStep} />
        </div>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name *" value={form.name} onChange={updateTop("name")} />
            <Field label="Work email *" value={form.email} onChange={updateTop("email")} type="email" />
            <Field label="Department *" value={form.department} onChange={updateTop("department")} />
            <Field label="Role *" value={form.role} onChange={updateTop("role")} />
            <Field label="Join date" type="date" value={form.joinDate} onChange={updateTop("joinDate")} />
            <Field label="Base salary" type="number" value={form.salary} onChange={updateTop("salary")} placeholder="0" />
            <div className="col-span-2 pt-2 border-t border-white/5 mt-2">
              <div className="kpi-label mb-2">Login credentials</div>
              <p className="text-xs text-slate-500 mb-3">
                Set an initial password. The employee will be forced to change it
                on first sign-in. Leave blank to skip creating a login.
              </p>
              <Field
                label="Initial password"
                type="password"
                value={form.loginPassword}
                onChange={updateTop("loginPassword")}
                placeholder="At least 6 characters"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth" type="date" value={form.personal.dateOfBirth} onChange={updatePersonal("dateOfBirth")} />
            <Field label="Gender" value={form.personal.gender} onChange={updatePersonal("gender")} placeholder="male / female / other" />
            <Field label="Phone" value={form.personal.phone} onChange={updatePersonal("phone")} />
            <Field label="Nationality" value={form.personal.nationality} onChange={updatePersonal("nationality")} />
            <div className="col-span-2">
              <Field label="Address" value={form.personal.address} onChange={updatePersonal("address")} />
            </div>
            <Field label="Emergency contact name" value={form.personal.emergencyContactName} onChange={updatePersonal("emergencyContactName")} />
            <Field label="Emergency contact phone" value={form.personal.emergencyContactPhone} onChange={updatePersonal("emergencyContactPhone")} />
            <div className="col-span-2">
              <label className="block">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Bio</div>
                <textarea
                  className="input min-h-[80px]"
                  value={form.personal.bio}
                  onChange={updatePersonal("bio")}
                  placeholder="Short summary — background, interests, etc."
                />
              </label>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {form.education.length === 0 && (
              <div className="text-sm text-slate-400">
                No education records yet.
              </div>
            )}
            {form.education.map((row, idx) => (
              <div key={idx} className="glass p-3 grid grid-cols-2 gap-3 relative">
                <Field label="Degree" value={row.degree} onChange={updateEducation(idx, "degree")} placeholder="B.Tech / MBA" />
                <Field label="Field" value={row.field} onChange={updateEducation(idx, "field")} placeholder="Computer Science" />
                <Field label="Institution" value={row.institution} onChange={updateEducation(idx, "institution")} />
                <Field label="Year" type="number" value={row.year} onChange={updateEducation(idx, "year")} />
                <div className="col-span-2">
                  <Field label="Grade" value={row.grade} onChange={updateEducation(idx, "grade")} placeholder="8.5 CGPA / First Class" />
                </div>
                <button
                  type="button"
                  onClick={() => removeEducation(idx)}
                  className="absolute top-2 right-2 text-xs text-red-300 hover:text-red-200"
                >
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn-ghost w-full" onClick={addEducation}>
              + Add education record
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="glass p-4 border-dashed border-white/10 border-2 text-center">
              <input
                id="doc-upload"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
              <label
                htmlFor="doc-upload"
                className="btn-ghost cursor-pointer inline-block"
              >
                📎 Upload documents
              </label>
              <p className="text-xs text-slate-500 mt-2">
                Files are embedded as base64. Keep uploads small (resumes, IDs,
                offer letters).
              </p>
            </div>
            {form.documents.map((d, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between glass p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{d.name}</div>
                  <div className="text-xs text-slate-500">
                    {d.mimeType || "—"} · {Math.round((d.sizeBytes || 0) / 1024)} KB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeDocument(idx)}
                  className="text-xs text-red-300 hover:text-red-200"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-between gap-2">
          <div>
            {step > 1 && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setStep(step - 1)}
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            {step < 4 ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setStep(step + 1)}
              >
                Next →
              </button>
            ) : (
              <button type="submit" className="btn-primary">
                Create on-chain
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

const StepTabs = ({ step, setStep }) => {
  const tabs = [
    [1, "Core"],
    [2, "Personal"],
    [3, "Education"],
    [4, "Documents"],
  ];
  return (
    <div className="flex gap-1 text-xs">
      {tabs.map(([n, label]) => (
        <button
          key={n}
          type="button"
          onClick={() => setStep(n)}
          className={`px-2.5 py-1 rounded-lg border ${
            step === n
              ? "border-neon-violet/50 bg-neon-violet/20 text-white"
              : "border-white/10 text-slate-400 hover:text-white"
          }`}
        >
          {n}. {label}
        </button>
      ))}
    </div>
  );
};

const Field = ({ label, mono, ...props }) => (
  <label className="block">
    <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">{label}</div>
    <input className={`input ${mono ? "font-mono" : ""}`} {...props} />
  </label>
);
