import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, PawPrint, Syringe, TrendingUp, Wheat,
  Plus, X, Menu, Search, Trash2, CheckCircle2, ArrowUp, ArrowDown,
  Package, ChevronRight, Sprout, Users, UserPlus, LogOut, Ban,
  Pencil, Lock, Activity, Heart, FileText,
  Banknote, Receipt, TrendingDown, Wallet, BadgeDollarSign, Settings, Printer,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { api } from "./api";

// ─── Constants ───────────────────────────────────────────────────────────────
const SPECIES      = ["Cattle","Goat","Sheep","Pig","Chicken","Horse","Other"];
const SEX_OPTIONS  = ["Female","Male"];
const STATUS_OPTIONS = ["Healthy","Sick","Pregnant","Quarantine","Sold","Deceased"];
const ORIGIN_OPTIONS = ["Born in herd","Purchased"];
const ROLE_OPTIONS = ["Admin","Manager","Worker"];
const GENDER_OPTIONS = ["", "Female", "Male", "Other", "Prefer not to say"];
const HEALTH_EVENT_TYPES = ["Observation","Treatment","Injury","Illness","Recovery","Other"];
const SALE_TYPES     = ["Animal sale","Milk / dairy","Eggs","Wool / hide","Other produce","Other"];
const EXPENSE_CATS   = ["Animal purchase","Feed purchase","Veterinary","Medication","Labor","Equipment","Transport","Utilities","Other"];
const PARTNER_TYPES  = ["Supplier","Customer","Both"];
const CONTRACT_DIRECTIONS = ["Supply to farm","Farm output"];
const CONTRACT_STATUSES = ["Draft","Active","Paused","Ended"];
const BILLING_CYCLES = ["On delivery","Weekly","Monthly","Seasonal","Other"];
const INVOICE_DIRECTIONS = ["Payable","Receivable"];
const INVOICE_STATUSES = ["Draft","Issued","Part paid","Paid","Overdue","Cancelled"];
const LOAN_STATUSES = ["Active","Paid","Defaulted","Written off"];
const LOAN_PAYMENT_FREQUENCIES = ["Weekly","Monthly","Quarterly","Seasonal","Flexible"];
const MONTH_OPTIONS = [
  { value:1, label:"January" }, { value:2, label:"February" }, { value:3, label:"March" },
  { value:4, label:"April" }, { value:5, label:"May" }, { value:6, label:"June" },
  { value:7, label:"July" }, { value:8, label:"August" }, { value:9, label:"September" },
  { value:10, label:"October" }, { value:11, label:"November" }, { value:12, label:"December" },
];
const SUBSCRIPTION_PLANS = [
  { value:"free", label:"Free", price:"KES 0", limit:"Up to 20 active animals" },
  { value:"standard", label:"Standard", price:"KES 500/month", limit:"Up to 100 active animals" },
  { value:"business", label:"Business", price:"KES 1,200/month", limit:"Up to 500 active animals" },
  { value:"commercial", label:"Commercial", price:"From KES 2,500/month", limit:"Up to 2,000 active animals" },
  { value:"enterprise", label:"Enterprise", price:"Contact us", limit:"Custom animals, farms, users, and support" },
];
const SUBSCRIPTION_BILLING_CYCLES = [
  { value:"monthly", label:"Monthly" },
  { value:"annual", label:"Annual" },
];
const PIE_COLORS     = ["#A23B2E","#D9A441","#3F5D45","#8A7B62","#6C4F3D","#C97B53","#5B7A8C"];
const BAR_REVENUE    = "#3F5D45";
const BAR_EXPENSE    = "#A23B2E";

const PAGE_TITLES = {
  dashboard:    "Farm Overview",
  livestock:    "Livestock Overview",
  animals:      "Livestock Register",
  vaccinations: "Vaccination Records",
  growth:       "Growth Tracking",
  feed:         "Feed Inventory",
  finances:     "Finances",
  statement:    "Farm Statement",
  contracts:    "Contracts & Invoices",
  loans:        "Loans & Payments",
  sales:        "Sales & Revenue",
  expenses:     "Expenses",
  users:        "User Management",
  profile:      "Profile",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d + "T00:00:00");
  if (isNaN(date)) return "—";
  return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric"}).format(date);
}

function todayStr() { return new Date().toISOString().slice(0,10); }

function calcAge(dob) {
  if (!dob) return "—";
  const d = new Date(dob + "T00:00:00"), now = new Date();
  if (isNaN(d)) return "—";
  const days = Math.floor((now - d) / 86400000);
  if (days < 0)  return "—";
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.floor(days/7)}w`;
  let y = now.getFullYear() - d.getFullYear(), m = now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) m--;
  if (m < 0) { y--; m += 12; }
  if (y <= 0) return `${m}mo`;
  return `${y}y ${m}mo`;
}

function getVaxStatus(nextDue) {
  if (!nextDue) return { label:"No follow-up", tone:"neutral" };
  const diff = Math.round((new Date(nextDue+"T00:00:00") - new Date(todayStr()+"T00:00:00")) / 86400000);
  if (diff < 0)  return { label:"Overdue",  tone:"danger" };
  if (diff <= 14) return { label:"Due soon", tone:"warning" };
  return { label:"Up to date", tone:"success" };
}

function getFeedStatus(item) {
  if (item.quantityKg <= item.reorderLevel)       return { label:"Low stock", tone:"danger" };
  if (item.quantityKg <= item.reorderLevel * 1.5) return { label:"Watch",     tone:"warning" };
  return { label:"OK", tone:"success" };
}

function currency(n) {
  return (Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
}

function currencyShort(n) {
  const v = Number(n)||0;
  if (Math.abs(v)>=1_000_000) return (v/1_000_000).toFixed(1)+"M";
  if (Math.abs(v)>=1_000)     return (v/1_000).toFixed(1)+"K";
  return v.toLocaleString(undefined,{maximumFractionDigits:0});
}

function monthKey(d)    { return (d||"").slice(0,7); }
function monthLabel(ym) { const [y,m]=ym.split("-"); return new Date(+y,+m-1,1).toLocaleDateString("en-GB",{month:"short",year:"2-digit"}); }

function animalGain(a) {
  return (Number(a.currentValue) || 0) - (Number(a.purchaseCost) || 0);
}

function animalRoi(a) {
  const cost = Number(a.purchaseCost) || 0;
  const current = Number(a.currentValue) || 0;
  if (!cost) return current > 0 ? Infinity : null;
  return (animalGain(a) / cost) * 100;
}

function roiLabel(value) {
  if (value === null) return "-";
  if (!Number.isFinite(value)) return "New value";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function subscriptionPlanMeta(value) {
  return SUBSCRIPTION_PLANS.find(plan => plan.value === value) || SUBSCRIPTION_PLANS[0];
}

function subscriptionCycleLabel(value) {
  return SUBSCRIPTION_BILLING_CYCLES.find(cycle => cycle.value === value)?.label || "Monthly";
}

function statusTone(s) {
  if (s === "Healthy")   return "success";
  if (s === "Sick" || s === "Deceased") return "danger";
  if (s === "Pregnant")  return "warning";
  if (s === "Quarantine") return "warning";
  return "neutral";
}

function invoiceTone(status) {
  if (status === "Paid") return "success";
  if (status === "Overdue" || status === "Cancelled") return "danger";
  if (status === "Part paid" || status === "Issued") return "warning";
  return "neutral";
}

function loanTone(status) {
  if (status === "Paid") return "success";
  if (status === "Defaulted" || status === "Written off") return "danger";
  if (status === "Active") return "warning";
  return "neutral";
}

function initials(name) {
  const p = (name||"").trim().split(/\s+/);
  return ((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase();
}

function findUserByEmail(users, email) {
  return users.find(u => u.email.toLowerCase() === (email||"").trim().toLowerCase());
}

// ─── Tiny shared UI ───────────────────────────────────────────────────────────
function EarTag({ children, size }) {
  return (
    <span className={`ear-tag ${size==="lg"?"ear-tag--lg":""}`}>
      <span className="ear-tag__hole"/>
      {children}
    </span>
  );
}

function Badge({ tone="neutral", children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

function StatCard({ icon:Icon, label, value, sub, tone="default" }) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__icon"><Icon size={18} strokeWidth={2}/></div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  );
}

function EmptyState({ icon:Icon, title, body, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <Icon size={28} strokeWidth={1.4}/>
      <h3>{title}</h3>
      <p>{body}</p>
      {actionLabel && <button className="btn btn--primary" onClick={onAction}><Plus size={15}/>{actionLabel}</button>}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
      <div className={`modal-card ${wide?"modal-card--wide":""}`}>
        <div className="modal-card__header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18}/></button>
        </div>
        <div className="modal-card__body">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, body, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="confirm-body">{body}</p>
      <div className="form-actions">
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn--danger" onClick={onConfirm}><Trash2 size={15}/>Delete</button>
      </div>
    </Modal>
  );
}

// ─── Forms ────────────────────────────────────────────────────────────────────
function AnimalForm({ onSubmit, onClose, initial }) {
  const editing = !!initial;
  const [form, setForm] = useState(initial || {
    tagId:"", name:"", species:SPECIES[0], breed:"", sex:SEX_OPTIONS[0],
    dob:"", status:"Healthy", weightKg:"", location:"",
    origin:ORIGIN_OPTIONS[0], purchaseCost:"", currentValue:"", notes:"",
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const isPurchased = form.origin === "Purchased";

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.tagId.trim()) return;
    onSubmit({
      ...form,
      weightKg:     form.weightKg     ? parseFloat(form.weightKg)     : null,
      purchaseCost: isPurchased       ? parseFloat(form.purchaseCost)||0 : 0,
      currentValue: form.currentValue ? parseFloat(form.currentValue)||0 : 0,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>Ear tag ID *<input value={form.tagId} onChange={set("tagId")} placeholder="e.g. CT-014" required/></label>
        <label>Name<input value={form.name} onChange={set("name")} placeholder="e.g. Bramble"/></label>
        <label>Species *
          <select value={form.species} onChange={set("species")}>
            {SPECIES.map(s=><option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Breed<input value={form.breed} onChange={set("breed")} placeholder="e.g. Jersey"/></label>
        <label>Sex
          <select value={form.sex} onChange={set("sex")}>
            {SEX_OPTIONS.map(s=><option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Date of birth<input type="date" value={form.dob} onChange={set("dob")} max={todayStr()}/></label>
        <label>Status
          <select value={form.status} onChange={set("status")}>
            {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Current weight (kg)<input type="number" min="0" step="0.1" value={form.weightKg} onChange={set("weightKg")} placeholder="e.g. 240"/></label>
        <label>Origin
          <select value={form.origin}
            onChange={e=>setForm(f=>({...f,origin:e.target.value,purchaseCost:e.target.value==="Born in herd"?"":f.purchaseCost}))}>
            {ORIGIN_OPTIONS.map(o=><option key={o}>{o}</option>)}
          </select>
        </label>
        {isPurchased
          ? <label>Purchase cost *<input type="number" min="0" step="0.01" value={form.purchaseCost} onChange={e=>setForm(f=>({...f,purchaseCost:e.target.value,currentValue:f.currentValue||e.target.value}))} placeholder="e.g. 15000" required/></label>
          : <label>Purchase cost<input value="0 — born in herd" disabled/></label>
        }
        <label>Current value<input type="number" min="0" step="0.01" value={form.currentValue} onChange={set("currentValue")} placeholder="Estimated sale value"/></label>
        <label className="span-2">Pen / location<input value={form.location} onChange={set("location")} placeholder="e.g. North Paddock"/></label>
        <label className="span-2">Notes / remarks<textarea rows={2} value={form.notes} onChange={set("notes")} placeholder="Any additional notes about this animal…"/></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><Plus size={15}/>{editing?"Save changes":"Add animal"}</button>
      </div>
    </form>
  );
}

function VaccinationForm({ animals, defaultAnimalId, onSubmit, onClose }) {
  const [form, setForm] = useState({
    animalId: defaultAnimalId || (animals[0]?.id || ""),
    vaccine:"", dateGiven:todayStr(), nextDue:"", administeredBy:"", batchNo:"", notes:"",
  });
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  if (!animals.length) return (
    <div><p className="confirm-body">Add at least one animal before recording a vaccination.</p>
      <div className="form-actions"><button className="btn btn--ghost" onClick={onClose}>Close</button></div></div>
  );

  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.animalId||!form.vaccine.trim())return;onSubmit(form);}}>
      <div className="form-grid">
        <label className="span-2">Animal *
          <select value={form.animalId} onChange={set("animalId")}>
            {animals.map(a=><option key={a.id} value={a.id}>{a.tagId}{a.name?` — ${a.name}`:""} ({a.species})</option>)}
          </select>
        </label>
        <label className="span-2">Vaccine / treatment *<input value={form.vaccine} onChange={set("vaccine")} placeholder="e.g. Foot-and-mouth booster" required/></label>
        <label>Date administered<input type="date" value={form.dateGiven} onChange={set("dateGiven")} max={todayStr()}/></label>
        <label>Next due<input type="date" value={form.nextDue} onChange={set("nextDue")}/></label>
        <label>Administered by<input value={form.administeredBy} onChange={set("administeredBy")} placeholder="e.g. Dr. Wanjiru"/></label>
        <label>Batch number<input value={form.batchNo} onChange={set("batchNo")} placeholder="optional"/></label>
        <label className="span-2">Notes<textarea rows={2} value={form.notes} onChange={set("notes")} placeholder="Dosage, reaction, observations…"/></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><Plus size={15}/>Record vaccination</button>
      </div>
    </form>
  );
}

function GrowthForm({ animals, defaultAnimalId, onSubmit, onClose }) {
  const [form, setForm] = useState({
    animalId: defaultAnimalId || (animals[0]?.id || ""),
    date:todayStr(), weightKg:"", bodyCondition:"", notes:"",
  });
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  if (!animals.length) return (
    <div><p className="confirm-body">Add at least one animal before logging a growth record.</p>
      <div className="form-actions"><button className="btn btn--ghost" onClick={onClose}>Close</button></div></div>
  );

  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.weightKg)return;onSubmit({...form,weightKg:parseFloat(form.weightKg)});}}>
      <div className="form-grid">
        <label className="span-2">Animal *
          <select value={form.animalId} onChange={set("animalId")}>
            {animals.map(a=><option key={a.id} value={a.id}>{a.tagId}{a.name?` — ${a.name}`:""}</option>)}
          </select>
        </label>
        <label>Date *<input type="date" value={form.date} onChange={set("date")} max={todayStr()} required/></label>
        <label>Weight (kg) *<input type="number" min="0" step="0.1" value={form.weightKg} onChange={set("weightKg")} required/></label>
        <label className="span-2">Body condition score (1–5)
          <select value={form.bodyCondition} onChange={set("bodyCondition")}>
            <option value="">Not assessed</option>
            {["1 — Emaciated","2 — Thin","3 — Ideal","4 — Fat","5 — Obese"].map(s=><option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="span-2">Notes<textarea rows={2} value={form.notes} onChange={set("notes")} placeholder="Diet change, pasture, condition…"/></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><Plus size={15}/>Log weight</button>
      </div>
    </form>
  );
}

function HealthEventForm({ animals, defaultAnimalId, onSubmit, onClose }) {
  const [form, setForm] = useState({
    animalId: defaultAnimalId || (animals[0]?.id || ""),
    type: HEALTH_EVENT_TYPES[0], date:todayStr(), description:"", treatment:"",
    vetName:"", followUpDate:"", resolved:false,
  });
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  if (!animals.length) return (
    <div><p className="confirm-body">Add at least one animal to log a health event.</p>
      <div className="form-actions"><button className="btn btn--ghost" onClick={onClose}>Close</button></div></div>
  );

  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.description.trim())return;onSubmit({...form,resolved:form.resolved==="true"||form.resolved===true});}}>
      <div className="form-grid">
        <label className="span-2">Animal *
          <select value={form.animalId} onChange={set("animalId")}>
            {animals.map(a=><option key={a.id} value={a.id}>{a.tagId}{a.name?` — ${a.name}`:""} ({a.species})</option>)}
          </select>
        </label>
        <label>Event type
          <select value={form.type} onChange={set("type")}>
            {HEALTH_EVENT_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </label>
        <label>Date<input type="date" value={form.date} onChange={set("date")} max={todayStr()}/></label>
        <label className="span-2">Description *<input value={form.description} onChange={set("description")} placeholder="e.g. Limping on left front leg" required/></label>
        <label className="span-2">Treatment given<input value={form.treatment} onChange={set("treatment")} placeholder="e.g. Penicillin 10ml, bandaged"/></label>
        <label>Vet / treated by<input value={form.vetName} onChange={set("vetName")} placeholder="e.g. Dr. Otieno"/></label>
        <label>Follow-up date<input type="date" value={form.followUpDate} onChange={set("followUpDate")}/></label>
        <label className="span-2">Status
          <select value={form.resolved} onChange={set("resolved")}>
            <option value={false}>Open / ongoing</option>
            <option value={true}>Resolved</option>
          </select>
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><Plus size={15}/>Log health event</button>
      </div>
    </form>
  );
}

function FeedForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({ feedType:"", quantityKg:"", reorderLevel:"", costPerKg:"", supplier:"", unit:"kg" });
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.feedType.trim()||form.quantityKg==="")return;onSubmit({...form,quantityKg:parseFloat(form.quantityKg)||0,reorderLevel:parseFloat(form.reorderLevel)||0,costPerKg:parseFloat(form.costPerKg)||0,lastRestocked:todayStr()});}}>
      <div className="form-grid">
        <label className="span-2">Feed type *<input value={form.feedType} onChange={set("feedType")} placeholder="e.g. Dairy meal" required/></label>
        <label>Quantity in stock (kg) *<input type="number" min="0" step="1" value={form.quantityKg} onChange={set("quantityKg")} required/></label>
        <label>Reorder level (kg)<input type="number" min="0" step="1" value={form.reorderLevel} onChange={set("reorderLevel")} placeholder="e.g. 50"/></label>
        <label>Cost per kg<input type="number" min="0" step="0.01" value={form.costPerKg} onChange={set("costPerKg")} placeholder="e.g. 45"/></label>
        <label>Supplier<input value={form.supplier} onChange={set("supplier")} placeholder="e.g. Highland Millers"/></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><Plus size={15}/>Add feed item</button>
      </div>
    </form>
  );
}

function AdjustStockForm({ item, mode, onSubmit, onClose }) {
  const [amount, setAmount] = useState("");
  return (
    <form onSubmit={e=>{e.preventDefault();const v=parseFloat(amount);if(!v||v<=0)return;onSubmit(mode==="add"?v:-v);}}>
      <p className="confirm-body">
        {mode==="add"?"Restocking":"Logging usage of"} <strong>{item.feedType}</strong>.{" "}
        Currently <strong>{item.quantityKg} kg</strong> in store.
      </p>
      <div className="form-grid">
        <label className="span-2">{mode==="add"?"Amount received (kg)":"Amount used (kg)"}
          <input type="number" min="0" step="1" autoFocus value={amount} onChange={e=>setAmount(e.target.value)}/>
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary">
          {mode==="add"?<ArrowUp size={15}/>:<ArrowDown size={15}/>}
          {mode==="add"?"Add to stock":"Deduct stock"}
        </button>
      </div>
    </form>
  );
}

// ─── User management forms ────────────────────────────────────────────────────
function AddUserForm({ existingUsers, onSubmit, onClose }) {
  const [form, setForm] = useState({ first_name:"", last_name:"", email:"", gender:"", phoneNumber:"", password:"", role:"Worker" });
  const [error, setError] = useState("");
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  return (
    <form onSubmit={e=>{e.preventDefault();setError("");if(!form.first_name.trim()||!form.last_name.trim()||!form.email.trim()||!form.password.trim())return;if(findUserByEmail(existingUsers,form.email)){setError("A user with that email already exists.");return;}onSubmit(form);}}>
      <div className="form-grid">
        <label>First name *<input value={form.first_name} onChange={set("first_name")} placeholder="e.g. Asha" required/></label>
        <label>Last name *<input value={form.last_name} onChange={set("last_name")} placeholder="e.g. Kimani" required/></label>
        <label className="span-2">Email *<input type="email" value={form.email} onChange={set("email")} placeholder="e.g. asha@farm.local" required/></label>
        <label>Gender
          <select value={form.gender} onChange={set("gender")}>{GENDER_OPTIONS.map(g=><option key={g} value={g}>{g || "Not specified"}</option>)}</select>
        </label>
        <label>Phone number<input value={form.phoneNumber} onChange={set("phoneNumber")} placeholder="e.g. +254 700 000 000"/></label>
        <label>Role
          <select value={form.role} onChange={set("role")}>{ROLE_OPTIONS.map(r=><option key={r}>{r}</option>)}</select>
        </label>
        <label>Temporary password *<input type="text" value={form.password} onChange={set("password")} required/></label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <p className="muted small" style={{marginTop:8}}>Share this password directly — there is no self-registration.</p>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><UserPlus size={15}/>Add user</button>
      </div>
    </form>
  );
}

function EditUserForm({ user, existingUsers, onSubmit, onClose }) {
  const [form, setForm] = useState({ first_name:user.first_name||"", last_name:user.last_name||"", email:user.email, gender:user.gender||"", phoneNumber:user.phoneNumber||"", role:user.role, password:"" });
  const [error, setError] = useState("");
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  return (
    <form onSubmit={e=>{e.preventDefault();setError("");if(!form.first_name.trim()||!form.last_name.trim()||!form.email.trim())return;const clash=findUserByEmail(existingUsers,form.email);if(clash&&clash.id!==user.id){setError("Another user already uses that email.");return;}const update={first_name:form.first_name,last_name:form.last_name,email:form.email,gender:form.gender,phoneNumber:form.phoneNumber,role:form.role};if(form.password.trim())update.password=form.password.trim();onSubmit(update);}}>
      <div className="form-grid">
        <label>First name *<input value={form.first_name} onChange={set("first_name")} required/></label>
        <label>Last name *<input value={form.last_name} onChange={set("last_name")} required/></label>
        <label className="span-2">Email *<input type="email" value={form.email} onChange={set("email")} required/></label>
        <label>Gender<select value={form.gender} onChange={set("gender")}>{GENDER_OPTIONS.map(g=><option key={g} value={g}>{g || "Not specified"}</option>)}</select></label>
        <label>Phone number<input value={form.phoneNumber} onChange={set("phoneNumber")} placeholder="e.g. +254 700 000 000"/></label>
        <label>Role<select value={form.role} onChange={set("role")}>{ROLE_OPTIONS.map(r=><option key={r}>{r}</option>)}</select></label>
        <label>Reset password<input type="text" value={form.password} onChange={set("password")} placeholder="Leave blank to keep current"/></label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><Pencil size={15}/>Save changes</button>
      </div>
    </form>
  );
}

// ─── Animal detail drawer ──────────────────────────────────────────────────────
function AnimalDrawer({ animal, vaccinations, growthRecords, healthEvents, onClose, onRecordVax, onLogGrowth, onLogHealth, onEditAnimal }) {
  const [tab, setTab] = useState("overview");
  const vax     = vaccinations.filter(v=>v.animalId===animal.id).sort((a,b)=>a.dateGiven<b.dateGiven?1:-1);
  const growth  = growthRecords.filter(g=>g.animalId===animal.id).sort((a,b)=>a.date<b.date?-1:1);
  const health  = healthEvents.filter(h=>h.animalId===animal.id).sort((a,b)=>a.date<b.date?1:-1);
  const chartData = growth.map(g=>({label:formatDate(g.date),weight:g.weightKg}));
  const openIssues = health.filter(h=>!h.resolved).length;
  const roi = animalRoi(animal);
  const gain = animalGain(animal);

  let withGain = [], prev = null;
  [...growth].reverse().forEach(g=>{
    withGain.push({...g, gain: prev!==null ? Math.round((g.weightKg-prev)*10)/10 : null});
    prev = g.weightKg;
  });

  const TABS = [
    { key:"overview",  label:"Overview" },
    { key:"growth",    label:`Growth${growth.length?` (${growth.length})`:""}` },
    { key:"vax",       label:`Vaccines${vax.length?` (${vax.length})`:""}` },
    { key:"health",    label:`Health${openIssues?` ⚠ ${openIssues}`:(health.length?` (${health.length})`:"")}` },
  ];

  return (
    <div className="drawer-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
      <div className="drawer">
        <div className="drawer__header">
          <div>
            <EarTag size="lg">{animal.tagId}</EarTag>
            <h2>{animal.name || "Unnamed"}</h2>
            <span className="muted">{animal.species}{animal.breed?` · ${animal.breed}`:""} · {animal.sex}</span>
          </div>
          <div className="drawer__header-actions">
            <button className="btn btn--ghost btn--sm" onClick={()=>onEditAnimal(animal.id)}><Pencil size={14}/>Edit</button>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18}/></button>
          </div>
        </div>

        {/* Quick stats bar */}
        <div className="drawer__quick-stats">
          <div><span className="muted small">Age</span><strong>{calcAge(animal.dob)}</strong></div>
          <div><span className="muted small">Status</span><Badge tone={statusTone(animal.status)}>{animal.status}</Badge></div>
          <div><span className="muted small">Weight</span><strong className="mono">{animal.weightKg?`${animal.weightKg} kg`:"—"}</strong></div>
          <div><span className="muted small">Location</span><strong>{animal.location||"—"}</strong></div>
          <div><span className="muted small">Origin</span><strong>{animal.origin||"—"}</strong></div>
          <div><span className="muted small">Purchased for</span><strong className="mono">{animal.origin==="Purchased"?(animal.purchaseCost||0).toLocaleString():"0"}</strong></div>
          <div><span className="muted small">Current value</span><strong className="mono">{currency(animal.currentValue)}</strong></div>
          <div><span className="muted small">Value gain / loss</span><strong className={`mono ${gain>=0?"trend-up":"trend-down"}`}>{gain>=0?"+":"-"}{currency(Math.abs(gain))}</strong></div>
          <div><span className="muted small">Animal ROI</span><strong className={`mono ${roi===null||roi>=0?"trend-up":"trend-down"}`}>{roiLabel(roi)}</strong></div>
        </div>

        {/* Tabs */}
        <div className="drawer__tabs">
          {TABS.map(t=>(
            <button key={t.key} className={`drawer__tab${tab===t.key?" is-active":""}`} onClick={()=>setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* Overview tab */}
        {tab==="overview" && (
          <div className="drawer__tab-body">
            {animal.notes && (
              <div className="info-block"><FileText size={14}/><p>{animal.notes}</p></div>
            )}
            <div className="overview-grid">
              <div className="overview-grid__item"><span className="muted small">Date of birth</span><strong>{formatDate(animal.dob)}</strong></div>
              <div className="overview-grid__item"><span className="muted small">Sex</span><strong>{animal.sex}</strong></div>
              <div className="overview-grid__item"><span className="muted small">Vaccinations</span><strong>{vax.length} on record</strong></div>
              <div className="overview-grid__item"><span className="muted small">Open health issues</span>
                <strong>{openIssues>0?<span style={{color:"var(--rust)"}}>{openIssues} open</span>:"None"}</strong>
              </div>
              <div className="overview-grid__item"><span className="muted small">Weigh-ins</span><strong>{growth.length} recorded</strong></div>
              <div className="overview-grid__item"><span className="muted small">Latest weight</span>
                <strong className="mono">{growth.length?`${growth[growth.length-1].weightKg} kg`:"—"}</strong>
              </div>
            </div>
            <div className="drawer__quick-actions">
              <button className="btn btn--ghost btn--sm" onClick={()=>onLogHealth(animal.id)}><Activity size={14}/>Log health event</button>
              <button className="btn btn--ghost btn--sm" onClick={()=>onLogGrowth(animal.id)}><TrendingUp size={14}/>Log weight</button>
              <button className="btn btn--ghost btn--sm" onClick={()=>onRecordVax(animal.id)}><Syringe size={14}/>Record vaccination</button>
            </div>
          </div>
        )}

        {/* Growth tab */}
        {tab==="growth" && (
          <div className="drawer__tab-body">
            <div className="section-head">
              <span/>
              <button className="btn btn--tiny" onClick={()=>onLogGrowth(animal.id)}><Plus size={13}/>Log weight</button>
            </div>
            {chartData.length>=2 ? (
              <div style={{height:160,marginBottom:16}}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{top:8,right:12,left:-18,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4DCC8"/>
                    <XAxis dataKey="label" tick={{fontSize:10,fill:"#8A7B62"}}/>
                    <YAxis tick={{fontSize:10,fill:"#8A7B62"}} width={36}/>
                    <Tooltip contentStyle={{fontFamily:"Inter,sans-serif",fontSize:12,borderRadius:8,border:"1px solid #E4DCC8"}}/>
                    <Line type="monotone" dataKey="weight" stroke="#A23B2E" strokeWidth={2} dot={{r:3}}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ):(
              <p className="muted small">Log at least two weigh-ins to see a trend.</p>
            )}
            {withGain.length>0 && (
              <table className="mini-table">
                <thead><tr><th>Date</th><th>Weight</th><th>Change</th><th>BCS</th><th>Notes</th></tr></thead>
                <tbody>
                  {withGain.map(g=>(
                    <tr key={g.id}>
                      <td className="mono">{formatDate(g.date)}</td>
                      <td className="mono">{g.weightKg} kg</td>
                      <td className="mono">
                        {g.gain===null?"—":g.gain>=0
                          ?<span className="trend-up"><ArrowUp size={11}/>{g.gain} kg</span>
                          :<span className="trend-down"><ArrowDown size={11}/>{Math.abs(g.gain)} kg</span>}
                      </td>
                      <td>{g.bodyCondition||"—"}</td>
                      <td className="muted">{g.notes||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {growth.length===0 && <p className="muted small">No weigh-ins recorded yet.</p>}
          </div>
        )}

        {/* Vaccination tab */}
        {tab==="vax" && (
          <div className="drawer__tab-body">
            <div className="section-head">
              <span/>
              <button className="btn btn--tiny" onClick={()=>onRecordVax(animal.id)}><Plus size={13}/>Record</button>
            </div>
            {vax.length===0 ? <p className="muted small">No vaccinations recorded yet.</p> : (
              vax.map(v=>{
                const st=getVaxStatus(v.nextDue);
                return (
                  <div key={v.id} className="event-card">
                    <div className="event-card__top">
                      <strong>{v.vaccine}</strong>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <div className="event-card__meta">
                      <span>Administered: <span className="mono">{formatDate(v.dateGiven)}</span></span>
                      {v.nextDue&&<span>Next due: <span className="mono">{formatDate(v.nextDue)}</span></span>}
                      {v.administeredBy&&<span>By: {v.administeredBy}</span>}
                      {v.batchNo&&<span>Batch: {v.batchNo}</span>}
                    </div>
                    {v.notes&&<p className="event-card__notes">{v.notes}</p>}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Health tab */}
        {tab==="health" && (
          <div className="drawer__tab-body">
            <div className="section-head">
              <span/>
              <button className="btn btn--tiny" onClick={()=>onLogHealth(animal.id)}><Plus size={13}/>Log event</button>
            </div>
            {health.length===0 ? <p className="muted small">No health events logged yet.</p> : (
              health.map(h=>(
                <div key={h.id} className={`event-card ${h.resolved?"event-card--resolved":""}`}>
                  <div className="event-card__top">
                    <strong>{h.description}</strong>
                    <Badge tone={h.resolved?"success":"warning"}>{h.resolved?"Resolved":"Open"}</Badge>
                  </div>
                  <div className="event-card__meta">
                    <span><Badge tone="neutral">{h.type}</Badge></span>
                    <span className="mono">{formatDate(h.date)}</span>
                    {h.vetName&&<span>By: {h.vetName}</span>}
                    {h.followUpDate&&<span>Follow-up: <span className="mono">{formatDate(h.followUpDate)}</span></span>}
                  </div>
                  {h.treatment&&<p className="event-card__notes"><strong>Treatment:</strong> {h.treatment}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────
function DashboardPage({ animals, vaccinations, healthEvents, feedItems, sales, expenses, loans, invoices, onNavigate }) {
  const totalAnimals = animals.length;
  const activeAnimals = animals.filter(a=>!["Sold","Deceased"].includes(a.status)).length;
  const purchasedAnimals = animals.filter(a=>a.origin==="Purchased").length;
  const bornAnimals = animals.filter(a=>a.origin==="Born in herd").length;
  const currentHerdValue = animals.reduce((sum,a)=>sum+(Number(a.currentValue)||0),0);
  const openHealth = healthEvents.filter(h=>!h.resolved).length;
  const dueVaccinations = vaccinations.filter(v=>{ const s=getVaxStatus(v.nextDue); return s.tone==="warning"||s.tone==="danger"; }).length;
  const lowFeed = feedItems.filter(f=>getFeedStatus(f).tone!=="success").length;
  const loanPayments = (loans||[]).flatMap(loan=>(loan.payments||[]).map(payment=>({...payment,loan})));
  const loanIncome = (loans||[]).reduce((s,x)=>s+x.principalAmount,0);
  const loanExpense = loanPayments.reduce((s,x)=>s+x.amount,0);
  const totalRevenue = (sales||[]).reduce((s,x)=>s+x.amount,0) + loanIncome;
  const totalExpenses = (expenses||[]).reduce((s,x)=>s+x.amount,0) + loanExpense;
  const netProfit = totalRevenue - totalExpenses;
  const thisMonthKey = monthKey(todayStr());
  const monthRevenue = (sales||[]).filter(x=>monthKey(x.date)===thisMonthKey).reduce((s,x)=>s+x.amount,0)
    + (loans||[]).filter(x=>monthKey(x.issueDate)===thisMonthKey).reduce((s,x)=>s+x.principalAmount,0);
  const monthExpenses = (expenses||[]).filter(x=>monthKey(x.date)===thisMonthKey).reduce((s,x)=>s+x.amount,0)
    + loanPayments.filter(x=>monthKey(x.date)===thisMonthKey).reduce((s,x)=>s+x.amount,0);
  const monthNet = monthRevenue - monthExpenses;
  const outstandingDebt = (loans||[]).reduce((s,x)=>s+x.outstandingBalance,0);
  const receivableOutstanding = (invoices||[]).filter(i=>i.direction==="Receivable").reduce((sum,i)=>sum+Math.max(i.amount-i.amountPaid,0),0);
  const payableOutstanding = (invoices||[]).filter(i=>i.direction==="Payable").reduce((sum,i)=>sum+Math.max(i.amount-i.amountPaid,0),0);
  const alerts = [
    openHealth > 0 && { label:"Open health issues", value:openHealth, tone:"warning", target:"livestock" },
    dueVaccinations > 0 && { label:"Vaccinations due", value:dueVaccinations, tone:"danger", target:"vaccinations" },
    lowFeed > 0 && { label:"Feed items low", value:lowFeed, tone:"warning", target:"feed" },
    outstandingDebt > 0 && { label:"Loan balance", value:currencyShort(outstandingDebt), tone:"neutral", target:"loans" },
    payableOutstanding > 0 && { label:"Bills payable", value:currencyShort(payableOutstanding), tone:"warning", target:"contracts" },
  ].filter(Boolean);
  const nextActions = [
    openHealth > 0 && { label:"Resolve open health cases", detail:`${openHealth} animal issue${openHealth===1?"":"s"} need follow-up`, target:"livestock", tone:"warning" },
    dueVaccinations > 0 && { label:"Review vaccination schedule", detail:`${dueVaccinations} due or overdue`, target:"vaccinations", tone:"danger" },
    lowFeed > 0 && { label:"Restock feed before it runs low", detail:`${lowFeed} feed item${lowFeed===1?"":"s"} below comfort level`, target:"feed", tone:"warning" },
    payableOutstanding > 0 && { label:"Plan supplier payments", detail:`${currencyShort(payableOutstanding)} in unpaid bills`, target:"contracts", tone:"warning" },
    receivableOutstanding > 0 && { label:"Follow up customer invoices", detail:`${currencyShort(receivableOutstanding)} still to collect`, target:"contracts", tone:"success" },
    sales.length === 0 && { label:"Record the first sale", detail:"Start tracking revenue and profit", target:"sales", tone:"neutral" },
    expenses.length === 0 && { label:"Record farm expenses", detail:"Capture costs for a clearer profit picture", target:"expenses", tone:"neutral" },
    loans.length === 0 && { label:"Add active farm loans", detail:"Track repayments and outstanding balances", target:"loans", tone:"neutral" },
  ].filter(Boolean).slice(0,4);

  if (totalAnimals===0 && feedItems.length===0) return (
    <EmptyState icon={Sprout} title="The ledger is empty"
      body="Start by adding livestock records from your farm. The overview will stay focused as the modules fill in."
      actionLabel="Add livestock" onAction={()=>onNavigate("animals")}/>
  );

  return (
    <div className="page">
      <div className="stat-row">
        <StatCard icon={PawPrint} label="Animals" value={totalAnimals} sub={`${activeAnimals} active`} tone="green"/>
        <StatCard icon={Activity} label="Health attention" value={openHealth} sub="unresolved events" tone={openHealth>0?"gold":"ink"}/>
        <StatCard icon={BadgeDollarSign} label="Net position" value={currencyShort(Math.abs(netProfit))} sub={netProfit>=0?"profit recorded":"loss recorded"} tone={netProfit>=0?"green":"rust"}/>
        <StatCard icon={Wallet} label="Loan balance" value={currencyShort(outstandingDebt)} sub="outstanding debt" tone={outstandingDebt>0?"gold":"ink"}/>
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel__head">
            <h3><PawPrint size={16}/>Livestock snapshot</h3>
            <button className="link-btn" onClick={()=>onNavigate("livestock")}>Open <ChevronRight size={13}/></button>
          </div>
          <ul className="list-rows">
            <li><span>Total animals</span><strong className="mono">{totalAnimals}</strong></li>
            <li><span>Herd value</span><strong className="mono">{currency(currentHerdValue)}</strong></li>
            <li><span>Origin split</span><strong className="mono">{purchasedAnimals} purchased / {bornAnimals} born</strong></li>
            <li><span>Vaccinations due</span><Badge tone={dueVaccinations>0?"danger":"success"}>{dueVaccinations}</Badge></li>
            <li><span>Feed items low</span><Badge tone={lowFeed>0?"warning":"success"}>{lowFeed}</Badge></li>
          </ul>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3><BadgeDollarSign size={16}/>Finance snapshot</h3>
            <button className="link-btn" onClick={()=>onNavigate("finances")}>Open <ChevronRight size={13}/></button>
          </div>
          <ul className="list-rows">
            <li><span>Revenue</span><strong className="mono trend-up">{currency(totalRevenue)}</strong></li>
            <li><span>Expenses</span><strong className="mono trend-down">{currency(totalExpenses)}</strong></li>
            <li><span>Net profit / loss</span><strong className={`mono ${netProfit>=0?"trend-up":"trend-down"}`}>{netProfit>=0?"+":"-"}{currency(Math.abs(netProfit))}</strong></li>
            <li><span>This month</span><strong className={`mono ${monthNet>=0?"trend-up":"trend-down"}`}>{monthNet>=0?"+":"-"}{currency(Math.abs(monthNet))}</strong></li>
            <li><span>To collect / pay</span><strong className="mono">{currencyShort(receivableOutstanding)} / {currencyShort(payableOutstanding)}</strong></li>
          </ul>
        </div>

        <div className="panel panel--wide">
          <div className="panel__head">
            <h3><Activity size={16}/>Attention needed</h3>
            <button className="link-btn" onClick={()=>onNavigate("statement")}>Statement <ChevronRight size={13}/></button>
          </div>
          {alerts.length===0 ? <p className="muted small">Nothing urgent right now.</p> : (
            <ul className="list-rows">
              {alerts.map(alert=>(
                <li key={alert.label}>
                  <button className="link-btn" onClick={()=>onNavigate(alert.target)}>{alert.label} <ChevronRight size={13}/></button>
                  <Badge tone={alert.tone}>{alert.value}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel panel--wide">
          <div className="panel__head">
            <h3><CheckCircle2 size={16}/>Recommended next steps</h3>
            <button className="link-btn" onClick={()=>onNavigate("livestock")}>Livestock overview <ChevronRight size={13}/></button>
          </div>
          {nextActions.length===0 ? (
            <div className="success-callout">
              <CheckCircle2 size={17}/>
              <div>
                <strong>Farm records look steady.</strong>
                <p>Keep recording sales, expenses, feed movements, health events, and repayments as they happen.</p>
              </div>
            </div>
          ) : (
            <div className="action-grid">
              {nextActions.map(action=>(
                <button key={action.label} className="action-card" onClick={()=>onNavigate(action.target)}>
                  <span><Badge tone={action.tone}>{action.label}</Badge></span>
                  <strong>{action.detail}</strong>
                  <ChevronRight size={15}/>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LivestockOverviewPage({ animals, vaccinations, growthRecords, healthEvents, feedItems, onNavigate }) {
  const total     = animals.length;
  const healthy   = animals.filter(a=>a.status==="Healthy").length;
  const sick      = animals.filter(a=>a.status==="Sick").length;
  const pregnant  = animals.filter(a=>a.status==="Pregnant").length;
  const dueSoon   = vaccinations.filter(v=>{ const s=getVaxStatus(v.nextDue); return s.tone==="warning"||s.tone==="danger"; }).length;
  const lowFeedCt = feedItems.filter(f=>getFeedStatus(f).tone!=="success").length;
  const openHealth= healthEvents.filter(h=>!h.resolved).length;

  const totalPurchaseValue = animals.reduce((sum,a)=>sum+(Number(a.purchaseCost)||0),0);
  const totalCurrentValue  = animals.reduce((sum,a)=>sum+(Number(a.currentValue)||0),0);
  const herdValueGain      = totalCurrentValue - totalPurchaseValue;
  const herdRoi            = totalPurchaseValue>0 ? (herdValueGain/totalPurchaseValue)*100 : (totalCurrentValue>0 ? Infinity : null);

  const speciesData = useMemo(()=>{
    const c={};
    animals.forEach(a=>{ c[a.species]=(c[a.species]||0)+1; });
    return Object.entries(c).map(([name,value])=>({name,value}));
  },[animals]);

  const statusData = useMemo(()=>{
    const c={};
    animals.forEach(a=>{ c[a.status]=(c[a.status]||0)+1; });
    return Object.entries(c).map(([name,value])=>({name,value}));
  },[animals]);

  const growthTrend = useMemo(()=>{
    const by={};
    growthRecords.forEach(g=>{ if(!by[g.date])by[g.date]=[]; by[g.date].push(g.weightKg); });
    return Object.entries(by)
      .map(([date,ws])=>({date, label:formatDate(date), avg:Math.round(ws.reduce((a,b)=>a+b,0)/ws.length*10)/10}))
      .sort((a,b)=>a.date<b.date?-1:1).slice(-10);
  },[growthRecords]);

  const upcomingVax = vaccinations
    .filter(v=>v.nextDue).map(v=>({...v,st:getVaxStatus(v.nextDue)}))
    .filter(v=>v.st.tone==="warning"||v.st.tone==="danger")
    .sort((a,b)=>a.nextDue<b.nextDue?-1:1).slice(0,5);

  const lowFeed     = feedItems.filter(f=>getFeedStatus(f).tone!=="success").slice(0,5);
  const openIssues  = healthEvents.filter(h=>!h.resolved)
    .sort((a,b)=>a.date<b.date?1:-1).slice(0,5);
  const animalById  = id => animals.find(a=>a.id===id);

  const isEmpty = total===0 && feedItems.length===0;

  if (isEmpty) return (
    <EmptyState icon={Sprout} title="The ledger is empty"
      body="Start by adding livestock records from your farm. The overview will fill in as backend data is saved."
      actionLabel="Add livestock" onAction={()=>onNavigate("animals")}/>
  );

  return (
    <div className="page">
      {/* Row 1 – herd health */}
      <div className="stat-row">
        <StatCard icon={PawPrint}       label="Total animals"     value={total}    sub={`${healthy} healthy`}       tone="green"/>
        <StatCard icon={Heart}          label="Sick / at risk"    value={sick}     sub={`${pregnant} pregnant`}     tone="rust"/>
        <StatCard icon={Activity}       label="Open health issues"value={openHealth} sub="unresolved events"         tone="gold"/>
        <StatCard icon={Syringe}        label="Vaccinations due"  value={dueSoon}  sub="within 14 days or overdue"  tone="rust"/>
      </div>
      <div className="stat-row">
        <StatCard icon={TrendingUp}     label="Growth records"    value={growthRecords.length} sub="weigh-ins logged" tone="ink"/>
        <StatCard icon={Wheat}          label="Feed items low"    value={lowFeedCt} sub="at or below reorder level" tone="gold"/>
        <StatCard icon={PawPrint}       label="Quarantine"        value={animals.filter(a=>a.status==="Quarantine").length} sub="isolated animals" tone="ink"/>
        <StatCard icon={CheckCircle2}   label="Sold / deceased"   value={animals.filter(a=>["Sold","Deceased"].includes(a.status)).length} sub="off active register" tone="ink"/>
      </div>
      <div className="stat-row">
        <StatCard icon={Receipt}         label="Purchase basis"    value={currencyShort(totalPurchaseValue)} sub="recorded acquisition cost" tone="ink"/>
        <StatCard icon={BadgeDollarSign} label="Current herd value"value={currencyShort(totalCurrentValue)} sub="estimated sale value" tone="green"/>
        <StatCard icon={herdValueGain>=0?TrendingUp:TrendingDown} label="Unrealized value" value={currencyShort(Math.abs(herdValueGain))} sub={herdValueGain>=0?"appreciation":"depreciation"} tone={herdValueGain>=0?"green":"rust"}/>
        <StatCard icon={Wallet}          label="Herd ROI"          value={roiLabel(herdRoi)} sub="current value vs purchase" tone={herdRoi===null||herdRoi>=0?"gold":"rust"}/>
      </div>


      <div className="dash-grid">
        {/* Species breakdown */}
        <div className="panel">
          <div className="panel__head"><h3>Species breakdown</h3></div>
          {speciesData.length===0 ? <p className="muted small">Add animals to see the breakdown.</p> : (
            <div className="composition">
              <div style={{width:140,height:140,flexShrink:0}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={speciesData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
                      {speciesData.map((e,i)=><Cell key={e.name} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="legend-list">
                {speciesData.map((s,i)=>(
                  <li key={s.name}><span className="legend-dot" style={{background:PIE_COLORS[i%PIE_COLORS.length]}}/>{s.name} <span className="muted mono">{s.value}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="panel">
          <div className="panel__head"><h3>Herd status</h3></div>
          {statusData.length===0 ? <p className="muted small">No animals yet.</p> : (
            <div className="composition">
              <div style={{width:140,height:140,flexShrink:0}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
                      {statusData.map((e,i)=><Cell key={e.name} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="legend-list">
                {statusData.map((s,i)=>(
                  <li key={s.name}><span className="legend-dot" style={{background:PIE_COLORS[i%PIE_COLORS.length]}}/>{s.name} <span className="muted mono">{s.value}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Average weight trend */}
        <div className="panel">
          <div className="panel__head"><h3>Average weight trend</h3></div>
          {growthTrend.length<2 ? <p className="muted small">Log weigh-ins on two or more dates to see a trend.</p> : (
            <div style={{height:170}}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthTrend} margin={{top:8,right:16,left:-18,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4DCC8"/>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:"#8A7B62"}}/>
                  <YAxis tick={{fontSize:10,fill:"#8A7B62"}} width={36}/>
                  <Tooltip contentStyle={{fontFamily:"Inter,sans-serif",fontSize:12,borderRadius:8,border:"1px solid #E4DCC8"}}/>
                  <Line type="monotone" dataKey="avg" stroke="#3F5D45" strokeWidth={2} dot={{r:3}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Open health issues */}
        <div className="panel">
          <div className="panel__head">
            <h3>Open health issues</h3>
            <button className="link-btn" onClick={()=>onNavigate("animals")}>View animals <ChevronRight size={13}/></button>
          </div>
          {openIssues.length===0 ? <p className="muted small">No unresolved health events.</p> : (
            <ul className="list-rows">
              {openIssues.map(h=>{
                const a=animalById(h.animalId);
                return (
                  <li key={h.id}>
                    <div><strong>{h.description}</strong><span className="muted"> — {a?`${a.tagId}${a.name?" · "+a.name:""}`:""}</span></div>
                    <Badge tone="warning">{h.type}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Upcoming vaccinations */}
        <div className="panel">
          <div className="panel__head">
            <h3>Upcoming / overdue vaccinations</h3>
            <button className="link-btn" onClick={()=>onNavigate("vaccinations")}>View all <ChevronRight size={13}/></button>
          </div>
          {upcomingVax.length===0 ? <p className="muted small">Nothing due in the next two weeks.</p> : (
            <ul className="list-rows">
              {upcomingVax.map(v=>{
                const a=animalById(v.animalId);
                return (
                  <li key={v.id}>
                    <div><strong>{v.vaccine}</strong><span className="muted"> — {a?`${a.tagId}${a.name?" · "+a.name:""}`:""}</span></div>
                    <Badge tone={v.st.tone}>{v.st.label==="Overdue"?"Overdue":formatDate(v.nextDue)}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Feed running low */}
        <div className="panel">
          <div className="panel__head">
            <h3>Feed running low</h3>
            <button className="link-btn" onClick={()=>onNavigate("feed")}>View all <ChevronRight size={13}/></button>
          </div>
          {lowFeed.length===0 ? <p className="muted small">All feed stocks are above reorder level.</p> : (
            <ul className="list-rows">
              {lowFeed.map(f=>{
                const st=getFeedStatus(f);
                return (
                  <li key={f.id}>
                    <div><strong>{f.feedType}</strong><span className="muted mono"> — {f.quantityKg} kg left</span></div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function AnimalsPage({ animals, healthEvents, onAdd, onDelete, onOpen }) {
  const [query, setQuery]     = useState("");
  const [speciesF, setSpeciesF] = useState("All");
  const [statusF, setStatusF]   = useState("All");
  const [confirmId, setConfirmId] = useState(null);

  const openHealth = id => healthEvents.filter(h=>h.animalId===id&&!h.resolved).length;

  const filtered = animals.filter(a=>{
    const q = query.toLowerCase();
    const matchQ = !q || a.tagId.toLowerCase().includes(q)||(a.name||"").toLowerCase().includes(q)||a.species.toLowerCase().includes(q)||(a.breed||"").toLowerCase().includes(q);
    return matchQ && (speciesF==="All"||a.species===speciesF) && (statusF==="All"||a.status===statusF);
  });

  return (
    <div className="page">
      <div className="toolbar">
        <div className="search-box"><Search size={15}/><input placeholder="Tag, name, species, breed…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <select value={speciesF} onChange={e=>setSpeciesF(e.target.value)}>
          <option>All</option>
          {SPECIES.map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={statusF} onChange={e=>setStatusF(e.target.value)}>
          <option>All</option>
          {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
        </select>
        <button className="btn btn--primary" onClick={onAdd}><Plus size={15}/>Add animal</button>
      </div>

      {animals.length===0 ? (
        <EmptyState icon={PawPrint} title="No animals yet" body="Add your first animal to start the register." actionLabel="Add animal" onAction={onAdd}/>
      ) : filtered.length===0 ? <p className="muted">No animals match that search.</p> : (
        <div className="table-wrap responsive-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Animal</th><th>Type</th><th>Status</th><th>Weight</th>
                <th>Value</th><th>Issues</th><th/>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a=>(
                <tr key={a.id} className="clickable" onClick={()=>onOpen(a.id)}>
                  <td data-label="Animal">
                    <div className="table-primary">
                      <EarTag>{a.tagId}</EarTag>
                      <strong>{a.name||"Unnamed"}</strong>
                    </div>
                    <div className="muted small">{a.location||"No location"} - {calcAge(a.dob)} old - {a.sex}</div>
                  </td>
                  <td data-label="Type">
                    <strong>{a.species}</strong>
                    <div className="muted small">{a.breed||"No breed"} - {a.origin||"Origin not set"}</div>
                  </td>
                  <td data-label="Status"><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
                  <td data-label="Weight" className="mono">{a.weightKg?`${a.weightKg} kg`:"-"}</td>
                  <td data-label="Value">
                    <strong className="mono">{a.currentValue?currencyShort(a.currentValue):"-"}</strong>
                    <div className={`small mono ${animalRoi(a)===null||animalRoi(a)>=0?"trend-up":"trend-down"}`}>{roiLabel(animalRoi(a))}</div>
                  </td>
                  <td data-label="Issues">{openHealth(a.id)>0?<Badge tone="danger">{openHealth(a.id)}</Badge>:"-"}</td>
                  <td data-label="" className="actions-cell">
                    <button className="icon-btn icon-btn--danger" onClick={e=>{e.stopPropagation();setConfirmId(a.id);}} aria-label="Delete"><Trash2 size={15}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirmId&&<ConfirmDialog title="Remove animal" body="This removes the animal record. Vaccination, growth and health history linked to it remains but will show as orphaned." onCancel={()=>setConfirmId(null)} onConfirm={()=>{onDelete(confirmId);setConfirmId(null);}}/>}
    </div>
  );
}

function VaccinationsPage({ animals, vaccinations, onAdd, onDelete }) {
  const [query, setQuery]     = useState("");
  const [statusF, setStatusF] = useState("All");
  const [confirmId, setConfirmId] = useState(null);
  const animalById = id => animals.find(a=>a.id===id);

  const rows = vaccinations
    .map(v=>({...v,st:getVaxStatus(v.nextDue),animal:animalById(v.animalId)}))
    .filter(v=>{
      const label=`${v.animal?.tagId||""} ${v.animal?.name||""} ${v.vaccine}`.toLowerCase();
      return (!query||label.includes(query.toLowerCase())) && (statusF==="All"||v.st.label===statusF);
    })
    .sort((a,b)=>a.dateGiven<b.dateGiven?1:-1);

  return (
    <div className="page">
      <div className="toolbar">
        <div className="search-box"><Search size={15}/><input placeholder="Animal or vaccine…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <select value={statusF} onChange={e=>setStatusF(e.target.value)}>
          <option>All</option>
          {["Overdue","Due soon","Up to date","No follow-up"].map(s=><option key={s}>{s}</option>)}
        </select>
        <button className="btn btn--primary" onClick={onAdd}><Plus size={15}/>Record vaccination</button>
      </div>
      {vaccinations.length===0 ? (
        <EmptyState icon={Syringe} title="No vaccinations recorded" body="Record the first vaccination to start tracking herd health." actionLabel="Record vaccination" onAction={onAdd}/>
      ) : rows.length===0 ? <p className="muted">No records match that search.</p> : (
        <div className="table-wrap responsive-table-wrap">
          <table>
            <thead><tr><th>Animal</th><th>Vaccine</th><th>Administered</th><th>Next due</th><th>Status</th><th>By</th><th>Batch</th><th>Notes</th><th/></tr></thead>
            <tbody>
              {rows.map(v=>(
                <tr key={v.id}>
                  <td data-label="Animal">{v.animal?<><EarTag>{v.animal.tagId}</EarTag> {v.animal.name}</>:<span className="muted">Removed</span>}</td>
                  <td data-label="Vaccine">{v.vaccine}</td>
                  <td data-label="Administered" className="mono">{formatDate(v.dateGiven)}</td>
                  <td data-label="Next due" className="mono">{formatDate(v.nextDue)}</td>
                  <td data-label="Status"><Badge tone={v.st.tone}>{v.st.label}</Badge></td>
                  <td data-label="By">{v.administeredBy||"-"}</td>
                  <td data-label="Batch" className="mono">{v.batchNo||"-"}</td>
                  <td data-label="Notes" className="muted">{v.notes||"-"}</td>
                  <td data-label="" className="actions-cell"><button className="icon-btn icon-btn--danger" onClick={()=>setConfirmId(v.id)} aria-label="Delete"><Trash2 size={15}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirmId&&<ConfirmDialog title="Delete vaccination record" body="This permanently removes the vaccination record." onCancel={()=>setConfirmId(null)} onConfirm={()=>{onDelete(confirmId);setConfirmId(null);}}/>}
    </div>
  );
}

function GrowthPage({ animals, growthRecords, onAdd, onDelete }) {
  const [selectedId, setSelectedId] = useState(animals[0]?.id!=null ? String(animals[0].id) : "");
  const [confirmId, setConfirmId]   = useState(null);
  const animal = animals.find(a=>String(a.id)===selectedId) || animals[0] || null;
  const selectedAnimalId = animal?.id ?? "";

  const records = growthRecords.filter(g=>String(g.animalId)===String(selectedAnimalId)).sort((a,b)=>a.date<b.date?-1:1);
  const chartData = records.map(g=>({label:formatDate(g.date),weight:g.weightKg}));

  let withGain=[]; let prev=null;
  [...records].reverse().forEach(g=>{ withGain.push({...g,gain:prev!==null?Math.round((g.weightKg-prev)*10)/10:null}); prev=g.weightKg; });

  return (
    <div className="page">
      <div className="toolbar">
        <select value={selectedAnimalId==="" ? "" : String(selectedAnimalId)} onChange={e=>setSelectedId(e.target.value)} disabled={!animals.length}>
          {!animals.length&&<option>No animals yet</option>}
          {animals.map(a=><option key={a.id} value={String(a.id)}>{a.tagId}{a.name?` — ${a.name}`:""}</option>)}
        </select>
        <button className="btn btn--primary" onClick={onAdd}><Plus size={15}/>Log weight</button>
      </div>
      {!animals.length ? <EmptyState icon={TrendingUp} title="No animals to track" body="Add an animal first, then log its weight over time."/> : (
        <div className="panel">
          <div className="panel__head"><h3>{animal?`${animal.tagId}${animal.name?" · "+animal.name:""} — weight over time`:"Select an animal"}</h3></div>
          {chartData.length<2 ? <p className="muted small">Log at least two weigh-ins to see a chart.</p> : (
            <div style={{height:220}}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{top:8,right:16,left:-18,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4DCC8"/>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:"#8A7B62"}}/>
                  <YAxis tick={{fontSize:10,fill:"#8A7B62"}} width={36}/>
                  <Tooltip contentStyle={{fontFamily:"Inter,sans-serif",fontSize:12,borderRadius:8,border:"1px solid #E4DCC8"}}/>
                  <Line type="monotone" dataKey="weight" stroke="#A23B2E" strokeWidth={2} dot={{r:3}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {withGain.length>0 && (
            <div className="table-wrap" style={{marginTop:16}}>
              <table>
                <thead><tr><th>Date</th><th>Weight</th><th>Change</th><th>BCS</th><th>Notes</th><th/></tr></thead>
                <tbody>
                  {withGain.map(g=>(
                    <tr key={g.id}>
                      <td className="mono">{formatDate(g.date)}</td>
                      <td className="mono">{g.weightKg} kg</td>
                      <td className="mono">{g.gain===null?"—":g.gain>=0?<span className="trend-up"><ArrowUp size={12}/>{g.gain} kg</span>:<span className="trend-down"><ArrowDown size={12}/>{Math.abs(g.gain)} kg</span>}</td>
                      <td>{g.bodyCondition||"—"}</td>
                      <td className="muted">{g.notes||"—"}</td>
                      <td className="actions-cell"><button className="icon-btn icon-btn--danger" onClick={()=>setConfirmId(g.id)} aria-label="Delete"><Trash2 size={15}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {confirmId&&<ConfirmDialog title="Delete growth record" body="This removes the weigh-in permanently." onCancel={()=>setConfirmId(null)} onConfirm={()=>{onDelete(confirmId);setConfirmId(null);}}/>}
    </div>
  );
}

function FeedPage({ feedItems, onAdd, onAdjust, onDelete }) {
  const [adjustState, setAdjustState] = useState(null);
  const [confirmId, setConfirmId]     = useState(null);
  return (
    <div className="page">
      <div className="toolbar"><div className="spacer"/><button className="btn btn--primary" onClick={onAdd}><Plus size={15}/>Add feed item</button></div>
      {feedItems.length===0 ? (
        <EmptyState icon={Wheat} title="No feed stock recorded" body="Add a feed type to start tracking inventory and reorder levels." actionLabel="Add feed item" onAction={onAdd}/>
      ) : (
        <div className="table-wrap responsive-table-wrap">
          <table>
            <thead><tr><th>Feed type</th><th>In stock</th><th>Reorder level</th><th>Status</th><th>Cost / kg</th><th>Supplier</th><th>Last restocked</th><th/></tr></thead>
            <tbody>
              {feedItems.map(f=>{
                const st=getFeedStatus(f);
                return (
                  <tr key={f.id}>
                    <td data-label="Feed type"><Package size={14} style={{marginRight:6,verticalAlign:-2,color:"#8A7B62"}}/>{f.feedType}</td>
                    <td data-label="In stock" className="mono">{f.quantityKg} kg</td>
                    <td data-label="Reorder level" className="mono">{f.reorderLevel} kg</td>
                    <td data-label="Status"><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td data-label="Cost / kg" className="mono">{f.costPerKg?f.costPerKg.toFixed(2):"-"}</td>
                    <td data-label="Supplier">{f.supplier||"-"}</td>
                    <td data-label="Last restocked" className="mono">{formatDate(f.lastRestocked)}</td>
                    <td data-label="" className="actions-cell">
                      <button className="btn btn--tiny" onClick={()=>setAdjustState({item:f,mode:"add"})}><ArrowUp size={12}/>Restock</button>
                      <button className="btn btn--tiny" onClick={()=>setAdjustState({item:f,mode:"remove"})}><ArrowDown size={12}/>Use</button>
                      <button className="icon-btn icon-btn--danger" onClick={()=>setConfirmId(f.id)} aria-label="Delete"><Trash2 size={15}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {adjustState&&<Modal title={adjustState.mode==="add"?"Restock feed":"Log feed usage"} onClose={()=>setAdjustState(null)}><AdjustStockForm item={adjustState.item} mode={adjustState.mode} onClose={()=>setAdjustState(null)} onSubmit={delta=>{onAdjust(adjustState.item.id,delta);setAdjustState(null);}}/></Modal>}
      {confirmId&&<ConfirmDialog title="Remove feed item" body="This removes the feed type and its stock record." onCancel={()=>setConfirmId(null)} onConfirm={()=>{onDelete(confirmId);setConfirmId(null);}}/>}
    </div>
  );
}

function UsersPage({ users, currentUser, onAdd, onEdit, onToggleStatus, onDelete }) {
  const [confirmId, setConfirmId] = useState(null);
  return (
    <div className="page">
      <div className="toolbar"><div className="spacer"/><button className="btn btn--primary" onClick={onAdd}><UserPlus size={15}/>Add user</button></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Email</th><th>Gender</th><th>Phone</th><th>Role</th><th>Status</th><th>Added</th><th/></tr></thead>
          <tbody>
            {users.map(u=>{
              const isSelf=u.id===currentUser.id;
              return (
                <tr key={u.id}>
                  <td><div className="user-cell"><span className="avatar">{initials(u.name)}</span>{u.name}{isSelf&&<span className="muted small"> (you)</span>}</div></td>
                  <td className="mono">{u.email}</td>
                  <td>{u.gender || <span className="muted">Not specified</span>}</td>
                  <td className="mono">{u.phoneNumber || "—"}</td>
                  <td><Badge tone={u.role==="Admin"?"success":"neutral"}>{u.role}</Badge></td>
                  <td><Badge tone={u.status==="Active"?"success":"danger"}>{u.status}</Badge></td>
                  <td className="mono">{formatDate(u.createdAtDate)}</td>
                  <td className="actions-cell">
                    <button className="btn btn--tiny" onClick={()=>onEdit(u.id)}><Pencil size={12}/>Edit</button>
                    <button className="btn btn--tiny" disabled={isSelf} onClick={()=>onToggleStatus(u.id)}>
                      {u.status==="Active"?<><Ban size={12}/>Disable</>:<><CheckCircle2 size={12}/>Enable</>}
                    </button>
                    <button className="icon-btn icon-btn--danger" disabled={isSelf} onClick={()=>setConfirmId(u.id)} aria-label="Delete user"><Trash2 size={15}/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {confirmId&&<ConfirmDialog title="Delete user" body="This permanently removes their access." onCancel={()=>setConfirmId(null)} onConfirm={()=>{onDelete(confirmId);setConfirmId(null);}}/>}
    </div>
  );
}

function ProfilePage({ currentUser, farm, onSaveFarm }) {
  const canEdit = currentUser.role === "Admin";
  const farmFormKey = `${farm?.name || ""}|${farm?.location || ""}|${farm?.subscriptionPlan || "free"}|${farm?.subscriptionBillingCycle || "monthly"}`;
  const [formState, setForm] = useState({
    name: farm?.name || "",
    location: farm?.location || "",
    subscriptionPlan: farm?.subscriptionPlan || "free",
    subscriptionBillingCycle: farm?.subscriptionBillingCycle || "monthly",
    farmFormKey,
  });
  const form = formState.farmFormKey === farmFormKey ? formState : {
    name: farm?.name || "",
    location: farm?.location || "",
    subscriptionPlan: farm?.subscriptionPlan || "free",
    subscriptionBillingCycle: farm?.subscriptionBillingCycle || "monthly",
    farmFormKey,
  };
  const currentPlan = subscriptionPlanMeta(farm?.subscriptionPlan || form.subscriptionPlan);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true); setMessage(""); setError("");
    try {
      await onSaveFarm({
        name: form.name,
        location: form.location,
        subscriptionPlan: form.subscriptionPlan,
        subscriptionBillingCycle: form.subscriptionBillingCycle,
      });
      setMessage("Farm details updated.");
    } catch (err) {
      setError(err.message || "Could not update farm details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page profile-page">
      <div className="profile-grid">
        <div className="panel">
          <div className="panel__head"><h3><Settings size={16}/>Farm details</h3></div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{gridTemplateColumns:"1fr"}}>
              <label>Farm name<input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} disabled={!canEdit} required/></label>
              <label>Location<input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} disabled={!canEdit} placeholder="Town, county, or region"/></label>
              <label>Subscription plan
                <select value={form.subscriptionPlan} onChange={e=>setForm(f=>({...f,subscriptionPlan:e.target.value}))} disabled={!canEdit}>
                  {SUBSCRIPTION_PLANS.map(plan=><option key={plan.value} value={plan.value}>{plan.label} - {plan.limit}</option>)}
                </select>
              </label>
              <label>Billing cycle
                <select value={form.subscriptionBillingCycle} onChange={e=>setForm(f=>({...f,subscriptionBillingCycle:e.target.value}))} disabled={!canEdit}>
                  {SUBSCRIPTION_BILLING_CYCLES.map(cycle=><option key={cycle.value} value={cycle.value}>{cycle.label}</option>)}
                </select>
              </label>
            </div>
            {error && <p className="form-error">{error}</p>}
            {message && <p className="form-success">{message}</p>}
            <div className="profile-actions">
              <button type="submit" className="btn btn--primary" disabled={!canEdit || saving}><Pencil size={15}/>{saving ? "Saving..." : "Save farm details"}</button>
            </div>
          </form>
          {!canEdit && <p className="muted small profile-note">Only farm admins can edit farm details.</p>}
        </div>
        <div className="panel">
          <div className="panel__head"><h3><Users size={16}/>Your access</h3></div>
          <div className="profile-summary">
            <div><span className="muted small">Name</span><strong>{currentUser.name}</strong></div>
            <div><span className="muted small">Email</span><strong className="mono">{currentUser.email}</strong></div>
            <div><span className="muted small">Gender</span><strong>{currentUser.gender || "Not specified"}</strong></div>
            <div><span className="muted small">Phone</span><strong className="mono">{currentUser.phoneNumber || "Not provided"}</strong></div>
            <div><span className="muted small">Role</span><strong>{currentUser.role}</strong></div>
            <div><span className="muted small">Farm</span><strong>{farm?.name || currentUser.farm?.name || "Farm workspace"}</strong></div>
            <div><span className="muted small">Subscription</span><strong>{currentPlan.label} - {subscriptionCycleLabel(farm?.subscriptionBillingCycle)}</strong></div>
            <div><span className="muted small">Plan limit</span><strong>{currentPlan.limit}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginPage({ onLogin, onRegister }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [farmName, setFarmName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [subscriptionPlan, setSubscriptionPlan] = useState("free");
  const [subscriptionBillingCycle, setSubscriptionBillingCycle] = useState("monthly");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRegistering = mode === "register";

  async function handleSubmit(e) {
    e.preventDefault(); setError("");
    setSubmitting(true);
    try {
      if (isRegistering) {
        await onRegister({
          farmName,
          farmLocation,
          subscriptionPlan,
          subscriptionBillingCycle,
          firstName,
          lastName,
          gender,
          phoneNumber,
          email,
          password,
        });
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      setError(err.message || "Request failed. Please check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
  }

  return (
    <div className="login-screen">
      <div className="login-card login-card--wide">
        <div className="login-brand">
          <span className="sidebar__brand-mark"><Sprout size={20}/></span>
          <div><div className="sidebar__brand-name" style={{color:"var(--ink)"}}>Farm Ledger</div><div className="muted small">{isRegistering ? "Create your farm workspace" : "Sign in to the farm dashboard"}</div></div>
        </div>
        <div className="auth-switch" role="tablist" aria-label="Authentication mode">
          <button type="button" className={mode==="login"?"active":""} onClick={()=>switchMode("login")}>Sign in</button>
          <button type="button" className={mode==="register"?"active":""} onClick={()=>switchMode("register")}>Create farm</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={`form-grid auth-form-grid${isRegistering ? " auth-form-grid--register" : ""}`}>
            {isRegistering && <>
              <label>Farm name *<input value={farmName} onChange={e=>setFarmName(e.target.value)} placeholder="e.g. Green Valley Farm" required/></label>
              <label>Farm location<input value={farmLocation} onChange={e=>setFarmLocation(e.target.value)} placeholder="e.g. Nakuru"/></label>
              <label>Subscription plan
                <select value={subscriptionPlan} onChange={e=>setSubscriptionPlan(e.target.value)}>
                  {SUBSCRIPTION_PLANS.map(plan=><option key={plan.value} value={plan.value}>{plan.label} - {plan.price}</option>)}
                </select>
              </label>
              <label>Billing cycle
                <select value={subscriptionBillingCycle} onChange={e=>setSubscriptionBillingCycle(e.target.value)}>
                  {SUBSCRIPTION_BILLING_CYCLES.map(cycle=><option key={cycle.value} value={cycle.value}>{cycle.label}</option>)}
                </select>
              </label>
              <label>First name *<input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="e.g. Asha" required/></label>
              <label>Last name<input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="e.g. Mwangi"/></label>
              <label>Gender<select value={gender} onChange={e=>setGender(e.target.value)}>{GENDER_OPTIONS.map(g=><option key={g} value={g}>{g || "Not specified"}</option>)}</select></label>
              <label>Phone number<input value={phoneNumber} onChange={e=>setPhoneNumber(e.target.value)} placeholder="e.g. +254 700 000 000"/></label>
            </>}
            <label className={isRegistering?"span-2":""}>Email<input type="email" autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@farm.local" required/></label>
            <label className={isRegistering?"span-2":""}>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} required/></label>
          </div>
          {error&&<p className="form-error">{error}</p>}
          <button type="submit" className="btn btn--primary" style={{width:"100%",justifyContent:"center",marginTop:14}} disabled={submitting}>
            <Lock size={15}/>{submitting ? (isRegistering ? "Creating farm..." : "Signing in...") : (isRegistering ? "Create farm workspace" : "Sign in")}
          </button>
        </form>
        <p className="muted small login-hint">Each account belongs to one farm. Farm admins add managers and workers from User Management.</p>
      </div>
    </div>
  );
}

function SaleForm({ animals, onSubmit, onClose }) {
  const [form, setForm] = useState({
    type: SALE_TYPES[0], animalId:"", description:"",
    date: todayStr(), quantity:"", unitPrice:"", amount:"", buyer:"", notes:"",
  });
  const set = k => e => {
    const val = e.target.value;
    setForm(f => {
      const next = {...f, [k]: val};
      if ((k==="quantity"||k==="unitPrice")) {
        const q = parseFloat(k==="quantity"?val:f.quantity);
        const p = parseFloat(k==="unitPrice"?val:f.unitPrice);
        if (q>0 && p>0) next.amount = String(Math.round(q*p*100)/100);
      }
      return next;
    });
  };
  function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim()||!form.amount) return;
    const a = animals.find(x=>x.id===form.animalId);
    onSubmit({
      type: form.type,
      animalId: form.animalId||null,
      animalLabel: a ? `${a.tagId}${a.name?" — "+a.name:""}` : "",
      description: form.description,
      date: form.date,
      quantity: form.quantity ? parseFloat(form.quantity) : null,
      unitPrice: form.unitPrice ? parseFloat(form.unitPrice) : null,
      amount: parseFloat(form.amount),
      buyer: form.buyer,
      notes: form.notes,
    });
  }
  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>Sale type<select value={form.type} onChange={set("type")}>{SALE_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
        <label>Link to animal (optional)
          <select value={form.animalId} onChange={set("animalId")}>
            <option value="">— none —</option>
            {animals.map(a=><option key={a.id} value={a.id}>{a.tagId}{a.name?" — "+a.name:""}</option>)}
          </select>
        </label>
        <label className="span-2">Description *<input value={form.description} onChange={set("description")} placeholder="e.g. Sold 2 bulls to Kamau Farm" required/></label>
        <label>Date<input type="date" value={form.date} onChange={set("date")} max={todayStr()}/></label>
        <label>Buyer<input value={form.buyer} onChange={set("buyer")} placeholder="e.g. Kamau Farm"/></label>
        <label>Quantity<input type="number" min="0" step="any" value={form.quantity} onChange={set("quantity")} placeholder="optional"/></label>
        <label>Unit price<input type="number" min="0" step="0.01" value={form.unitPrice} onChange={set("unitPrice")} placeholder="optional"/></label>
        <label className="span-2">Total amount received *<input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} required/></label>
        <label className="span-2">Notes<textarea rows={2} value={form.notes} onChange={set("notes")} placeholder="Payment method, invoice ref…"/></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><Plus size={15}/>Record sale</button>
      </div>
    </form>
  );
}

function ExpenseForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({ category:EXPENSE_CATS[0], description:"", date:todayStr(), amount:"", vendor:"", notes:"" });
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.description.trim()||!form.amount)return;onSubmit({...form,amount:parseFloat(form.amount)});}}>
      <div className="form-grid">
        <label>Category<select value={form.category} onChange={set("category")}>{EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Date<input type="date" value={form.date} onChange={set("date")} max={todayStr()}/></label>
        <label className="span-2">Description *<input value={form.description} onChange={set("description")} placeholder="e.g. Vet call — CT-014" required/></label>
        <label>Amount *<input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} required/></label>
        <label>Vendor / payee<input value={form.vendor} onChange={set("vendor")} placeholder="e.g. Dr. Wanjiru"/></label>
        <label className="span-2">Notes<textarea rows={2} value={form.notes} onChange={set("notes")} placeholder="Receipt ref, breakdown…"/></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><Plus size={15}/>Add expense</button>
      </div>
    </form>
  );
}

// ─── Finance pages ────────────────────────────────────────────────────────────
function PartnerForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({ name:"", partnerType:"Supplier", contactPerson:"", phone:"", email:"", address:"", notes:"" });
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.name.trim())return;onSubmit({...form,isActive:true});}}>
      <div className="form-grid">
        <label className="span-2">Partner name *<input value={form.name} onChange={set("name")} placeholder="e.g. Highland Millers or Githunguri Dairy" required/></label>
        <label>Relationship<select value={form.partnerType} onChange={set("partnerType")}>{PARTNER_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
        <label>Contact person<input value={form.contactPerson} onChange={set("contactPerson")} placeholder="e.g. Accounts office"/></label>
        <label>Phone<input value={form.phone} onChange={set("phone")} placeholder="+254 ..."/></label>
        <label>Email<input type="email" value={form.email} onChange={set("email")} placeholder="billing@example.com"/></label>
        <label className="span-2">Address<input value={form.address} onChange={set("address")} placeholder="Town, route, or postal address"/></label>
        <label className="span-2">Notes<textarea rows={2} value={form.notes} onChange={set("notes")} placeholder="Payment terms, delivery preferences, contact notes..."/></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><Plus size={15}/>Add partner</button>
      </div>
    </form>
  );
}

function ContractForm({ partners, onSubmit, onClose }) {
  const [form, setForm] = useState({
    partnerId: partners[0]?.id || "", direction:"Supply to farm", title:"", goodsOrServices:"",
    startDate:todayStr(), endDate:"", billingCycle:"Monthly", agreedRate:"", terms:"", status:"Active",
  });
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  if (!partners.length) return (
    <div><p className="confirm-body">Add a supplier or customer before creating a contract.</p>
      <div className="form-actions"><button className="btn btn--ghost" onClick={onClose}>Close</button></div></div>
  );

  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.partnerId||!form.title.trim()||!form.goodsOrServices.trim())return;onSubmit(form);}}>
      <div className="form-grid">
        <label className="span-2">Partner *<select value={form.partnerId} onChange={set("partnerId")}>{partners.map(p=><option key={p.id} value={p.id}>{p.name} ({p.partnerType})</option>)}</select></label>
        <label>Contract direction<select value={form.direction} onChange={set("direction")}>{CONTRACT_DIRECTIONS.map(d=><option key={d}>{d}</option>)}</select></label>
        <label>Status<select value={form.status} onChange={set("status")}>{CONTRACT_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="span-2">Contract title *<input value={form.title} onChange={set("title")} placeholder="e.g. Weekly milk delivery agreement" required/></label>
        <label className="span-2">Goods or services *<input value={form.goodsOrServices} onChange={set("goodsOrServices")} placeholder="Feed, vaccines, milk, eggs, meat..." required/></label>
        <label>Start date<input type="date" value={form.startDate} onChange={set("startDate")} required/></label>
        <label>End date<input type="date" value={form.endDate} onChange={set("endDate")}/></label>
        <label>Billing cycle<select value={form.billingCycle} onChange={set("billingCycle")}>{BILLING_CYCLES.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Agreed rate<input type="number" min="0" step="0.01" value={form.agreedRate} onChange={set("agreedRate")} placeholder="optional"/></label>
        <label className="span-2">Terms<textarea rows={3} value={form.terms} onChange={set("terms")} placeholder="Delivery schedule, quality requirements, payment window..."/></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><FileText size={15}/>Save contract</button>
      </div>
    </form>
  );
}

function InvoiceForm({ partners, contracts, onSubmit, onClose }) {
  const [form, setForm] = useState({
    partnerId: partners[0]?.id || "", contractId:"", direction:"Payable", invoiceNumber:"",
    issueDate:todayStr(), dueDate:"", description:"", amountPaid:"0", status:"Issued", notes:"",
    items:[{ description:"", quantity:"1", unit:"", unitPrice:"" }],
  });
  const partnerContracts = contracts.filter(c=>String(c.partnerId)===String(form.partnerId));
  const invoiceTotal = form.items.reduce((sum,item)=>sum+(parseFloat(item.quantity)||0)*(parseFloat(item.unitPrice)||0),0);
  const set = k => e => setForm(f=>{
    const next = {...f,[k]:e.target.value};
    if (k === "partnerId") next.contractId = "";
    return next;
  });
  const setItem = (idx,key,value) => setForm(f=>({...f,items:f.items.map((item,i)=>i===idx?{...item,[key]:value}:item)}));
  const addItem = () => setForm(f=>({...f,items:[...f.items,{ description:"", quantity:"1", unit:"", unitPrice:"" }]}));
  const removeItem = idx => setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}));

  if (!partners.length) return (
    <div><p className="confirm-body">Add a supplier or customer before recording an invoice.</p>
      <div className="form-actions"><button className="btn btn--ghost" onClick={onClose}>Close</button></div></div>
  );

  function handleSubmit(e) {
    e.preventDefault();
    const items = form.items
      .map(item=>({
        description:item.description.trim(),
        quantity:parseFloat(item.quantity)||0,
        unit:item.unit,
        unitPrice:parseFloat(item.unitPrice)||0,
      }))
      .filter(item=>item.description && item.quantity>0 && item.unitPrice>=0);
    if(!form.partnerId||!form.invoiceNumber.trim()||!form.description.trim()||items.length===0)return;
    onSubmit({...form,amountPaid:parseFloat(form.amountPaid)||0,items});
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>Invoice type<select value={form.direction} onChange={set("direction")}>{INVOICE_DIRECTIONS.map(d=><option key={d}>{d}</option>)}</select></label>
        <label>Status<select value={form.status} onChange={set("status")}>{INVOICE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="span-2">Partner *<select value={form.partnerId} onChange={set("partnerId")}>{partners.map(p=><option key={p.id} value={p.id}>{p.name} ({p.partnerType})</option>)}</select></label>
        <label className="span-2">Contract<select value={form.contractId} onChange={set("contractId")}><option value="">No contract link</option>{partnerContracts.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <label>Invoice number *<input value={form.invoiceNumber} onChange={set("invoiceNumber")} placeholder="e.g. INV-2026-001" required/></label>
        <label>Issue date<input type="date" value={form.issueDate} onChange={set("issueDate")} required/></label>
        <label>Due date<input type="date" value={form.dueDate} onChange={set("dueDate")}/></label>
        <label>Amount paid<input type="number" min="0" step="0.01" value={form.amountPaid} onChange={set("amountPaid")}/></label>
        <label className="span-2">Description *<input value={form.description} onChange={set("description")} placeholder="e.g. Dairy meal delivery or July milk supply" required/></label>
        <div className="span-2 invoice-items-editor">
          <div className="invoice-items-editor__head"><strong>Invoice items</strong><button type="button" className="btn btn--tiny" onClick={addItem}><Plus size={12}/>Item</button></div>
          {form.items.map((item,idx)=>{
            const lineTotal = (parseFloat(item.quantity)||0)*(parseFloat(item.unitPrice)||0);
            return (
              <div className="invoice-item-row" key={idx}>
                <input value={item.description} onChange={e=>setItem(idx,"description",e.target.value)} placeholder="Item description" required/>
                <input type="number" min="0" step="any" value={item.quantity} onChange={e=>setItem(idx,"quantity",e.target.value)} placeholder="Qty" required/>
                <input value={item.unit} onChange={e=>setItem(idx,"unit",e.target.value)} placeholder="Unit"/>
                <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e=>setItem(idx,"unitPrice",e.target.value)} placeholder="Unit price" required/>
                <span className="mono">{currency(lineTotal)}</span>
                <button type="button" className="icon-btn icon-btn--danger" disabled={form.items.length===1} onClick={()=>removeItem(idx)} aria-label="Remove item"><Trash2 size={14}/></button>
              </div>
            );
          })}
          <div className="invoice-total"><span>Total</span><strong className="mono">{currency(invoiceTotal)}</strong></div>
        </div>
        <label className="span-2">Notes<textarea rows={2} value={form.notes} onChange={set("notes")} placeholder="Payment method, delivery notes, references..."/></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><Receipt size={15}/>Save invoice</button>
      </div>
    </form>
  );
}

function LoanForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({
    lender:"", purpose:"", principalAmount:"", interestRate:"0",
    issueDate:todayStr(), dueDate:"", paymentFrequency:"Monthly",
    status:"Active", collateral:"", notes:"",
  });
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.lender.trim() || !form.purpose.trim() || !form.principalAmount) return;
    onSubmit({
      ...form,
      principalAmount: parseFloat(form.principalAmount) || 0,
      interestRate: parseFloat(form.interestRate) || 0,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>Lender *<input value={form.lender} onChange={set("lender")} placeholder="e.g. Agri Credit SACCO" required/></label>
        <label>Status<select value={form.status} onChange={set("status")}>{LOAN_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="span-2">Purpose *<input value={form.purpose} onChange={set("purpose")} placeholder="e.g. Dairy shed expansion" required/></label>
        <label>Principal amount *<input type="number" min="0" step="0.01" value={form.principalAmount} onChange={set("principalAmount")} required/></label>
        <label>Interest rate (%)<input type="number" min="0" step="0.01" value={form.interestRate} onChange={set("interestRate")}/></label>
        <label>Issue date<input type="date" value={form.issueDate} onChange={set("issueDate")} required/></label>
        <label>Due date<input type="date" value={form.dueDate} onChange={set("dueDate")}/></label>
        <label>Payment frequency<select value={form.paymentFrequency} onChange={set("paymentFrequency")}>{LOAN_PAYMENT_FREQUENCIES.map(f=><option key={f}>{f}</option>)}</select></label>
        <label>Collateral<input value={form.collateral} onChange={set("collateral")} placeholder="optional"/></label>
        <label className="span-2">Notes<textarea rows={2} value={form.notes} onChange={set("notes")} placeholder="Loan officer, terms, grace period..."/></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary"><Banknote size={15}/>Save loan</button>
      </div>
    </form>
  );
}

function LoanPaymentForm({ loans, selectedLoanId, onSubmit, onClose }) {
  const payableLoans = loans.filter(l=>l.outstandingBalance > 0 && l.status !== "Written off");
  const selectedPayableLoan = payableLoans.find(l=>String(l.id)===String(selectedLoanId));
  const initialLoanId = selectedPayableLoan?.id || payableLoans[0]?.id || "";
  const [form, setForm] = useState({
    loanId: initialLoanId, date:todayStr(), amount:"", method:"", reference:"", notes:"",
  });
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const selected = payableLoans.find(l=>String(l.id)===String(form.loanId));
  const amount = parseFloat(form.amount) || 0;
  const exceedsOutstanding = selected && amount > selected.outstandingBalance;

  if (!loans.length) return (
    <div><p className="confirm-body">Add a loan before recording a loan payment.</p>
      <div className="form-actions"><button className="btn btn--ghost" onClick={onClose}>Close</button></div></div>
  );
  if (!payableLoans.length) return (
    <div><p className="confirm-body">There are no loans with an outstanding balance to pay.</p>
      <div className="form-actions"><button className="btn btn--ghost" onClick={onClose}>Close</button></div></div>
  );

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.loanId || !form.amount) return;
    if (!selected || exceedsOutstanding || amount <= 0) return;
    onSubmit({
      ...form,
      amount,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="span-2">Loan *<select value={form.loanId} onChange={set("loanId")}>{payableLoans.map(l=><option key={l.id} value={l.id}>{l.lender} - {l.purpose}</option>)}</select></label>
        <label>Date<input type="date" value={form.date} onChange={set("date")} max={todayStr()} required/></label>
        <label>Amount paid *<input type="number" min="0.01" max={selected?.outstandingBalance || undefined} step="0.01" value={form.amount} onChange={set("amount")} placeholder={selected?`Outstanding ${currency(selected.outstandingBalance)}`:""} required/></label>
        <label>Method<input value={form.method} onChange={set("method")} placeholder="e.g. M-Pesa, bank"/></label>
        <label>Reference<input value={form.reference} onChange={set("reference")} placeholder="Receipt or transaction ID"/></label>
        <label className="span-2">Notes<textarea rows={2} value={form.notes} onChange={set("notes")} placeholder="Installment notes..."/></label>
      </div>
      {selected && <p className="muted small profile-note">Outstanding before this payment: <span className="mono">{currency(selected.outstandingBalance)}</span></p>}
      {exceedsOutstanding && <p className="form-error">Payment cannot exceed the outstanding balance of {currency(selected.outstandingBalance)}.</p>}
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={!selected || amount <= 0 || exceedsOutstanding}><Receipt size={15}/>Record payment</button>
      </div>
    </form>
  );
}

function StatementPage({ animals, sales, expenses, loans, invoices }) {
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(()=>{
    const years = new Set([currentYear]);
    const collect = date => { const year = Number((date||"").slice(0,4)); if (year) years.add(year); };
    animals.forEach(a=>{ collect(a.createdAt); collect(a.dob); });
    sales.forEach(s=>collect(s.date));
    expenses.forEach(e=>collect(e.date));
    loans.forEach(l=>{ collect(l.issueDate); (l.payments||[]).forEach(p=>collect(p.date)); });
    invoices.forEach(i=>collect(i.issueDate));
    return Array.from(years).sort((a,b)=>b-a);
  },[animals,sales,expenses,loans,invoices,currentYear]);

  const [year, setYear] = useState(availableYears[0] || currentYear);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(12);
  const normalizedStart = Math.min(Number(startMonth), Number(endMonth));
  const normalizedEnd = Math.max(Number(startMonth), Number(endMonth));
  const periodLabel = `${MONTH_OPTIONS.find(m=>m.value===normalizedStart)?.label} to ${MONTH_OPTIONS.find(m=>m.value===normalizedEnd)?.label} ${year}`;

  function inPeriod(date) {
    if (!date) return false;
    const d = new Date(String(date).slice(0,10)+"T00:00:00");
    if (isNaN(d)) return false;
    const month = d.getMonth()+1;
    return d.getFullYear() === Number(year) && month >= normalizedStart && month <= normalizedEnd;
  }

  const purchasedAnimals = animals.filter(a=>a.origin==="Purchased");
  const bornAnimals = animals.filter(a=>a.origin==="Born in herd");
  const activeAnimals = animals.filter(a=>!["Sold","Deceased"].includes(a.status));
  const periodPurchased = purchasedAnimals.filter(a=>inPeriod(a.createdAt));
  const periodBorn = bornAnimals.filter(a=>inPeriod(a.dob || a.createdAt));
  const periodSales = sales.filter(s=>inPeriod(s.date));
  const periodExpenses = expenses.filter(e=>inPeriod(e.date));
  const periodLoans = loans.filter(l=>inPeriod(l.issueDate));
  const loanPayments = loans.flatMap(loan=>(loan.payments||[]).map(payment=>({...payment,loan})));
  const periodLoanPayments = loanPayments.filter(p=>inPeriod(p.date));

  const herdValue = animals.reduce((sum,a)=>sum+(Number(a.currentValue)||0),0);
  const activeHerdValue = activeAnimals.reduce((sum,a)=>sum+(Number(a.currentValue)||0),0);
  const purchaseBasis = animals.reduce((sum,a)=>sum+(Number(a.purchaseCost)||0),0);
  const periodPurchaseCost = periodPurchased.reduce((sum,a)=>sum+(Number(a.purchaseCost)||0),0);
  const totalLoanPrincipal = loans.reduce((sum,l)=>sum+l.principalAmount,0);
  const outstandingDebt = loans.reduce((sum,l)=>sum+l.outstandingBalance,0);
  const periodLoanPrincipal = periodLoans.reduce((sum,l)=>sum+l.principalAmount,0);
  const periodDebtPaid = periodLoanPayments.reduce((sum,p)=>sum+p.amount,0);
  const periodRevenue = periodSales.reduce((sum,s)=>sum+s.amount,0) + periodLoanPrincipal;
  const periodExpenseTotal = periodExpenses.reduce((sum,e)=>sum+e.amount,0) + periodDebtPaid;
  const periodOperatingProfit = periodRevenue - periodExpenseTotal;
  const receivableOutstanding = invoices.filter(i=>i.direction==="Receivable").reduce((sum,i)=>sum+Math.max(i.amount-i.amountPaid,0),0);
  const payableOutstanding = invoices.filter(i=>i.direction==="Payable").reduce((sum,i)=>sum+Math.max(i.amount-i.amountPaid,0),0);
  const netPosition = activeHerdValue + receivableOutstanding - payableOutstanding - outstandingDebt;
  const roi = purchaseBasis > 0 ? ((herdValue - purchaseBasis + periodOperatingProfit) / purchaseBasis) * 100 : null;
  const expenseByCategory = Object.entries({
      ...periodExpenses.reduce((acc,e)=>({...acc,[e.category]:(acc[e.category]||0)+e.amount}),{}),
      ...(periodDebtPaid ? {"Loan payments": periodDebtPaid} : {}),
    })
    .map(([category,total])=>({category,total}))
    .sort((a,b)=>b.total-a.total)
    .slice(0,6);
  const salesByType = Object.entries({
      ...periodSales.reduce((acc,s)=>({...acc,[s.type]:(acc[s.type]||0)+s.amount}),{}),
      ...(periodLoanPrincipal ? {"Loan proceeds": periodLoanPrincipal} : {}),
    })
    .map(([type,total])=>({type,total}))
    .sort((a,b)=>b.total-a.total)
    .slice(0,6);
  const positionTone = netPosition >= 0 ? "green" : "rust";

  return (
    <div className="page">
      <div className="statement-hero">
        <div>
          <span className="statement-hero__eyebrow">Statement period</span>
          <h2>{periodLabel}</h2>
          <p>Prepared from livestock value, operating records, invoices, and loan balances currently in the farm ledger.</p>
        </div>
        <button className="btn btn--ghost" onClick={()=>window.print()}><Printer size={15}/>Print</button>
      </div>

      <div className="toolbar no-print">
        <select aria-label="Statement year" value={year} onChange={e=>setYear(Number(e.target.value))}>{availableYears.map(y=><option key={y} value={y}>{y}</option>)}</select>
        <select aria-label="Statement start month" value={startMonth} onChange={e=>setStartMonth(Number(e.target.value))}>{MONTH_OPTIONS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select>
        <select aria-label="Statement end month" value={endMonth} onChange={e=>setEndMonth(Number(e.target.value))}>{MONTH_OPTIONS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select>
        <span className="muted small">Change the year or month range to refresh the statement.</span>
      </div>

      <div className="stat-row fin-stats">
        <StatCard icon={PawPrint} label="Animals" value={animals.length} sub={`${purchasedAnimals.length} purchased, ${bornAnimals.length} born`} tone="green"/>
        <StatCard icon={Banknote} label="Sales" value={currencyShort(periodRevenue)} sub={`${periodSales.length} records in period`} tone="green"/>
        <StatCard icon={Receipt} label="Expenses" value={currencyShort(periodExpenseTotal)} sub={`${periodExpenses.length} records in period`} tone="rust"/>
        <StatCard icon={positionTone==="green"?Wallet:TrendingDown} label="Net worth position" value={currencyShort(Math.abs(netPosition))} sub={netPosition>=0?"assets above liabilities":"liabilities above assets"} tone={positionTone}/>
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel__head"><h3><PawPrint size={16}/>Herd capital</h3></div>
          <ul className="list-rows">
            <li><span>Current herd value</span><strong className="mono">{currency(herdValue)}</strong></li>
            <li><span>Active herd value</span><strong className="mono">{currency(activeHerdValue)}</strong></li>
            <li><span>Purchase basis</span><strong className="mono">{currency(purchaseBasis)}</strong></li>
            <li><span>Period purchases</span><strong className="mono">{periodPurchased.length} animals / {currency(periodPurchaseCost)}</strong></li>
            <li><span>Period births</span><strong className="mono">{periodBorn.length} animals</strong></li>
          </ul>
        </div>

        <div className="panel">
          <div className="panel__head"><h3><BadgeDollarSign size={16}/>Operating result</h3></div>
          <ul className="list-rows">
            <li><span>Sales revenue</span><strong className="mono trend-up">{currency(periodRevenue)}</strong></li>
            <li><span>Operating expenses</span><strong className="mono trend-down">{currency(periodExpenseTotal)}</strong></li>
            <li><span>Operating profit / loss</span><strong className={`mono ${periodOperatingProfit>=0?"trend-up":"trend-down"}`}>{periodOperatingProfit>=0?"+":"-"}{currency(Math.abs(periodOperatingProfit))}</strong></li>
            <li><span>Return on investment</span><strong className={`mono ${roi===null||roi>=0?"trend-up":"trend-down"}`}>{roi===null?"-":`${roi>=0?"+":""}${roi.toFixed(1)}%`}</strong></li>
          </ul>
        </div>

        <div className="panel">
          <div className="panel__head"><h3><Wallet size={16}/>Loans and liabilities</h3></div>
          <ul className="list-rows">
            <li><span>Total loan principal</span><strong className="mono">{currency(totalLoanPrincipal)}</strong></li>
            <li><span>Outstanding loan balance</span><strong className="mono trend-down">{currency(outstandingDebt)}</strong></li>
            <li><span>New loans in period</span><strong className="mono">{currency(periodLoanPrincipal)}</strong></li>
            <li><span>Loan payments in period</span><strong className="mono">{currency(periodDebtPaid)}</strong></li>
            <li><span>Bills payable</span><strong className="mono trend-down">{currency(payableOutstanding)}</strong></li>
          </ul>
        </div>

        <div className="panel">
          <div className="panel__head"><h3><FileText size={16}/>Receivables and position</h3></div>
          <ul className="list-rows">
            <li><span>Customer invoices to collect</span><strong className="mono trend-up">{currency(receivableOutstanding)}</strong></li>
            <li><span>Supplier invoices to pay</span><strong className="mono trend-down">{currency(payableOutstanding)}</strong></li>
            <li><span>Assets counted</span><strong className="mono">{currency(activeHerdValue + receivableOutstanding)}</strong></li>
            <li><span>Liabilities counted</span><strong className="mono">{currency(outstandingDebt + payableOutstanding)}</strong></li>
            <li><span>Overall position</span><strong className={`mono ${netPosition>=0?"trend-up":"trend-down"}`}>{netPosition>=0?"+":"-"}{currency(Math.abs(netPosition))}</strong></li>
          </ul>
        </div>

        <div className="panel">
          <div className="panel__head"><h3>Sales by type</h3></div>
          {salesByType.length===0 ? <p className="muted small">No sales in this period.</p> : (
            <table className="mini-table"><tbody>{salesByType.map(row=><tr key={row.type}><td>{row.type}</td><td className="mono trend-up">{currency(row.total)}</td></tr>)}</tbody></table>
          )}
        </div>

        <div className="panel">
          <div className="panel__head"><h3>Expenses by category</h3></div>
          {expenseByCategory.length===0 ? <p className="muted small">No expenses in this period.</p> : (
            <table className="mini-table"><tbody>{expenseByCategory.map(row=><tr key={row.category}><td>{row.category}</td><td className="mono trend-down">{currency(row.total)}</td></tr>)}</tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}

function FinancesPage({ sales, expenses, loans, onNavigate }) {
  const loanPayments    = useMemo(()=>loans.flatMap(loan=>(loan.payments||[]).map(payment=>({...payment,loan}))),[loans]);
  const loanDisbursements = useMemo(()=>loans.map(loan=>({
    id: loan.id,
    date: loan.issueDate,
    amount: loan.principalAmount,
    description: `Loan received - ${loan.lender}`,
    loan,
  })),[loans]);
  const totalRevenue    = sales.reduce((s,x)=>s+x.amount,0) + loanDisbursements.reduce((s,x)=>s+x.amount,0);
  const totalExpenses   = expenses.reduce((s,x)=>s+x.amount,0) + loanPayments.reduce((s,x)=>s+x.amount,0);
  const netProfit       = totalRevenue - totalExpenses;
  const margin          = totalRevenue>0 ? ((netProfit/totalRevenue)*100).toFixed(1) : null;
  const outstandingDebt = loans.reduce((s,x)=>s+x.outstandingBalance,0);

  const now = todayStr();
  const thisMonthKey = monthKey(now);
  const monthRevenue  = sales.filter(x=>monthKey(x.date)===thisMonthKey).reduce((s,x)=>s+x.amount,0)
    + loanDisbursements.filter(x=>monthKey(x.date)===thisMonthKey).reduce((s,x)=>s+x.amount,0);
  const monthExpenses = expenses.filter(x=>monthKey(x.date)===thisMonthKey).reduce((s,x)=>s+x.amount,0)
    + loanPayments.filter(x=>monthKey(x.date)===thisMonthKey).reduce((s,x)=>s+x.amount,0);
  const monthLoanPayments = loanPayments.filter(x=>monthKey(x.date)===thisMonthKey).reduce((s,x)=>s+x.amount,0);
  const monthProfit   = monthRevenue - monthExpenses;

  // Monthly bar chart (last 8 months)
  const monthlyChart = useMemo(()=>{
    const buckets = {};
    sales.forEach(x=>{ const k=monthKey(x.date); if(k) { buckets[k]=buckets[k]||{rev:0,exp:0}; buckets[k].rev+=x.amount; }});
    expenses.forEach(x=>{ const k=monthKey(x.date); if(k) { buckets[k]=buckets[k]||{rev:0,exp:0}; buckets[k].exp+=x.amount; }});
    loanDisbursements.forEach(x=>{ const k=monthKey(x.date); if(k) { buckets[k]=buckets[k]||{rev:0,exp:0}; buckets[k].rev+=x.amount; }});
    loanPayments.forEach(x=>{ const k=monthKey(x.date); if(k) { buckets[k]=buckets[k]||{rev:0,exp:0}; buckets[k].exp+=x.amount; }});
    return Object.entries(buckets).sort((a,b)=>a[0]<b[0]?-1:1).slice(-8)
      .map(([k,v])=>({ label:monthLabel(k), revenue:Math.round(v.rev), expenses:Math.round(v.exp), profit:Math.round(v.rev-v.exp) }));
  },[sales,expenses,loanDisbursements,loanPayments]);

  // Expense by category pie
  const expCatData = useMemo(()=>{
    const c={};
    expenses.forEach(x=>{ c[x.category]=(c[x.category]||0)+x.amount; });
    loanPayments.forEach(x=>{ c["Loan payments"]=(c["Loan payments"]||0)+x.amount; });
    return Object.entries(c).map(([name,value])=>({name,value:Math.round(value)})).sort((a,b)=>b.value-a.value);
  },[expenses,loanPayments]);

  // Revenue by type pie
  const revTypeData = useMemo(()=>{
    const c={};
    sales.forEach(x=>{ c[x.type]=(c[x.type]||0)+x.amount; });
    loanDisbursements.forEach(x=>{ c["Loan proceeds"]=(c["Loan proceeds"]||0)+x.amount; });
    return Object.entries(c).map(([name,value])=>({name,value:Math.round(value)})).sort((a,b)=>b.value-a.value);
  },[sales,loanDisbursements]);

  const recentTx = [
    ...sales.map(x=>({...x,_kind:"sale"})),
    ...expenses.map(x=>({...x,_kind:"expense"})),
    ...loanDisbursements.map(x=>({...x,_kind:"loan_income"})),
    ...loanPayments.map(x=>({...x,_kind:"loan_payment",description:`Loan payment - ${x.loan.lender}`})),
  ].sort((a,b)=>a.date<b.date?1:-1).slice(0,10);

  const isEmpty = sales.length===0 && expenses.length===0 && loans.length===0;

  return (
    <div className="page">
      {/* KPI row */}
      <div className="stat-row fin-stats">
        <StatCard icon={Banknote}     label="Total revenue"     value={currencyShort(totalRevenue)}   sub={`${sales.length} sale records`}       tone="green"/>
        <StatCard icon={Receipt}      label="Total expenses"    value={currencyShort(totalExpenses)}  sub={`${expenses.length} expense records`}  tone="rust"/>
        <StatCard icon={netProfit>=0?Wallet:TrendingDown} label="Net profit / loss" value={currencyShort(Math.abs(netProfit))} sub={margin!==null?`${margin}% margin`:"revenue minus costs"} tone={netProfit>=0?"green":"rust"}/>
        <StatCard icon={Wallet} label="Loan balance" value={currencyShort(outstandingDebt)} sub={`${loans.length} loan record${loans.length===1?"":"s"}`} tone={outstandingDebt>0?"gold":"ink"}/>
      </div>

      {/* This month KPIs */}
      <div className="fin-month-strip">
        <div className="fin-month-strip__label">This month</div>
        <div className="fin-month-strip__kpis">
          <div><span className="muted small">Revenue</span><strong className="trend-up mono">{currency(monthRevenue)}</strong></div>
          <div><span className="muted small">Expenses</span><strong className="trend-down mono">{currency(monthExpenses)}</strong></div>
          <div><span className="muted small">Loan payments</span><strong className="trend-down mono">{currency(monthLoanPayments)}</strong></div>
          <div><span className="muted small">Profit / Loss</span><strong className={`mono ${monthProfit>=0?"trend-up":"trend-down"}`}>{monthProfit>=0?"+":"-"}{currency(Math.abs(monthProfit))}</strong></div>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState icon={Banknote} title="No financial records yet"
          body="Record your first sale or expense to start tracking farm finances."
          actionLabel="Record a sale" onAction={()=>onNavigate("sales")}/>
      ) : (
        <div className="dash-grid">
          {/* Monthly trend */}
          <div className="panel panel--wide">
            <div className="panel__head">
              <h3>Monthly revenue vs expenses</h3>
              <div style={{display:"flex",gap:14,fontSize:12}}>
                <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:2,background:BAR_REVENUE,display:"inline-block"}}/> Revenue</span>
                <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:2,background:BAR_EXPENSE,display:"inline-block"}}/> Expenses</span>
              </div>
            </div>
            {monthlyChart.length<1 ? <p className="muted small">No dated records yet.</p> : (
              <div style={{height:210}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChart} margin={{top:8,right:8,left:-18,bottom:0}} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4DCC8"/>
                    <XAxis dataKey="label" tick={{fontSize:11,fill:"#8A7B62"}}/>
                    <YAxis tick={{fontSize:11,fill:"#8A7B62"}} width={40} tickFormatter={v=>currencyShort(v)}/>
                    <Tooltip formatter={v=>[currency(v)]} contentStyle={{fontFamily:"Inter,sans-serif",fontSize:12,borderRadius:8,border:"1px solid #E4DCC8"}}/>
                    <Bar dataKey="revenue"  fill={BAR_REVENUE} radius={[4,4,0,0]} name="Revenue"/>
                    <Bar dataKey="expenses" fill={BAR_EXPENSE} radius={[4,4,0,0]} name="Expenses"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Revenue breakdown */}
          <div className="panel">
            <div className="panel__head"><h3>Revenue by type</h3><button className="link-btn" onClick={()=>onNavigate("sales")}>View all <ChevronRight size={13}/></button></div>
            {revTypeData.length===0 ? <p className="muted small">No sales yet.</p> : (
              <div className="composition">
                <div style={{width:130,height:130,flexShrink:0}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={revTypeData} dataKey="value" innerRadius={35} outerRadius={58} paddingAngle={2}>
                      {revTypeData.map((e,i)=><Cell key={e.name} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                    </Pie></PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="legend-list">
                  {revTypeData.map((s,i)=>(
                    <li key={s.name}><span className="legend-dot" style={{background:PIE_COLORS[i%PIE_COLORS.length]}}/>{s.name}<span className="muted mono" style={{marginLeft:"auto"}}>{currencyShort(s.value)}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Expense breakdown */}
          <div className="panel">
            <div className="panel__head"><h3>Expenses by category</h3><button className="link-btn" onClick={()=>onNavigate("expenses")}>View all <ChevronRight size={13}/></button></div>
            {expCatData.length===0 ? <p className="muted small">No expenses yet.</p> : (
              <div className="composition">
                <div style={{width:130,height:130,flexShrink:0}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={expCatData} dataKey="value" innerRadius={35} outerRadius={58} paddingAngle={2}>
                      {expCatData.map((e,i)=><Cell key={e.name} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                    </Pie></PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="legend-list">
                  {expCatData.map((s,i)=>(
                    <li key={s.name}><span className="legend-dot" style={{background:PIE_COLORS[i%PIE_COLORS.length]}}/>{s.name}<span className="muted mono" style={{marginLeft:"auto"}}>{currencyShort(s.value)}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Recent transactions */}
          <div className="panel panel--wide">
            <div className="panel__head">
              <h3>Recent transactions</h3>
              <div style={{display:"flex",gap:8}}>
                <button className="link-btn" onClick={()=>onNavigate("loans")}>Loans <ChevronRight size={13}/></button>
                <button className="link-btn" onClick={()=>onNavigate("sales")}>Sales <ChevronRight size={13}/></button>
                <button className="link-btn" onClick={()=>onNavigate("expenses")}>Expenses <ChevronRight size={13}/></button>
              </div>
            </div>
            <div className="table-wrap finance-table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Description</th><th>Date</th><th>Amount</th></tr></thead>
              <tbody>
                {recentTx.map(tx=>(
                  <tr key={`${tx._kind}-${tx.id}`}>
                    <td data-label="Type"><Badge tone={tx._kind==="sale"||tx._kind==="loan_income"?"success":"danger"}>{tx._kind==="sale"?"Revenue":tx._kind==="loan_income"?"Loan income":tx._kind==="loan_payment"?"Loan payment":"Expense"}</Badge></td>
                    <td data-label="Description">{tx.description}</td>
                    <td data-label="Date" className="mono">{formatDate(tx.date)}</td>
                    <td data-label="Amount" className={`mono ${tx._kind==="sale"||tx._kind==="loan_income"?"trend-up":"trend-down"}`}>
                      {tx._kind==="sale"||tx._kind==="loan_income"?"+":"-"}{currency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContractsPage({ partners, contracts, invoices, onAddPartner, onAddContract, onAddInvoice, onDeletePartner, onDeleteContract, onDeleteInvoice }) {
  const [tab, setTab] = useState("invoices");
  const [confirm, setConfirm] = useState(null);
  const payable = invoices.filter(i=>i.direction==="Payable").reduce((s,i)=>s+Math.max(i.amount-i.amountPaid,0),0);
  const receivable = invoices.filter(i=>i.direction==="Receivable").reduce((s,i)=>s+Math.max(i.amount-i.amountPaid,0),0);
  const activeContracts = contracts.filter(c=>c.status==="Active").length;

  function confirmDelete() {
    if (confirm?.type === "partner") onDeletePartner(confirm.id);
    if (confirm?.type === "contract") onDeleteContract(confirm.id);
    if (confirm?.type === "invoice") onDeleteInvoice(confirm.id);
    setConfirm(null);
  }

  return (
    <div className="page">
      <div className="stat-row fin-stats">
        <StatCard icon={Users} label="Partners" value={partners.length} sub="suppliers and customers" tone="ink"/>
        <StatCard icon={FileText} label="Active contracts" value={activeContracts} sub={`${contracts.length} total agreements`} tone="green"/>
        <StatCard icon={Receipt} label="Bills to pay" value={currencyShort(payable)} sub="supplier invoices outstanding" tone="rust"/>
        <StatCard icon={Banknote} label="To collect" value={currencyShort(receivable)} sub="customer invoices outstanding" tone="gold"/>
      </div>

      <div className="toolbar">
        <div className="segmented-tabs">
          {["invoices","contracts","partners"].map(t=><button key={t} className={tab===t?"is-active":""} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}
        </div>
        <div className="spacer"/>
        <button className="btn btn--ghost" onClick={onAddPartner}><UserPlus size={15}/>Partner</button>
        <button className="btn btn--ghost" onClick={onAddContract}><FileText size={15}/>Contract</button>
        <button className="btn btn--primary" onClick={onAddInvoice}><Receipt size={15}/>Invoice</button>
      </div>

      {tab==="partners" && (partners.length===0 ? (
        <EmptyState icon={Users} title="No partners yet" body="Add suppliers, veterinarians, milk buyers, butcheries, or egg customers before creating contracts and invoices." actionLabel="Add partner" onAction={onAddPartner}/>
      ) : (
        <div className="table-wrap responsive-table-wrap"><table>
          <thead><tr><th>Name</th><th>Type</th><th>Contact</th><th>Phone</th><th>Email</th><th>Notes</th><th/></tr></thead>
          <tbody>{partners.map(p=>(
            <tr key={p.id}>
              <td data-label="Name"><strong>{p.name}</strong></td><td data-label="Type"><Badge tone={p.partnerType==="Supplier"?"warning":p.partnerType==="Customer"?"success":"neutral"}>{p.partnerType}</Badge></td>
              <td data-label="Contact">{p.contactPerson||"-"}</td><td data-label="Phone" className="mono">{p.phone||"-"}</td><td data-label="Email" className="mono">{p.email||"-"}</td><td data-label="Notes" className="muted">{p.notes||"-"}</td>
              <td data-label="" className="actions-cell"><button className="icon-btn icon-btn--danger" onClick={()=>setConfirm({type:"partner",id:p.id})} aria-label="Delete partner"><Trash2 size={15}/></button></td>
            </tr>
          ))}</tbody>
        </table></div>
      ))}

      {tab==="contracts" && (contracts.length===0 ? (
        <EmptyState icon={FileText} title="No contracts yet" body="Create agreements for suppliers who bill the farm and customers who buy farm outputs." actionLabel="Add contract" onAction={onAddContract}/>
      ) : (
        <div className="table-wrap responsive-table-wrap"><table>
          <thead><tr><th>Contract</th><th>Partner</th><th>Direction</th><th>Goods / services</th><th>Cycle</th><th>Rate</th><th>Status</th><th>Dates</th><th/></tr></thead>
          <tbody>{contracts.map(c=>(
            <tr key={c.id}>
              <td data-label="Contract"><strong>{c.title}</strong></td><td data-label="Partner">{c.partnerName}</td><td data-label="Direction"><Badge tone={c.direction==="Farm output"?"success":"warning"}>{c.direction}</Badge></td>
              <td data-label="Goods / services">{c.goodsOrServices}</td><td data-label="Cycle">{c.billingCycle}</td><td data-label="Rate" className="mono">{c.agreedRate?currency(c.agreedRate):"-"}</td><td data-label="Status"><Badge tone={c.status==="Active"?"success":"neutral"}>{c.status}</Badge></td>
              <td data-label="Dates" className="mono">{formatDate(c.startDate)}{c.endDate?` - ${formatDate(c.endDate)}`:""}</td>
              <td data-label="" className="actions-cell"><button className="icon-btn icon-btn--danger" onClick={()=>setConfirm({type:"contract",id:c.id})} aria-label="Delete contract"><Trash2 size={15}/></button></td>
            </tr>
          ))}</tbody>
        </table></div>
      ))}

      {tab==="invoices" && (invoices.length===0 ? (
        <EmptyState icon={Receipt} title="No invoices yet" body="Record supplier invoices the farm must pay, or customer invoices the farm has issued for outputs." actionLabel="Add invoice" onAction={onAddInvoice}/>
      ) : (
        <div className="table-wrap responsive-table-wrap"><table>
          <thead><tr><th>Invoice</th><th>Type</th><th>Partner</th><th>Contract</th><th>Issued</th><th>Due</th><th>Amount</th><th>Paid</th><th>Status</th><th/></tr></thead>
          <tbody>{invoices.map(i=>(
            <tr key={i.id}>
              <td data-label="Invoice"><strong>{i.invoiceNumber}</strong><div className="muted small">{i.description}</div><div className="muted small">{i.items?.length||0} item{i.items?.length===1?"":"s"}</div></td><td data-label="Type"><Badge tone={i.direction==="Receivable"?"success":"danger"}>{i.direction}</Badge></td>
              <td data-label="Partner">{i.partnerName}</td><td data-label="Contract">{i.contractTitle||"-"}</td><td data-label="Issued" className="mono">{formatDate(i.issueDate)}</td><td data-label="Due" className="mono">{formatDate(i.dueDate)}</td>
              <td data-label="Amount" className="mono">{currency(i.amount)}</td><td data-label="Paid" className="mono">{currency(i.amountPaid)}</td><td data-label="Status"><Badge tone={invoiceTone(i.status)}>{i.status}</Badge></td>
              <td data-label="" className="actions-cell"><button className="icon-btn icon-btn--danger" onClick={()=>setConfirm({type:"invoice",id:i.id})} aria-label="Delete invoice"><Trash2 size={15}/></button></td>
            </tr>
          ))}</tbody>
        </table></div>
      ))}
      {confirm&&<ConfirmDialog title="Delete record" body="This permanently removes the selected record." onCancel={()=>setConfirm(null)} onConfirm={confirmDelete}/>} 
    </div>
  );
}

function LoansPage({ loans, onAddLoan, onAddPayment, onDeleteLoan, onDeletePayment }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [confirm, setConfirm] = useState(null);
  const totalPrincipal = loans.reduce((s,l)=>s+l.principalAmount,0);
  const totalDue = loans.reduce((s,l)=>s+l.totalDue,0);
  const totalPaid = loans.reduce((s,l)=>s+l.totalPaid,0);
  const outstanding = loans.reduce((s,l)=>s+l.outstandingBalance,0);

  const rows = loans
    .filter(l=>{
      const q = query.toLowerCase();
      const matchesQuery = !q || l.lender.toLowerCase().includes(q) || l.purpose.toLowerCase().includes(q) || (l.collateral||"").toLowerCase().includes(q);
      return matchesQuery && (statusFilter==="All" || l.status===statusFilter);
    })
    .sort((a,b)=>(a.dueDate||"9999-99-99")>(b.dueDate||"9999-99-99")?1:-1);

  const recentPayments = loans
    .flatMap(loan=>(loan.payments||[]).map(payment=>({...payment,loan})))
    .sort((a,b)=>a.date<b.date?1:-1)
    .slice(0,8);

  function confirmDelete() {
    if (confirm?.type === "loan") onDeleteLoan(confirm.id);
    if (confirm?.type === "payment") onDeletePayment(confirm.id);
    setConfirm(null);
  }

  return (
    <div className="page">
      <div className="stat-row fin-stats">
        <StatCard icon={Banknote} label="Loan principal" value={currencyShort(totalPrincipal)} sub={`${loans.length} loan record${loans.length===1?"":"s"}`} tone="ink"/>
        <StatCard icon={BadgeDollarSign} label="Total due" value={currencyShort(totalDue)} sub="principal plus interest" tone="gold"/>
        <StatCard icon={Receipt} label="Paid back" value={currencyShort(totalPaid)} sub="recorded repayments" tone="green"/>
        <StatCard icon={Wallet} label="Outstanding" value={currencyShort(outstanding)} sub="remaining balance" tone={outstanding>0?"rust":"green"}/>
      </div>

      <div className="toolbar">
        <div className="search-box"><Search size={15}/><input placeholder="Lender, purpose, collateral..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option>All</option>{LOAN_STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
        <div className="spacer"/>
        <button className="btn btn--ghost" onClick={()=>onAddPayment()}><Receipt size={15}/>Payment</button>
        <button className="btn btn--primary" onClick={onAddLoan}><Plus size={15}/>Loan</button>
      </div>

      {loans.length===0 ? (
        <EmptyState icon={Banknote} title="No loans recorded" body="Add farm loans and track each repayment against the outstanding balance." actionLabel="Add loan" onAction={onAddLoan}/>
      ) : rows.length===0 ? <p className="muted">No loans match that filter.</p> : (
        <div className="table-wrap responsive-table-wrap">
          <table>
            <thead><tr><th>Lender</th><th>Purpose</th><th>Issued</th><th>Due</th><th>Principal</th><th>Interest</th><th>Paid</th><th>Outstanding</th><th>Status</th><th/></tr></thead>
            <tbody>{rows.map(l=>(
              <tr key={l.id}>
                <td data-label="Lender"><strong>{l.lender}</strong><div className="muted small">{l.paymentFrequency}</div></td>
                <td data-label="Purpose">{l.purpose}<div className="muted small">{l.collateral||"No collateral recorded"}</div></td>
                <td data-label="Issued" className="mono">{formatDate(l.issueDate)}</td>
                <td data-label="Due" className="mono">{formatDate(l.dueDate)}</td>
                <td data-label="Principal" className="mono">{currency(l.principalAmount)}</td>
                <td data-label="Interest" className="mono">{l.interestRate}%</td>
                <td data-label="Paid" className="mono trend-up">{currency(l.totalPaid)}</td>
                <td data-label="Outstanding" className={`mono ${l.outstandingBalance>0?"trend-down":"trend-up"}`}>{currency(l.outstandingBalance)}</td>
                <td data-label="Status"><Badge tone={loanTone(l.status)}>{l.status}</Badge></td>
                <td data-label="" className="actions-cell">
                  <button className="btn btn--tiny" disabled={l.outstandingBalance<=0} onClick={()=>onAddPayment(l.id)}><Receipt size={12}/>Pay</button>
                  <button className="icon-btn icon-btn--danger" onClick={()=>setConfirm({type:"loan",id:l.id})} aria-label="Delete loan"><Trash2 size={15}/></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div className="panel">
        <div className="panel__head"><h3><Receipt size={16}/>Recent loan payments</h3></div>
        {recentPayments.length===0 ? <p className="muted small">No loan payments recorded yet.</p> : (
          <div className="table-wrap responsive-table-wrap">
          <table>
            <thead><tr><th>Loan</th><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th/></tr></thead>
            <tbody>{recentPayments.map(p=>(
              <tr key={p.id}>
                <td data-label="Loan">{p.loan.lender}<div className="muted small">{p.loan.purpose}</div></td>
                <td data-label="Date" className="mono">{formatDate(p.date)}</td>
                <td data-label="Amount" className="mono trend-down">{currency(p.amount)}</td>
                <td data-label="Method">{p.method||"-"}</td>
                <td data-label="Reference" className="mono">{p.reference||"-"}</td>
                <td data-label="" className="actions-cell"><button className="icon-btn icon-btn--danger" onClick={()=>setConfirm({type:"payment",id:p.id})} aria-label="Delete payment"><Trash2 size={15}/></button></td>
              </tr>
            ))}</tbody>
          </table>
          </div>
        )}
      </div>

      {confirm&&<ConfirmDialog title="Delete loan record" body={confirm.type==="loan"?"This removes the loan and all payments recorded against it.":"This removes the selected loan payment."} onCancel={()=>setConfirm(null)} onConfirm={confirmDelete}/>}
    </div>
  );
}
function SalesPage({ sales, onAdd, onDelete }) {
  const [query, setQuery]       = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [confirmId, setConfirmId] = useState(null);
  const total = sales.reduce((s,x)=>s+x.amount,0);

  const rows = sales
    .filter(x=>{ const q=query.toLowerCase(); return (!q||x.description.toLowerCase().includes(q)||(x.buyer||"").toLowerCase().includes(q)) && (typeFilter==="All"||x.type===typeFilter); })
    .sort((a,b)=>a.date<b.date?1:-1);

  return (
    <div className="page">
      <div className="stat-row finance-summary-row">
        <StatCard icon={Banknote}   label="Total revenue"  value={currencyShort(total)}  sub="all recorded sales"           tone="green"/>
        <StatCard icon={TrendingUp} label="This month"     value={currencyShort(sales.filter(x=>monthKey(x.date)===monthKey(todayStr())).reduce((s,x)=>s+x.amount,0))} sub="revenue so far" tone="gold"/>
        <StatCard icon={Receipt}    label="Sale records"   value={sales.length}           sub="logged transactions"          tone="ink"/>
      </div>
      <div className="toolbar">
        <div className="search-box"><Search size={15}/><input placeholder="Description or buyer…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
          <option>All</option>{SALE_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
        <button className="btn btn--primary" onClick={onAdd}><Plus size={15}/>Record sale</button>
      </div>
      {sales.length===0 ? (
        <EmptyState icon={Banknote} title="No sales recorded" body="Record your first sale to start tracking revenue." actionLabel="Record sale" onAction={onAdd}/>
      ) : rows.length===0 ? <p className="muted">No sales match that filter.</p> : (
        <div className="table-wrap finance-table-wrap">
          <table>
            <thead><tr><th>Type</th><th>Description</th><th>Date</th><th>Animal</th><th>Qty</th><th>Unit price</th><th>Amount</th><th>Buyer</th><th/></tr></thead>
            <tbody>
              {rows.map(x=>(
                <tr key={x.id}>
                  <td data-label="Type"><Badge tone="neutral">{x.type}</Badge></td>
                  <td data-label="Description">{x.description}</td>
                  <td data-label="Date" className="mono">{formatDate(x.date)}</td>
                  <td data-label="Animal">{x.animalLabel||"-"}</td>
                  <td data-label="Qty" className="mono">{x.quantity||"-"}</td>
                  <td data-label="Unit price" className="mono">{x.unitPrice?currency(x.unitPrice):"-"}</td>
                  <td data-label="Amount" className="mono trend-up">{currency(x.amount)}</td>
                  <td data-label="Buyer">{x.buyer||"-"}</td>
                  <td data-label="" className="actions-cell"><button className="icon-btn icon-btn--danger" onClick={()=>setConfirmId(x.id)} aria-label="Delete"><Trash2 size={15}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirmId&&<ConfirmDialog title="Delete sale record" body="This permanently removes the transaction from your revenue records." onCancel={()=>setConfirmId(null)} onConfirm={()=>{onDelete(confirmId);setConfirmId(null);}}/>}
    </div>
  );
}

function ExpensesPage({ expenses, onAdd, onDelete }) {
  const [query, setQuery]         = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [confirmId, setConfirmId] = useState(null);
  const total = expenses.reduce((s,x)=>s+x.amount,0);

  const rows = expenses
    .filter(x=>{ const q=query.toLowerCase(); return (!q||x.description.toLowerCase().includes(q)||(x.vendor||"").toLowerCase().includes(q)) && (catFilter==="All"||x.category===catFilter); })
    .sort((a,b)=>a.date<b.date?1:-1);

  return (
    <div className="page">
      <div className="stat-row finance-summary-row">
        <StatCard icon={Receipt}      label="Total expenses"  value={currencyShort(total)} sub="all recorded costs"           tone="rust"/>
        <StatCard icon={TrendingDown} label="This month"      value={currencyShort(expenses.filter(x=>monthKey(x.date)===monthKey(todayStr())).reduce((s,x)=>s+x.amount,0))} sub="spent so far" tone="gold"/>
        <StatCard icon={Wallet}       label="Expense records" value={expenses.length}       sub="logged transactions"          tone="ink"/>
      </div>
      <div className="toolbar">
        <div className="search-box"><Search size={15}/><input placeholder="Description or vendor…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
          <option>All</option>{EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}
        </select>
        <button className="btn btn--primary" onClick={onAdd}><Plus size={15}/>Add expense</button>
      </div>
      {expenses.length===0 ? (
        <EmptyState icon={Receipt} title="No expenses recorded"
          body="Adding purchased animals or restocking feed automatically logs an expense here. You can also add costs by hand."
          actionLabel="Add expense" onAction={onAdd}/>
      ) : rows.length===0 ? <p className="muted">No expenses match that filter.</p> : (
        <div className="table-wrap finance-table-wrap">
          <table>
            <thead><tr><th>Category</th><th>Description</th><th>Date</th><th>Amount</th><th>Vendor</th><th>Source</th><th/></tr></thead>
            <tbody>
              {rows.map(x=>(
                <tr key={x.id}>
                  <td data-label="Category"><Badge tone="neutral">{x.category}</Badge></td>
                  <td data-label="Description">{x.description}</td>
                  <td data-label="Date" className="mono">{formatDate(x.date)}</td>
                  <td data-label="Amount" className="mono trend-down">{currency(x.amount)}</td>
                  <td data-label="Vendor">{x.vendor||"-"}</td>
                  <td data-label="Source"><span className="muted small">{x.autoLogged?"Auto-logged":"Manual"}</span></td>
                  <td data-label="" className="actions-cell"><button className="icon-btn icon-btn--danger" onClick={()=>setConfirmId(x.id)} aria-label="Delete"><Trash2 size={15}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirmId&&<ConfirmDialog title="Delete expense record" body="This permanently removes the expense record." onCancel={()=>setConfirmId(null)} onConfirm={()=>{onDelete(confirmId);setConfirmId(null);}}/>}
    </div>
  );
}

const NAV_SECTIONS = [
  { items:[{key:"dashboard",label:"Overview",icon:LayoutDashboard}] },
  { label:"Livestock", items:[
    {key:"livestock",    label:"Overview",     icon:Activity},
    {key:"animals",      label:"Animals",      icon:PawPrint},
    {key:"vaccinations", label:"Vaccinations", icon:Syringe},
    {key:"growth",       label:"Growth",       icon:TrendingUp},
    {key:"feed",         label:"Feed stock",   icon:Wheat},
  ]},
  { label:"Finance", items:[
    {key:"finances",  label:"Overview",      icon:BadgeDollarSign},
    {key:"statement", label:"Statement",     icon:FileText},
    {key:"contracts", label:"Contracts", icon:FileText},
    {key:"loans",     label:"Loans", icon:Wallet},
    {key:"sales",     label:"Sales", icon:Banknote},
    {key:"expenses",  label:"Expenses",      icon:Receipt},
  ]},
  { label:"Administration", items:[
    {key:"profile", label:"Profile", icon:Settings},
    {key:"users", label:"Users", icon:Users, adminOnly:true},
  ]},
];

// ─── App ──────────────────────────────────────────────────────────────────────
export default function FarmApp() {
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [animals, setAnimals]           = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [growthRecords, setGrowthRecords] = useState([]);
  const [healthEvents, setHealthEvents] = useState([]);
  const [feedItems, setFeedItems]       = useState([]);
  const [sales, setSales]               = useState([]);
  const [expenses, setExpenses]         = useState([]);
  const [partners, setPartners]         = useState([]);
  const [contracts, setContracts]       = useState([]);
  const [invoices, setInvoices]         = useState([]);
  const [loans, setLoans]               = useState([]);
  const [users, setUsers]               = useState([]);
  const [currentUser, setCurrentUser]   = useState(null);
  const [farm, setFarm]                 = useState(null);
  const [apiError, setApiError]         = useState("");

  // modals
  const [showAnimalForm, setShowAnimalForm] = useState(false);
  const [editingAnimalId, setEditingAnimalId] = useState(null);
  const [showVaxForm, setShowVaxForm]     = useState(false);
  const [showGrowthForm, setShowGrowthForm] = useState(false);
  const [showHealthForm, setShowHealthForm] = useState(false);
  const [showFeedForm, setShowFeedForm]   = useState(false);
  const [showSaleForm, setShowSaleForm]   = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanPaymentLoanId, setLoanPaymentLoanId] = useState(null);
  const [showAddUser, setShowAddUser]     = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [defaultAnimal, setDefaultAnimal] = useState(null);
  const [openAnimalId, setOpenAnimalId]   = useState(null);

  useEffect(()=>{
    (async()=>{
      try {
        if (api.hasToken()) {
          const user = await api.me();
          setCurrentUser(user);
          await applyBackendData(user);
        }
      } catch (err) {
        api.clearTokens();
        setApiError(err.message || "Please sign in again.");
      } finally {
        setLoading(false);
      }
    })();
  },[]);

  async function applyBackendData(user) {
    const data = await api.loadAll(user);
    setFarm(data.farm);
    setCurrentUser(current => current ? { ...current, farm: data.farm } : current);
    setAnimals(data.animals); setVaccinations(data.vaccinations); setGrowthRecords(data.growthRecords);
    setHealthEvents(data.healthEvents); setFeedItems(data.feedItems);
    setSales(data.sales); setExpenses(data.expenses); setPartners(data.partners);
    setContracts(data.contracts); setInvoices(data.invoices); setLoans(data.loans); setUsers(data.users);
  }

  async function refreshBackendData() {
    if (currentUser) await applyBackendData(currentUser);
  }

  async function runBackend(action) {
    setApiError("");
    try { return await action(); }
    catch (err) { setApiError(err.message || "Backend request failed."); throw err; }
  }

  const handleLogin=async(email,password)=>{
    setApiError("");
    const user = await api.login(email,password);
    setCurrentUser(user);
    await applyBackendData(user);
    setApiError("");
  };

  const handleRegister=async(data)=>{
    setApiError("");
    const user = await api.registerFarm(data);
    setCurrentUser(user);
    await applyBackendData(user);
    setApiError("");
  };

  const handleLogout=()=>{ api.clearTokens(); setCurrentUser(null); setFarm(null); setMobileNavOpen(false); setActiveTab("dashboard"); };

  const addAnimal=data=>runBackend(async()=>{ await api.createAnimal(data); await refreshBackendData(); setShowAnimalForm(false); });
  const editAnimal=(id,data)=>runBackend(async()=>{ await api.updateAnimal(id,data); await refreshBackendData(); setEditingAnimalId(null); });
  const deleteAnimal=id=>runBackend(async()=>{ await api.deleteAnimal(id); await refreshBackendData(); if(openAnimalId===id) setOpenAnimalId(null); });
  const addVaccination=data=>runBackend(async()=>{ await api.createVaccination(data); await refreshBackendData(); setShowVaxForm(false); });
  const deleteVaccination=id=>runBackend(async()=>{ await api.deleteVaccination(id); await refreshBackendData(); });
  const addGrowth=data=>runBackend(async()=>{ await api.createGrowthRecord(data); await refreshBackendData(); setShowGrowthForm(false); });
  const deleteGrowth=id=>runBackend(async()=>{ await api.deleteGrowthRecord(id); await refreshBackendData(); });
  const addHealthEvent=data=>runBackend(async()=>{ await api.createHealthEvent(data); await refreshBackendData(); setShowHealthForm(false); });
  const addFeed=data=>runBackend(async()=>{ await api.createFeedItem(data); await refreshBackendData(); setShowFeedForm(false); });
  const adjustFeed=(id,delta)=>runBackend(async()=>{ await api.adjustFeedItem(id, delta > 0 ? "restock" : "use", Math.abs(delta)); await refreshBackendData(); });
  const deleteFeed=id=>runBackend(async()=>{ await api.deleteFeedItem(id); await refreshBackendData(); });
  const addSale=data=>runBackend(async()=>{ await api.createSale(data); await refreshBackendData(); setShowSaleForm(false); });
  const deleteSale=id=>runBackend(async()=>{ await api.deleteSale(id); await refreshBackendData(); });
  const addExpense=data=>runBackend(async()=>{ await api.createExpense(data); await refreshBackendData(); setShowExpenseForm(false); });
  const deleteExpense=id=>runBackend(async()=>{ await api.deleteExpense(id); await refreshBackendData(); });
  const addPartner=data=>runBackend(async()=>{ await api.createPartner(data); await refreshBackendData(); setShowPartnerForm(false); });
  const deletePartner=id=>runBackend(async()=>{ await api.deletePartner(id); await refreshBackendData(); });
  const addContract=data=>runBackend(async()=>{ await api.createContract(data); await refreshBackendData(); setShowContractForm(false); });
  const deleteContract=id=>runBackend(async()=>{ await api.deleteContract(id); await refreshBackendData(); });
  const addInvoice=data=>runBackend(async()=>{ await api.createInvoice(data); await refreshBackendData(); setShowInvoiceForm(false); });
  const deleteInvoice=id=>runBackend(async()=>{ await api.deleteInvoice(id); await refreshBackendData(); });
  const addLoan=data=>runBackend(async()=>{ await api.createLoan(data); await refreshBackendData(); setShowLoanForm(false); });
  const deleteLoan=id=>runBackend(async()=>{ await api.deleteLoan(id); await refreshBackendData(); });
  const addLoanPayment=data=>runBackend(async()=>{ await api.createLoanPayment(data); await refreshBackendData(); setLoanPaymentLoanId(null); });
  const deleteLoanPayment=id=>runBackend(async()=>{ await api.deleteLoanPayment(id); await refreshBackendData(); });
  const addUser=data=>runBackend(async()=>{ await api.createUser(data); await refreshBackendData(); setShowAddUser(false); });
  const editUser=(id,update)=>runBackend(async()=>{ await api.updateUser(id,update); await refreshBackendData(); setEditingUserId(null); });
  const toggleUser=id=>runBackend(async()=>{ await api.toggleUser(id); await refreshBackendData(); });
  const deleteUser=id=>runBackend(async()=>{ await api.deleteUser(id); await refreshBackendData(); });
  const saveFarm=data=>runBackend(async()=>{
    const updated = await api.updateFarm(data);
    setFarm(updated);
    setCurrentUser(user => user ? { ...user, farm: updated } : user);
  });

  const openAnimal      = animals.find(a=>a.id===openAnimalId);
  const editingAnimal   = animals.find(a=>a.id===editingAnimalId);
  const editingUser     = users.find(u=>u.id===editingUserId);
  const visibleSections = NAV_SECTIONS.map(s=>({...s,items:s.items.filter(i=>!i.adminOnly||currentUser?.role==="Admin")})).filter(s=>s.items.length);

  function openRecordVax(animalId)  { setDefaultAnimal(animalId); setOpenAnimalId(null); setShowVaxForm(true); }
  function openLogGrowth(animalId)  { setDefaultAnimal(animalId); setOpenAnimalId(null); setShowGrowthForm(true); }
  function openLogHealth(animalId)  { setDefaultAnimal(animalId); setOpenAnimalId(null); setShowHealthForm(true); }
  function openEditAnimal(animalId) { setEditingAnimalId(animalId); setOpenAnimalId(null); }

  return (
    <div className="farm-app">
      <style>{CSS}</style>
      {loading ? (
        <div className="loading-screen"><Sprout size={22}/><span>Opening the ledger…</span></div>
      ) : !currentUser ? (
        <LoginPage onLogin={handleLogin} onRegister={handleRegister}/>
      ) : (
        <div className="app-shell">
          {mobileNavOpen && <div className="sidebar-backdrop" onClick={()=>setMobileNavOpen(false)}/>}
          <aside className={`sidebar ${mobileNavOpen?"is-open":""}`}>
            <div className="sidebar__brand">
              <span className="sidebar__brand-mark"><Sprout size={18}/></span>
              <div><div className="sidebar__brand-name">Farm Ledger</div><div className="sidebar__brand-sub">Farm management</div></div>
              <button className="icon-btn sidebar__close" onClick={()=>setMobileNavOpen(false)} aria-label="Close menu"><X size={18}/></button>
            </div>
            <nav className="sidebar__nav">
              {visibleSections.map((section,idx)=>(
                <div className="nav-section" key={section.label||`s${idx}`}>
                  {section.label&&<div className="nav-section__label">{section.label}</div>}
                  {section.items.map(item=>(
                    <button key={item.key} className={`sidebar__nav-item${activeTab===item.key?" is-active":""}`}
                      onClick={()=>{ setActiveTab(item.key); setMobileNavOpen(false); }}>
                      <item.icon size={17} strokeWidth={2}/>{item.label}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
            <div className="sidebar__footer"><span className="mono">{animals.length} animals on record</span></div>
          </aside>

          <main className="main">
            <header className="topbar">
              <div className="topbar__title-row">
                <button className="icon-btn hamburger-btn" onClick={()=>setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20}/></button>
                <h1>{PAGE_TITLES[activeTab]}</h1>
              </div>
              <div className="topbar__user">
                <span className="avatar">{initials(currentUser.name)}</span>
                <div className="topbar__user-info"><strong>{currentUser.name}</strong><span className="muted small">{currentUser.role} - {farm?.name || currentUser.farm?.name || "Farm workspace"}</span></div>
                <button className="icon-btn" onClick={handleLogout} title="Log out" aria-label="Log out"><LogOut size={17}/></button>
              </div>
            </header>
            <div className="content">
              {apiError && <div className="form-error" style={{marginBottom:16}}>{apiError}</div>}
              {activeTab==="dashboard"    && <DashboardPage animals={animals} vaccinations={vaccinations} healthEvents={healthEvents} feedItems={feedItems} sales={sales} expenses={expenses} loans={loans} invoices={invoices} onNavigate={setActiveTab}/>}
              {activeTab==="livestock"    && <LivestockOverviewPage animals={animals} vaccinations={vaccinations} growthRecords={growthRecords} healthEvents={healthEvents} feedItems={feedItems} onNavigate={setActiveTab}/>}
              {activeTab==="animals"      && <AnimalsPage animals={animals} healthEvents={healthEvents} onAdd={()=>setShowAnimalForm(true)} onDelete={deleteAnimal} onOpen={setOpenAnimalId}/>}
              {activeTab==="vaccinations" && <VaccinationsPage animals={animals} vaccinations={vaccinations} onAdd={()=>{setDefaultAnimal(null);setShowVaxForm(true);}} onDelete={deleteVaccination}/>}
              {activeTab==="growth"       && <GrowthPage animals={animals} growthRecords={growthRecords} onAdd={()=>{setDefaultAnimal(null);setShowGrowthForm(true);}} onDelete={deleteGrowth}/>}
              {activeTab==="feed"         && <FeedPage feedItems={feedItems} onAdd={()=>setShowFeedForm(true)} onAdjust={adjustFeed} onDelete={deleteFeed}/>}
              {activeTab==="finances"     && <FinancesPage sales={sales} expenses={expenses} loans={loans} onNavigate={setActiveTab}/>}
              {activeTab==="statement"    && <StatementPage animals={animals} sales={sales} expenses={expenses} loans={loans} invoices={invoices}/>}
              {activeTab==="contracts"    && <ContractsPage partners={partners} contracts={contracts} invoices={invoices} onAddPartner={()=>setShowPartnerForm(true)} onAddContract={()=>setShowContractForm(true)} onAddInvoice={()=>setShowInvoiceForm(true)} onDeletePartner={deletePartner} onDeleteContract={deleteContract} onDeleteInvoice={deleteInvoice}/>}
              {activeTab==="loans"        && <LoansPage loans={loans} onAddLoan={()=>setShowLoanForm(true)} onAddPayment={id=>setLoanPaymentLoanId(id || "")} onDeleteLoan={deleteLoan} onDeletePayment={deleteLoanPayment}/>}
              {activeTab==="sales"        && <SalesPage sales={sales} onAdd={()=>setShowSaleForm(true)} onDelete={deleteSale}/>}
              {activeTab==="expenses"     && <ExpensesPage expenses={expenses} onAdd={()=>setShowExpenseForm(true)} onDelete={deleteExpense}/>}
              {activeTab==="profile"      && <ProfilePage currentUser={currentUser} farm={farm || currentUser.farm} onSaveFarm={saveFarm}/>}
              {activeTab==="users" && currentUser.role==="Admin" && <UsersPage users={users} currentUser={currentUser} onAdd={()=>setShowAddUser(true)} onEdit={setEditingUserId} onToggleStatus={toggleUser} onDelete={deleteUser}/>}
            </div>
          </main>
        </div>
      )}

      {/* Modals */}
      {showAnimalForm    && <Modal title="Add animal" onClose={()=>setShowAnimalForm(false)}><AnimalForm onSubmit={addAnimal} onClose={()=>setShowAnimalForm(false)}/></Modal>}
      {editingAnimal     && <Modal title="Edit animal" onClose={()=>setEditingAnimalId(null)}><AnimalForm initial={editingAnimal} onSubmit={d=>editAnimal(editingAnimal.id,d)} onClose={()=>setEditingAnimalId(null)}/></Modal>}
      {showVaxForm       && <Modal title="Record vaccination" onClose={()=>setShowVaxForm(false)}><VaccinationForm animals={animals} defaultAnimalId={defaultAnimal} onSubmit={addVaccination} onClose={()=>setShowVaxForm(false)}/></Modal>}
      {showGrowthForm    && <Modal title="Log weight" onClose={()=>setShowGrowthForm(false)}><GrowthForm animals={animals} defaultAnimalId={defaultAnimal} onSubmit={addGrowth} onClose={()=>setShowGrowthForm(false)}/></Modal>}
      {showHealthForm    && <Modal title="Log health event" onClose={()=>setShowHealthForm(false)}><HealthEventForm animals={animals} defaultAnimalId={defaultAnimal} onSubmit={addHealthEvent} onClose={()=>setShowHealthForm(false)}/></Modal>}
      {showFeedForm      && <Modal title="Add feed item" onClose={()=>setShowFeedForm(false)}><FeedForm onSubmit={addFeed} onClose={()=>setShowFeedForm(false)}/></Modal>}
      {showSaleForm      && <Modal title="Record sale" onClose={()=>setShowSaleForm(false)}><SaleForm animals={animals} onSubmit={addSale} onClose={()=>setShowSaleForm(false)}/></Modal>}
      {showExpenseForm   && <Modal title="Add expense" onClose={()=>setShowExpenseForm(false)}><ExpenseForm onSubmit={addExpense} onClose={()=>setShowExpenseForm(false)}/></Modal>}
      {showPartnerForm   && <Modal title="Add trading partner" onClose={()=>setShowPartnerForm(false)}><PartnerForm onSubmit={addPartner} onClose={()=>setShowPartnerForm(false)}/></Modal>}
      {showContractForm  && <Modal title="Add contract" onClose={()=>setShowContractForm(false)} wide><ContractForm partners={partners} onSubmit={addContract} onClose={()=>setShowContractForm(false)}/></Modal>}
      {showInvoiceForm   && <Modal title="Add invoice" onClose={()=>setShowInvoiceForm(false)} wide><InvoiceForm partners={partners} contracts={contracts} onSubmit={addInvoice} onClose={()=>setShowInvoiceForm(false)}/></Modal>}
      {showLoanForm      && <Modal title="Add loan" onClose={()=>setShowLoanForm(false)} wide><LoanForm onSubmit={addLoan} onClose={()=>setShowLoanForm(false)}/></Modal>}
      {loanPaymentLoanId !== null && <Modal title="Record loan payment" onClose={()=>setLoanPaymentLoanId(null)}><LoanPaymentForm loans={loans} selectedLoanId={loanPaymentLoanId} onSubmit={addLoanPayment} onClose={()=>setLoanPaymentLoanId(null)}/></Modal>}
      {showAddUser       && <Modal title="Add user" onClose={()=>setShowAddUser(false)}><AddUserForm existingUsers={users} onSubmit={addUser} onClose={()=>setShowAddUser(false)}/></Modal>}
      {editingUser       && <Modal title="Edit user" onClose={()=>setEditingUserId(null)}><EditUserForm user={editingUser} existingUsers={users} onSubmit={u=>editUser(editingUser.id,u)} onClose={()=>setEditingUserId(null)}/></Modal>}
      {openAnimal        && <AnimalDrawer animal={openAnimal} vaccinations={vaccinations} growthRecords={growthRecords} healthEvents={healthEvents} onClose={()=>setOpenAnimalId(null)} onRecordVax={openRecordVax} onLogGrowth={openLogGrowth} onLogHealth={openLogHealth} onEditAnimal={openEditAnimal}/>}
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
.farm-app {
  --cream:   #FAF6EC; --paper: #FFFDF8; --ink: #2A2419; --muted: #8A7B62;
  --line:    #E4DCC8; --green: #2F4538; --green-soft: #3F5D45;
  --rust:    #A23B2E; --gold: #D9A441; --danger: #A23B2E; --warning: #B6831C;
  font-family: 'Inter', sans-serif; color: var(--ink); background: var(--cream); min-height: 100vh;
}
.farm-app * { box-sizing: border-box; }
.mono  { font-family: 'JetBrains Mono', monospace; }
.muted { color: var(--muted); }
.small { font-size: 12.5px; }
.spacer { flex: 1; }
.trend-up   { color: var(--green-soft); display:inline-flex;align-items:center;gap:2px; }
.trend-down { color: var(--rust);       display:inline-flex;align-items:center;gap:2px; }

/* Loading */
.loading-screen { display:flex;align-items:center;gap:10px;justify-content:center;height:100vh;color:var(--green);font-family:'Zilla Slab',serif;font-size:18px; }

/* Shell */
.app-shell { display:flex; min-height:100vh; }

/* Sidebar */
.sidebar { width:216px;background:var(--green);color:#EFE8D6;flex-shrink:0;display:flex;flex-direction:column;padding:22px 14px; }
.sidebar__brand { display:flex;align-items:center;gap:10px;padding:0 8px 20px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:16px;position:relative; }
.sidebar__brand-mark { background:var(--gold);color:var(--green);width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.sidebar__brand-name { font-family:'Zilla Slab',serif;font-weight:700;font-size:16px; }
.sidebar__brand-sub  { font-size:11px;color:#B9C2B4;text-transform:uppercase;letter-spacing:.06em; }
.sidebar__nav { display:flex;flex-direction:column;gap:14px;flex:1;overflow-y:auto; }
.nav-section { display:flex;flex-direction:column;gap:3px; }
.nav-section__label { font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#92A18C;padding:0 12px;margin-bottom:2px; }
.sidebar__nav-item { display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;border:none;background:transparent;color:#DCE3D6;font-size:14px;font-weight:500;cursor:pointer;text-align:left;font-family:'Inter',sans-serif;transition:background .12s; }
.sidebar__nav-item:hover { background:rgba(255,255,255,.07); }
.sidebar__nav-item.is-active { background:var(--gold);color:var(--green);font-weight:600; }
.sidebar__footer { padding:10px 8px 0;border-top:1px solid rgba(255,255,255,.12);font-size:11.5px;color:#B9C2B4; }
.hamburger-btn { display:none; }
.sidebar__close { display:none; }
.sidebar-backdrop { display:none; }

/* Topbar */
.main { flex:1;display:flex;flex-direction:column;min-width:0; }
.topbar { padding:22px 32px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:16px; }
.topbar__title-row { display:flex;align-items:center;gap:10px;flex:1;min-width:0; }
.topbar h1 { font-family:'Zilla Slab',serif;font-size:26px;font-weight:700;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.topbar__user { display:flex;align-items:center;gap:9px;background:var(--paper);border:1px solid var(--line);border-radius:99px;padding:6px 8px 6px 6px;flex-shrink:0; }
.topbar__user-info { display:flex;flex-direction:column;line-height:1.25;font-size:12.5px; }
.content { padding:18px 32px 40px;flex:1; }
.page { display:flex;flex-direction:column;gap:20px; }

/* Avatar */
.avatar { width:28px;height:28px;border-radius:50%;background:var(--green);color:#EFE8D6;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'JetBrains Mono',monospace; }
.user-cell { display:flex;align-items:center;gap:9px; }

/* Ear tag */
.ear-tag { display:inline-flex;align-items:center;gap:5px;background:var(--rust);color:#FBEFE6;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500;padding:3px 9px 3px 6px;border-radius:4px 10px 10px 4px;white-space:nowrap; }
.ear-tag__hole { width:5px;height:5px;border-radius:50%;background:#FBEFE6;opacity:.55;flex-shrink:0; }
.ear-tag--lg { font-size:15px;padding:5px 12px 5px 8px; }

/* Badge */
.badge { display:inline-flex;align-items:center;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:99px;white-space:nowrap; }
.badge--success { background:#E4ECE2;color:var(--green-soft); }
.badge--warning { background:#F7EAC9;color:#8C6315; }
.badge--danger  { background:#F4DCD6;color:var(--rust); }
.badge--neutral { background:#ECE7D8;color:var(--muted); }

/* Stat cards */
.stat-row { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px; }
.stat-card { background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:16px; }
.stat-card__icon { width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:10px; }
.stat-card--green .stat-card__icon { background:#E4ECE2;color:var(--green-soft); }
.stat-card--rust  .stat-card__icon { background:#F4E2DC;color:var(--rust); }
.stat-card--gold  .stat-card__icon { background:#F7EBD2;color:#B6831C; }
.stat-card--ink   .stat-card__icon { background:#ECE7D8;color:var(--ink); }
.stat-card__value { font-family:'Zilla Slab',serif;font-size:28px;font-weight:700;line-height:1; }
.stat-card__label { font-size:12.5px;color:var(--muted);margin-top:4px; }
.stat-card__sub   { font-size:11px;color:var(--muted);margin-top:2px; }

/* Dashboard grid */
.dash-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
.panel { background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px; }
.panel__head { display:flex;align-items:center;justify-content:space-between;margin-bottom:12px; }
.panel__head h3 { font-family:'Zilla Slab',serif;font-size:15.5px;font-weight:600;margin:0;display:flex;align-items:center;gap:6px; }
.link-btn { background:none;border:none;color:var(--rust);font-size:12.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:2px; }
.composition { display:flex;align-items:center;gap:18px; }
.legend-list { list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px;flex:1; }
.legend-list li { display:flex;align-items:center;gap:7px;font-size:13px; }
.legend-dot { width:9px;height:9px;border-radius:50%;flex-shrink:0; }
.list-rows { list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px; }
.list-rows li { display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;padding-bottom:9px;border-bottom:1px solid var(--line); }
.list-rows li:last-child { border-bottom:none;padding-bottom:0; }
.action-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px; }
.action-card { position:relative;text-align:left;border:1px solid var(--line);background:var(--cream);border-radius:10px;padding:12px 34px 12px 12px;display:flex;flex-direction:column;gap:8px;cursor:pointer;color:var(--ink);font-family:'Inter',sans-serif; }
.action-card:hover { background:#F3EDDD;border-color:#D8C9A7; }
.action-card strong { font-size:12.5px;line-height:1.35;font-weight:600; }
.action-card svg { position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--muted); }
.success-callout { display:flex;align-items:flex-start;gap:10px;background:#E4ECE2;border:1px solid #CFDDCB;border-radius:10px;padding:13px 14px;color:var(--green-soft); }
.success-callout p { margin:3px 0 0;color:var(--muted);font-size:12.5px;line-height:1.45; }

/* Statement */
.statement-hero { display:flex;justify-content:space-between;align-items:flex-start;gap:18px;background:var(--green);color:#EFE8D6;border-radius:12px;padding:18px 20px; }
.statement-hero h2 { font-family:'Zilla Slab',serif;font-size:25px;line-height:1.05;margin:3px 0 6px; }
.statement-hero p { max-width:720px;margin:0;color:#CAD4C5;font-size:13px;line-height:1.5; }
.statement-hero__eyebrow { display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:#D9A441;font-weight:800; }
.statement-hero .btn { background:#EFE8D6;color:var(--green);border-color:transparent;flex-shrink:0; }

/* Tables */
.toolbar { display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
.search-box { display:flex;align-items:center;gap:7px;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:7px 11px;flex:1;max-width:320px;color:var(--muted); }
.search-box input { border:none;outline:none;background:transparent;font-size:13.5px;flex:1;color:var(--ink);font-family:'Inter',sans-serif; }
.toolbar select { border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:13px;background:var(--paper);color:var(--ink);font-family:'Inter',sans-serif; }
.segmented-tabs { display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--paper); }
.segmented-tabs button { border:0;border-right:1px solid var(--line);background:transparent;color:var(--muted);font:600 12px 'Inter',sans-serif;padding:8px 12px;cursor:pointer; }
.segmented-tabs button:last-child { border-right:0; }
.segmented-tabs button.is-active { background:var(--green);color:#fff; }
.invoice-items-editor { border:1px solid var(--line);border-radius:8px;background:var(--paper);padding:10px; }
.invoice-items-editor__head,.invoice-total { display:flex;align-items:center;justify-content:space-between;gap:10px; }
.invoice-item-row { display:grid;grid-template-columns:minmax(180px,1.7fr) minmax(72px,.55fr) minmax(70px,.5fr) minmax(100px,.7fr) minmax(88px,.6fr) 34px;gap:8px;align-items:center;margin-top:8px; }
.invoice-item-row input { width:100%;border:1px solid var(--line);border-radius:7px;padding:7px 8px;font:13px 'Inter',sans-serif;background:#fff;color:var(--ink); }
.invoice-total { border-top:1px solid var(--line);margin-top:10px;padding-top:10px; }
.table-wrap { background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:auto;-webkit-overflow-scrolling:touch;box-shadow:inset 0 -1px 0 rgba(70,60,40,.03); }
.table-wrap table { min-width:720px; }
table { width:100%;border-collapse:collapse;font-size:13px; }
th { text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600;padding:11px 14px;border-bottom:1px solid var(--line);white-space:nowrap; }
.table-wrap th { position:sticky;top:0;z-index:1;background:var(--paper); }
td { padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:middle; }
tr:last-child td { border-bottom:none; }
tr.clickable { cursor:pointer; }
tr.clickable:hover { background:#F3EDDD; }
.table-primary { display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px; }
.actions-cell { display:flex;gap:6px;align-items:center;justify-content:flex-end;white-space:nowrap; }
.mini-table { width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px; }
.mini-table th { text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600;padding:6px 0;border-bottom:1px solid var(--line); }
.mini-table td { padding:7px 0;border-bottom:1px solid var(--line); }
.mini-table tr:last-child td { border-bottom:none; }

/* Buttons */
.btn { display:inline-flex;align-items:center;gap:6px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;border:1px solid transparent;cursor:pointer; }
.btn--primary { background:var(--rust);color:#fff; }
.btn--primary:hover { background:#8C3225; }
.btn--ghost   { background:transparent;border-color:var(--line);color:var(--ink); }
.btn--ghost:hover { background:#F1EBDB; }
.btn--danger  { background:var(--rust);color:#fff; }
.btn--sm      { font-size:12px;padding:6px 10px; }
.btn--tiny    { font-size:11.5px;padding:5px 9px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:6px; }
.btn--tiny:hover { background:#F1EBDB; }
.btn:disabled,.icon-btn:disabled { opacity:.45;cursor:not-allowed; }
.icon-btn { background:none;border:none;cursor:pointer;color:var(--muted);padding:5px;border-radius:6px;display:inline-flex; }
.icon-btn:hover { background:#F1EBDB; }
.icon-btn--danger:hover { color:var(--rust);background:#F4DCD6; }

/* Empty state */
.empty-state { background:var(--paper);border:1px dashed var(--line);border-radius:14px;padding:48px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--green-soft); }
.empty-state h3 { font-family:'Zilla Slab',serif;font-size:17px;margin:4px 0 0;color:var(--ink); }
.empty-state p  { font-size:13px;color:var(--muted);max-width:360px;margin:0 0 6px; }

/* Modal */
.modal-overlay { position:fixed;inset:0;background:rgba(42,36,25,.45);display:flex;align-items:center;justify-content:center;z-index:50;padding:20px; }
.modal-card { background:var(--paper);border-radius:14px;width:100%;max-width:480px;max-height:88vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.25); }
.modal-card--wide { max-width:600px; }
.modal-card__header { display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line); }
.modal-card__header h2 { font-family:'Zilla Slab',serif;font-size:17px;margin:0; }
.modal-card__body { padding:18px 20px 20px; }
.confirm-body { font-size:13.5px;color:var(--muted);line-height:1.5;margin:0 0 6px; }

/* Forms */
.form-grid { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px 14px;min-width:0; }
.form-grid label { display:flex;flex-direction:column;gap:5px;min-width:0;font-size:12.5px;font-weight:600;color:var(--muted); }
.form-grid .span-2 { grid-column:span 2; }
.form-grid input,.form-grid select,.form-grid textarea { width:100%;min-width:0;box-sizing:border-box;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:13.5px;font-family:'Inter',sans-serif;color:var(--ink);background:var(--cream);outline:none; }
.form-grid input:focus,.form-grid select:focus,.form-grid textarea:focus { border-color:var(--rust); }
.form-grid input:disabled { opacity:.5;cursor:not-allowed; }
.form-grid textarea { resize:vertical; }
.form-actions { display:flex;justify-content:flex-end;gap:8px;margin-top:18px; }
.form-error { background:#F4DCD6;color:var(--rust);font-size:12.5px;font-weight:600;padding:8px 10px;border-radius:7px;margin-top:10px; }
.form-success { background:#E4ECE2;color:var(--green-soft);font-size:12.5px;font-weight:600;padding:8px 10px;border-radius:7px;margin-top:10px; }

/* Profile */
.profile-grid { display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:14px;align-items:start; }
.profile-actions { display:flex;justify-content:flex-end;margin-top:16px; }
.profile-note { margin:12px 0 0; }
.profile-summary { display:grid;gap:12px; }
.profile-summary div { display:flex;flex-direction:column;gap:3px;padding-bottom:10px;border-bottom:1px solid var(--line); }
.profile-summary div:last-child { border-bottom:none;padding-bottom:0; }
.profile-summary strong { font-size:13.5px; }

/* Login */
.login-screen { min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--green);padding:24px; }
.login-card { background:var(--paper);border-radius:16px;padding:30px 28px;width:100%;max-width:380px;box-sizing:border-box;box-shadow:0 24px 60px rgba(0,0,0,.3); }
.login-card--wide { max-width:520px; }
.login-brand { display:flex;align-items:center;gap:10px;margin-bottom:22px; }
.login-hint  { margin-top:14px;line-height:1.5; }
.auth-switch { display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#EFE6D1;border:1px solid var(--line);border-radius:10px;padding:4px;margin-bottom:16px; }
.auth-switch button { border:0;border-radius:7px;background:transparent;color:var(--muted);font-weight:800;font-size:13px;padding:8px 10px;cursor:pointer; }
.auth-switch button.active { background:var(--paper);color:var(--ink);box-shadow:0 1px 4px rgba(0,0,0,.08); }
.auth-form-grid { grid-template-columns:minmax(0,1fr); }
.auth-form-grid--register { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }

/* Drawer */
.drawer-overlay { position:fixed;inset:0;background:rgba(42,36,25,.45);display:flex;justify-content:flex-end;z-index:60; }
.drawer { background:var(--paper);width:100%;max-width:480px;height:100%;overflow-y:auto;padding:0 0 40px;box-shadow:-10px 0 30px rgba(0,0,0,.18);display:flex;flex-direction:column; }
.drawer__header { display:flex;align-items:flex-start;justify-content:space-between;padding:22px 22px 0;margin-bottom:14px; }
.drawer__header h2 { font-family:'Zilla Slab',serif;font-size:21px;margin:4px 0 2px; }
.drawer__header-actions { display:flex;align-items:center;gap:6px;flex-shrink:0; }
.drawer__quick-stats { display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:var(--cream);border-radius:10px;margin:0 22px 16px;padding:14px; }
.drawer__quick-stats > div { display:flex;flex-direction:column;gap:3px; }
.drawer__quick-stats .muted { font-size:10.5px;text-transform:uppercase;letter-spacing:.04em; }
.drawer__quick-stats strong { font-size:13px; }
.drawer__tabs { display:flex;border-bottom:2px solid var(--line);margin:0 22px;gap:2px; }
.drawer__tab { background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;padding:9px 12px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;white-space:nowrap;font-family:'Inter',sans-serif; }
.drawer__tab.is-active { color:var(--rust);border-bottom-color:var(--rust); }
.drawer__tab-body { padding:16px 22px 0;display:flex;flex-direction:column;gap:14px; }
.section-head { display:flex;align-items:center;justify-content:space-between; }
.drawer__quick-actions { display:flex;gap:8px;flex-wrap:wrap; }
.overview-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
.overview-grid__item { background:var(--cream);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:3px; }
.info-block { display:flex;align-items:flex-start;gap:8px;background:#F7EAC9;border-radius:8px;padding:10px 12px;color:#6B4A10; }
.info-block p { margin:0;font-size:13px;line-height:1.5; }

/* Health / vax event cards */
.event-card { background:var(--cream);border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px; }
.event-card--resolved { opacity:.7; }
.event-card__top { display:flex;align-items:flex-start;justify-content:space-between;gap:10px; }
.event-card__top strong { font-size:13.5px;line-height:1.3; }
.event-card__meta { display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:var(--muted); }
.event-card__notes { margin:0;font-size:12.5px;color:var(--muted);border-top:1px solid var(--line);padding-top:6px; }

/* Finance dashboard strip (on Overview page) */
.fin-dash-strip { display:flex;align-items:center;gap:16px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:14px 18px;cursor:pointer;transition:background .12s; }
.fin-dash-strip:hover { background:#F3EDDD; }
.fin-dash-strip__kpis { display:flex;align-items:center;gap:24px;flex:1;flex-wrap:wrap; }
.fin-dash-strip__kpis > div { display:flex;flex-direction:column;gap:2px; }
.fin-dash-strip__kpis strong { font-size:15px; }
.fin-dash-strip__kpis .muted { font-size:11px;text-transform:uppercase;letter-spacing:.04em; }
.fin-dash-strip__divider { width:1px;height:30px;background:var(--line);flex-shrink:0; }

/* Finance pages */
.fin-stats { grid-template-columns:repeat(4,minmax(0,1fr)); }
.finance-summary-row { grid-template-columns:repeat(3,minmax(0,1fr)); }
.fin-month-strip { display:flex;align-items:center;gap:20px;background:var(--green);color:#EFE8D6;border-radius:12px;padding:14px 20px;flex-wrap:wrap; }
.fin-month-strip__label { font-family:'Zilla Slab',serif;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.05em;opacity:.7;white-space:nowrap; }
.fin-month-strip__kpis { display:flex;gap:28px;flex:1;flex-wrap:wrap; }
.fin-month-strip__kpis > div { display:flex;flex-direction:column;gap:3px; }
.fin-month-strip__kpis .muted { font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#B9C2B4; }
.fin-month-strip__kpis strong { font-size:16px; }
.fin-month-strip .trend-up   { color:#8FD5A6; }
.fin-month-strip .trend-down { color:#F4A99A; }
.panel--wide { grid-column:span 2; }

/* Responsive — Mobile drawer nav */
@media (max-width:860px) {
  .sidebar-backdrop { display:block;position:fixed;inset:0;background:rgba(20,18,12,.5);z-index:90; }
  .sidebar { position:fixed;top:0;left:0;height:100dvh;width:min(80vw,300px);z-index:100;transform:translateX(-100%);transition:transform .25s ease;box-shadow:10px 0 30px rgba(0,0,0,.3);padding:18px 14px; }
  .sidebar.is-open { transform:translateX(0); }
  .sidebar__close { display:inline-flex;position:absolute;right:-4px;top:-4px;color:#EFE8D6; }
  .sidebar__close:hover { background:rgba(255,255,255,.1); }
  .hamburger-btn { display:inline-flex;margin:-4px 0 -4px -6px; }
  .topbar { flex-wrap:nowrap;align-items:center;gap:10px;padding:16px 16px 0; }
  .topbar h1 { font-size:19px; }
  .topbar__user-info { display:none; }
  .topbar__user { padding:4px;gap:4px; }
  .content { padding:16px 16px 40px; }
  .stat-row { grid-template-columns:1fr 1fr; }
  .dash-grid { grid-template-columns:1fr; }
  .action-grid { grid-template-columns:1fr; }
  .profile-grid { grid-template-columns:1fr; }
  .panel--wide { grid-column:span 1; }
  .fin-stats { grid-template-columns:1fr 1fr; }
  .finance-summary-row { grid-template-columns:1fr 1fr; }
  .fin-dash-strip { flex-wrap:wrap; gap:12px; }
  .fin-dash-strip__kpis { gap:14px; }
  .fin-dash-strip__divider { display:none; }
  .fin-month-strip { gap:12px; }
  .fin-month-strip__kpis { gap:16px; }
  .finance-table-wrap table,.responsive-table-wrap table { min-width:640px; }
  .form-grid { grid-template-columns:1fr; }
  .form-grid .span-2 { grid-column:span 1; }
  .drawer { max-width:100%; }
  .drawer__quick-stats { grid-template-columns:1fr 1fr; }
  .form-grid input,.form-grid select,.form-grid textarea,.search-box input,.toolbar select,.login-card input { font-size:16px; }
  .btn,.btn--tiny { min-height:36px; }
  .icon-btn { padding:8px; }
  .composition { flex-direction:column;align-items:flex-start; }
  .statement-hero { flex-direction:column;align-items:stretch; }
  .statement-hero .btn { justify-content:center; }
}

@media (max-width:480px) {
  .stat-row { grid-template-columns:1fr; }
  .fin-stats,.finance-summary-row { grid-template-columns:1fr; }
  .topbar h1 { font-size:17px; }
  .login-card { padding:24px 18px; }
  .search-box { max-width:none;width:100%; }
  .toolbar { align-items:stretch; }
  .toolbar .search-box { flex-basis:100%; }
  .toolbar .btn { justify-content:center; }
  .toolbar select { flex:1; }
  .segmented-tabs { width:100%; }
  .segmented-tabs button { flex:1;min-width:0; }
  .modal-overlay { padding:0;align-items:flex-end; }
  .modal-card { max-width:100%;max-height:92dvh;border-radius:16px 16px 0 0; }
  .drawer__quick-stats { grid-template-columns:1fr 1fr; }
  .overview-grid { grid-template-columns:1fr; }
  .drawer__tabs { overflow-x:auto;-webkit-overflow-scrolling:touch; }
  .fin-month-strip { align-items:stretch; }
  .fin-month-strip__kpis { display:grid;grid-template-columns:1fr;gap:12px; }
  .fin-dash-strip { align-items:stretch; }
  .fin-dash-strip__kpis { display:grid;grid-template-columns:1fr;gap:10px;width:100%; }
  .finance-table-wrap,.responsive-table-wrap { background:transparent;border:0;box-shadow:none;overflow:visible; }
  .finance-table-wrap table,.finance-table-wrap tbody,.finance-table-wrap tr,.finance-table-wrap td,
  .responsive-table-wrap table,.responsive-table-wrap tbody,.responsive-table-wrap tr,.responsive-table-wrap td { display:block;width:100%;min-width:0; }
  .finance-table-wrap thead,.responsive-table-wrap thead { display:none; }
  .finance-table-wrap tr,.responsive-table-wrap tr { margin-bottom:12px;border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:8px 10px;box-shadow:0 8px 22px rgba(42,36,25,.05); }
  .finance-table-wrap td,.responsive-table-wrap td { display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid var(--line);padding:9px 0;text-align:right; }
  .finance-table-wrap td:last-child,.responsive-table-wrap td:last-child { border-bottom:0; }
  .finance-table-wrap td::before,.responsive-table-wrap td::before { content:attr(data-label);color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;text-align:left; }
  .finance-table-wrap td[data-label=""]::before,.responsive-table-wrap td[data-label=""]::before { content:""; }
  .finance-table-wrap .actions-cell,.responsive-table-wrap .actions-cell { justify-content:flex-end;flex-wrap:wrap; }
  .finance-table-wrap .badge,.responsive-table-wrap .badge { margin-left:auto; }
  .responsive-table-wrap .table-primary { justify-content:flex-end;text-align:right; }
}

@media print {
  .sidebar,.topbar,.no-print,.link-btn,.btn,.icon-btn,.form-error { display:none!important; }
  .farm-app,.app-shell,.main,.content,.page { display:block;background:#fff;color:#111;padding:0;margin:0; }
  .content { padding:0!important; }
  .statement-hero { background:#fff;color:#111;border:1px solid #ccc;border-radius:0;margin-bottom:14px; }
  .statement-hero p,.statement-hero__eyebrow,.muted { color:#444!important; }
  .stat-row,.dash-grid { break-inside:avoid;page-break-inside:avoid; }
  .panel,.stat-card,.table-wrap { border-color:#ccc;box-shadow:none;break-inside:avoid;page-break-inside:avoid; }
  .table-wrap { overflow:visible; }
  .table-wrap table { min-width:0; }
  th { color:#333; }
}
`;
