import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, PawPrint, Syringe, TrendingUp, Wheat,
  Plus, X, Menu, Search, Trash2, CheckCircle2, ArrowUp, ArrowDown,
  Package, ChevronRight, Sprout, Users, UserPlus, LogOut, Ban,
  Pencil, Lock, AlertTriangle, Activity, Heart, FileText,
  ChevronDown, ChevronUp, Filter,
  Banknote, Receipt, TrendingDown, Wallet, BadgeDollarSign,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

// ─── Constants ───────────────────────────────────────────────────────────────
const SPECIES      = ["Cattle","Goat","Sheep","Pig","Chicken","Horse","Other"];
const SEX_OPTIONS  = ["Female","Male"];
const STATUS_OPTIONS = ["Healthy","Sick","Pregnant","Quarantine","Sold","Deceased"];
const ORIGIN_OPTIONS = ["Born in herd","Purchased"];
const ROLE_OPTIONS = ["Admin","Manager","Worker"];
const HEALTH_EVENT_TYPES = ["Observation","Treatment","Injury","Illness","Recovery","Other"];
const SALE_TYPES     = ["Animal sale","Milk / dairy","Eggs","Wool / hide","Other produce","Other"];
const EXPENSE_CATS   = ["Animal purchase","Feed purchase","Veterinary","Medication","Labor","Equipment","Transport","Utilities","Other"];
const PIE_COLORS     = ["#A23B2E","#D9A441","#3F5D45","#8A7B62","#6C4F3D","#C97B53","#5B7A8C"];
const BAR_REVENUE    = "#3F5D45";
const BAR_EXPENSE    = "#A23B2E";

const STORAGE_KEYS = {
  animals:      "farm_animals",
  vaccinations: "farm_vaccinations",
  growth:       "farm_growth",
  feed:         "farm_feed",
  health:       "farm_health_events",
  sales:        "farm_sales",
  expenses:     "farm_expenses",
  users:        "farm_users",
  session:      "farm_session_v2",
};

const PAGE_TITLES = {
  dashboard:    "Farm Overview",
  animals:      "Livestock Register",
  vaccinations: "Vaccination Records",
  growth:       "Growth Tracking",
  feed:         "Feed Inventory",
  finances:     "Finances",
  sales:        "Sales & Revenue",
  expenses:     "Expenses",
  users:        "User Management",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);

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

function statusTone(s) {
  if (s === "Healthy")   return "success";
  if (s === "Sick" || s === "Deceased") return "danger";
  if (s === "Pregnant")  return "warning";
  if (s === "Quarantine") return "warning";
  return "neutral";
}

function initials(name) {
  const p = (name||"").trim().split(/\s+/);
  return ((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase();
}

function findUserByEmail(users, email) {
  return users.find(u => u.email.toLowerCase() === (email||"").trim().toLowerCase());
}

async function loadKey(key, setter) {
  try {
    const r = await window.storage.get(key, false);
    if (r?.value) setter(JSON.parse(r.value));
  } catch(e) {}
}

async function persist(key, value) {
  try { await window.storage.set(key, JSON.stringify(value), false); } catch(e) {}
}

async function deleteKey(key) {
  try { await window.storage.delete(key, false); } catch(e) {}
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
    origin:ORIGIN_OPTIONS[0], purchaseCost:"", notes:"",
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
          ? <label>Purchase cost *<input type="number" min="0" step="0.01" value={form.purchaseCost} onChange={set("purchaseCost")} placeholder="e.g. 15000" required/></label>
          : <label>Purchase cost<input value="0 — born in herd" disabled/></label>
        }
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
  const [form, setForm] = useState({ name:"", email:"", password:"", role:"Worker" });
  const [error, setError] = useState("");
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  return (
    <form onSubmit={e=>{e.preventDefault();setError("");if(!form.name.trim()||!form.email.trim()||!form.password.trim())return;if(findUserByEmail(existingUsers,form.email)){setError("A user with that email already exists.");return;}onSubmit(form);}}>
      <div className="form-grid">
        <label className="span-2">Full name *<input value={form.name} onChange={set("name")} placeholder="e.g. Asha Kimani" required/></label>
        <label className="span-2">Email *<input type="email" value={form.email} onChange={set("email")} placeholder="e.g. asha@farm.local" required/></label>
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
  const [form, setForm] = useState({ name:user.name, email:user.email, role:user.role, password:"" });
  const [error, setError] = useState("");
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  return (
    <form onSubmit={e=>{e.preventDefault();setError("");const clash=findUserByEmail(existingUsers,form.email);if(clash&&clash.id!==user.id){setError("Another user already uses that email.");return;}const update={name:form.name,email:form.email,role:form.role};if(form.password.trim())update.password=form.password.trim();onSubmit(update);}}>
      <div className="form-grid">
        <label className="span-2">Full name *<input value={form.name} onChange={set("name")} required/></label>
        <label className="span-2">Email *<input type="email" value={form.email} onChange={set("email")} required/></label>
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
function DashboardPage({ animals, vaccinations, growthRecords, healthEvents, feedItems, sales, expenses, onSeed, onNavigate }) {
  const total     = animals.length;
  const healthy   = animals.filter(a=>a.status==="Healthy").length;
  const sick      = animals.filter(a=>a.status==="Sick").length;
  const pregnant  = animals.filter(a=>a.status==="Pregnant").length;
  const dueSoon   = vaccinations.filter(v=>{ const s=getVaxStatus(v.nextDue); return s.tone==="warning"||s.tone==="danger"; }).length;
  const lowFeedCt = feedItems.filter(f=>getFeedStatus(f).tone!=="success").length;
  const openHealth= healthEvents.filter(h=>!h.resolved).length;

  const totalRevenue  = (sales||[]).reduce((s,x)=>s+x.amount,0);
  const totalExpenses = (expenses||[]).reduce((s,x)=>s+x.amount,0);
  const netProfit     = totalRevenue - totalExpenses;
  const thisMonthKey  = monthKey(todayStr());
  const monthRev      = (sales||[]).filter(x=>monthKey(x.date)===thisMonthKey).reduce((s,x)=>s+x.amount,0);
  const monthExp      = (expenses||[]).filter(x=>monthKey(x.date)===thisMonthKey).reduce((s,x)=>s+x.amount,0);

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
      body="Start by adding your livestock, or load a sample farm to explore the dashboard."
      actionLabel="Load sample data" onAction={onSeed}/>
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

      {/* Finance summary strip */}
      <div className="fin-dash-strip" onClick={()=>onNavigate("finances")} role="button" tabIndex={0} onKeyDown={e=>e.key==="Enter"&&onNavigate("finances")}>
        <div className="fin-dash-strip__title"><BadgeDollarSign size={15}/>Farm finances <span className="muted small">— click for full report</span></div>
        <div className="fin-dash-strip__kpis">
          <div><span className="muted small">Total revenue</span><strong className="trend-up mono">{currency(totalRevenue)}</strong></div>
          <div><span className="muted small">Total expenses</span><strong className="trend-down mono">{currency(totalExpenses)}</strong></div>
          <div className="fin-dash-strip__divider"/>
          <div><span className="muted small">Net profit / loss</span><strong className={`mono ${netProfit>=0?"trend-up":"trend-down"}`}>{netProfit>=0?"+":"-"}{currency(Math.abs(netProfit))}</strong></div>
          <div><span className="muted small">This month</span><strong className={`mono ${(monthRev-monthExp)>=0?"trend-up":"trend-down"}`}>{(monthRev-monthExp)>=0?"+":"-"}{currency(Math.abs(monthRev-monthExp))}</strong></div>
        </div>
        <ChevronRight size={16} style={{color:"var(--muted)",flexShrink:0}}/>
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

function AnimalsPage({ animals, vaccinations, growthRecords, healthEvents, onAdd, onDelete, onOpen }) {
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ear tag</th><th>Name</th><th>Species</th><th>Breed</th>
                <th>Sex</th><th>Age</th><th>Status</th><th>Weight</th>
                <th>Origin</th><th>Location</th><th>Issues</th><th/>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a=>(
                <tr key={a.id} className="clickable" onClick={()=>onOpen(a.id)}>
                  <td><EarTag>{a.tagId}</EarTag></td>
                  <td>{a.name||"—"}</td>
                  <td>{a.species}</td>
                  <td>{a.breed||"—"}</td>
                  <td>{a.sex}</td>
                  <td className="mono">{calcAge(a.dob)}</td>
                  <td><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
                  <td className="mono">{a.weightKg?`${a.weightKg} kg`:"—"}</td>
                  <td><Badge tone={a.origin==="Purchased"?"warning":"neutral"}>{a.origin||"—"}</Badge></td>
                  <td>{a.location||"—"}</td>
                  <td>{openHealth(a.id)>0?<Badge tone="danger">{openHealth(a.id)}</Badge>:"—"}</td>
                  <td className="actions-cell">
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
        <div className="table-wrap">
          <table>
            <thead><tr><th>Animal</th><th>Vaccine</th><th>Administered</th><th>Next due</th><th>Status</th><th>By</th><th>Batch</th><th>Notes</th><th/></tr></thead>
            <tbody>
              {rows.map(v=>(
                <tr key={v.id}>
                  <td>{v.animal?<><EarTag>{v.animal.tagId}</EarTag> {v.animal.name}</>:<span className="muted">Removed</span>}</td>
                  <td>{v.vaccine}</td>
                  <td className="mono">{formatDate(v.dateGiven)}</td>
                  <td className="mono">{formatDate(v.nextDue)}</td>
                  <td><Badge tone={v.st.tone}>{v.st.label}</Badge></td>
                  <td>{v.administeredBy||"—"}</td>
                  <td className="mono">{v.batchNo||"—"}</td>
                  <td className="muted">{v.notes||"—"}</td>
                  <td className="actions-cell"><button className="icon-btn icon-btn--danger" onClick={()=>setConfirmId(v.id)} aria-label="Delete"><Trash2 size={15}/></button></td>
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
  const [selectedId, setSelectedId] = useState(animals[0]?.id||"");
  const [confirmId, setConfirmId]   = useState(null);
  useEffect(()=>{ if(!selectedId&&animals[0]) setSelectedId(animals[0].id); },[animals,selectedId]);

  const records = growthRecords.filter(g=>g.animalId===selectedId).sort((a,b)=>a.date<b.date?-1:1);
  const chartData = records.map(g=>({label:formatDate(g.date),weight:g.weightKg}));
  const animal    = animals.find(a=>a.id===selectedId);

  let withGain=[]; let prev=null;
  [...records].reverse().forEach(g=>{ withGain.push({...g,gain:prev!==null?Math.round((g.weightKg-prev)*10)/10:null}); prev=g.weightKg; });

  return (
    <div className="page">
      <div className="toolbar">
        <select value={selectedId} onChange={e=>setSelectedId(e.target.value)} disabled={!animals.length}>
          {!animals.length&&<option>No animals yet</option>}
          {animals.map(a=><option key={a.id} value={a.id}>{a.tagId}{a.name?` — ${a.name}`:""}</option>)}
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
        <div className="table-wrap">
          <table>
            <thead><tr><th>Feed type</th><th>In stock</th><th>Reorder level</th><th>Status</th><th>Cost / kg</th><th>Supplier</th><th>Last restocked</th><th/></tr></thead>
            <tbody>
              {feedItems.map(f=>{
                const st=getFeedStatus(f);
                return (
                  <tr key={f.id}>
                    <td><Package size={14} style={{marginRight:6,verticalAlign:-2,color:"#8A7B62"}}/>{f.feedType}</td>
                    <td className="mono">{f.quantityKg} kg</td>
                    <td className="mono">{f.reorderLevel} kg</td>
                    <td><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className="mono">{f.costPerKg?f.costPerKg.toFixed(2):"—"}</td>
                    <td>{f.supplier||"—"}</td>
                    <td className="mono">{formatDate(f.lastRestocked)}</td>
                    <td className="actions-cell">
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
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Added</th><th/></tr></thead>
          <tbody>
            {users.map(u=>{
              const isSelf=u.id===currentUser.id;
              return (
                <tr key={u.id}>
                  <td><div className="user-cell"><span className="avatar">{initials(u.name)}</span>{u.name}{isSelf&&<span className="muted small"> (you)</span>}</div></td>
                  <td className="mono">{u.email}</td>
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

function LoginPage({ users, onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  function handleSubmit(e) {
    e.preventDefault(); setError("");
    const user = findUserByEmail(users, email);
    if (!user||user.password!==password) { setError("Incorrect email or password."); return; }
    if (user.status!=="Active") { setError("This account has been disabled. Contact your farm admin."); return; }
    onLogin(user);
  }
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="sidebar__brand-mark"><Sprout size={20}/></span>
          <div><div className="sidebar__brand-name" style={{color:"var(--ink)"}}>Pasture Ledger</div><div className="muted small">Sign in to the farm dashboard</div></div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{gridTemplateColumns:"1fr"}}>
            <label>Email<input type="email" autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@farm.local" required/></label>
            <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/></label>
          </div>
          {error&&<p className="form-error">{error}</p>}
          <button type="submit" className="btn btn--primary" style={{width:"100%",justifyContent:"center",marginTop:14}}><Lock size={15}/>Sign in</button>
        </form>
        {users.length<=1&&<p className="muted small login-hint">Default account: <span className="mono">admin@farm.local</span> / <span className="mono">admin123</span></p>}
        <p className="muted small login-hint">Accounts are created by your admin — there is no self-registration.</p>
      </div>
    </div>
  );
}

// ─── Finance forms ────────────────────────────────────────────────────────────
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
function FinancesPage({ sales, expenses, onNavigate }) {
  const totalRevenue    = sales.reduce((s,x)=>s+x.amount,0);
  const totalExpenses   = expenses.reduce((s,x)=>s+x.amount,0);
  const netProfit       = totalRevenue - totalExpenses;
  const margin          = totalRevenue>0 ? ((netProfit/totalRevenue)*100).toFixed(1) : null;

  const now = todayStr();
  const thisMonthKey = monthKey(now);
  const monthRevenue  = sales.filter(x=>monthKey(x.date)===thisMonthKey).reduce((s,x)=>s+x.amount,0);
  const monthExpenses = expenses.filter(x=>monthKey(x.date)===thisMonthKey).reduce((s,x)=>s+x.amount,0);
  const monthProfit   = monthRevenue - monthExpenses;

  // Monthly bar chart (last 8 months)
  const monthlyChart = useMemo(()=>{
    const buckets = {};
    sales.forEach(x=>{ const k=monthKey(x.date); if(k) { buckets[k]=buckets[k]||{rev:0,exp:0}; buckets[k].rev+=x.amount; }});
    expenses.forEach(x=>{ const k=monthKey(x.date); if(k) { buckets[k]=buckets[k]||{rev:0,exp:0}; buckets[k].exp+=x.amount; }});
    return Object.entries(buckets).sort((a,b)=>a[0]<b[0]?-1:1).slice(-8)
      .map(([k,v])=>({ label:monthLabel(k), revenue:Math.round(v.rev), expenses:Math.round(v.exp), profit:Math.round(v.rev-v.exp) }));
  },[sales,expenses]);

  // Expense by category pie
  const expCatData = useMemo(()=>{
    const c={};
    expenses.forEach(x=>{ c[x.category]=(c[x.category]||0)+x.amount; });
    return Object.entries(c).map(([name,value])=>({name,value:Math.round(value)})).sort((a,b)=>b.value-a.value);
  },[expenses]);

  // Revenue by type pie
  const revTypeData = useMemo(()=>{
    const c={};
    sales.forEach(x=>{ c[x.type]=(c[x.type]||0)+x.amount; });
    return Object.entries(c).map(([name,value])=>({name,value:Math.round(value)})).sort((a,b)=>b.value-a.value);
  },[sales]);

  const recentTx = [
    ...sales.map(x=>({...x,_kind:"sale"})),
    ...expenses.map(x=>({...x,_kind:"expense"})),
  ].sort((a,b)=>a.date<b.date?1:-1).slice(0,10);

  const isEmpty = sales.length===0 && expenses.length===0;

  return (
    <div className="page">
      {/* KPI row */}
      <div className="stat-row fin-stats">
        <StatCard icon={Banknote}     label="Total revenue"     value={currencyShort(totalRevenue)}   sub={`${sales.length} sale records`}       tone="green"/>
        <StatCard icon={Receipt}      label="Total expenses"    value={currencyShort(totalExpenses)}  sub={`${expenses.length} expense records`}  tone="rust"/>
        <StatCard icon={netProfit>=0?Wallet:TrendingDown} label="Net profit / loss" value={currencyShort(Math.abs(netProfit))} sub={netProfit>=0?"in the black":"running at a loss"} tone={netProfit>=0?"green":"rust"}/>
        <StatCard icon={BadgeDollarSign} label="Profit margin"  value={margin!==null?`${margin}%`:"—"} sub="revenue minus costs" tone={netProfit>=0?"gold":"ink"}/>
      </div>

      {/* This month KPIs */}
      <div className="fin-month-strip">
        <div className="fin-month-strip__label">This month</div>
        <div className="fin-month-strip__kpis">
          <div><span className="muted small">Revenue</span><strong className="trend-up mono">{currency(monthRevenue)}</strong></div>
          <div><span className="muted small">Expenses</span><strong className="trend-down mono">{currency(monthExpenses)}</strong></div>
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
                <button className="link-btn" onClick={()=>onNavigate("sales")}>Sales <ChevronRight size={13}/></button>
                <button className="link-btn" onClick={()=>onNavigate("expenses")}>Expenses <ChevronRight size={13}/></button>
              </div>
            </div>
            <table>
              <thead><tr><th>Type</th><th>Description</th><th>Date</th><th>Amount</th></tr></thead>
              <tbody>
                {recentTx.map(tx=>(
                  <tr key={tx.id}>
                    <td><Badge tone={tx._kind==="sale"?"success":"danger"}>{tx._kind==="sale"?"Revenue":"Expense"}</Badge></td>
                    <td>{tx.description}</td>
                    <td className="mono">{formatDate(tx.date)}</td>
                    <td className={`mono ${tx._kind==="sale"?"trend-up":"trend-down"}`}>
                      {tx._kind==="sale"?"+":"-"}{currency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SalesPage({ animals, sales, onAdd, onDelete }) {
  const [query, setQuery]       = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [confirmId, setConfirmId] = useState(null);
  const total = sales.reduce((s,x)=>s+x.amount,0);

  const rows = sales
    .filter(x=>{ const q=query.toLowerCase(); return (!q||x.description.toLowerCase().includes(q)||(x.buyer||"").toLowerCase().includes(q)) && (typeFilter==="All"||x.type===typeFilter); })
    .sort((a,b)=>a.date<b.date?1:-1);

  return (
    <div className="page">
      <div className="stat-row" style={{gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
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
        <div className="table-wrap">
          <table>
            <thead><tr><th>Type</th><th>Description</th><th>Date</th><th>Animal</th><th>Qty</th><th>Unit price</th><th>Amount</th><th>Buyer</th><th/></tr></thead>
            <tbody>
              {rows.map(x=>(
                <tr key={x.id}>
                  <td><Badge tone="neutral">{x.type}</Badge></td>
                  <td>{x.description}</td>
                  <td className="mono">{formatDate(x.date)}</td>
                  <td>{x.animalLabel||"—"}</td>
                  <td className="mono">{x.quantity||"—"}</td>
                  <td className="mono">{x.unitPrice?currency(x.unitPrice):"—"}</td>
                  <td className="mono trend-up">{currency(x.amount)}</td>
                  <td>{x.buyer||"—"}</td>
                  <td className="actions-cell"><button className="icon-btn icon-btn--danger" onClick={()=>setConfirmId(x.id)} aria-label="Delete"><Trash2 size={15}/></button></td>
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
      <div className="stat-row" style={{gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
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
        <div className="table-wrap">
          <table>
            <thead><tr><th>Category</th><th>Description</th><th>Date</th><th>Amount</th><th>Vendor</th><th>Source</th><th/></tr></thead>
            <tbody>
              {rows.map(x=>(
                <tr key={x.id}>
                  <td><Badge tone="neutral">{x.category}</Badge></td>
                  <td>{x.description}</td>
                  <td className="mono">{formatDate(x.date)}</td>
                  <td className="mono trend-down">{currency(x.amount)}</td>
                  <td>{x.vendor||"—"}</td>
                  <td><span className="muted small">{x.autoLogged?"Auto-logged":"Manual"}</span></td>
                  <td className="actions-cell"><button className="icon-btn icon-btn--danger" onClick={()=>setConfirmId(x.id)} aria-label="Delete"><Trash2 size={15}/></button></td>
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

// ─── Sample data ──────────────────────────────────────────────────────────────
function buildSampleData() {
  const a1={id:uid(),tagId:"CT-014",name:"Bramble",species:"Cattle",breed:"Jersey",sex:"Female",dob:"2022-03-10",status:"Healthy",weightKg:328,location:"North Paddock",origin:"Born in herd",purchaseCost:0,notes:"Top milk producer"};
  const a2={id:uid(),tagId:"CT-015",name:"Rosie",species:"Cattle",breed:"Friesian",sex:"Female",dob:"2021-11-05",status:"Pregnant",weightKg:385,location:"North Paddock",origin:"Purchased",purchaseCost:42000,notes:"Due in ~6 weeks"};
  const a3={id:uid(),tagId:"GT-002",name:"Pepper",species:"Goat",breed:"Boer",sex:"Female",dob:"2023-05-01",status:"Healthy",weightKg:38,location:"Goat Pen A",origin:"Purchased",purchaseCost:9500,notes:""};
  const a4={id:uid(),tagId:"SH-021",name:"Clover",species:"Sheep",breed:"Dorper",sex:"Female",dob:"2023-01-18",status:"Healthy",weightKg:56,location:"South Field",origin:"Born in herd",purchaseCost:0,notes:""};
  const a5={id:uid(),tagId:"PG-007",name:"Wilbur",species:"Pig",breed:"Landrace",sex:"Male",dob:"2024-03-22",status:"Sick",weightKg:71,location:"Sty 2",origin:"Purchased",purchaseCost:6000,notes:"Bought at Githunguri market"};
  const animals=[a1,a2,a3,a4,a5];

  const now=new Date();
  const iso=n=>{ const d=new Date(now); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };

  const vaccinations=[
    {id:uid(),animalId:a1.id,vaccine:"Foot-and-mouth booster",dateGiven:iso(-200),nextDue:iso(-3),administeredBy:"Dr. Wanjiru",batchNo:"FMD-2024-A",notes:"No reaction"},
    {id:uid(),animalId:a2.id,vaccine:"Brucellosis (RB51)",dateGiven:iso(-30),nextDue:iso(60),administeredBy:"Dr. Wanjiru",batchNo:"",notes:"Pre-calving"},
    {id:uid(),animalId:a3.id,vaccine:"CDT vaccine",dateGiven:iso(-45),nextDue:iso(10),administeredBy:"Dr. Otieno",batchNo:"CDT-B2",notes:""},
    {id:uid(),animalId:a5.id,vaccine:"Swine fever vaccine",dateGiven:iso(-365),nextDue:iso(2),administeredBy:"Dr. Wanjiru",batchNo:"",notes:"Annual"},
  ];

  const growth=[
    {id:uid(),animalId:a1.id,date:iso(-90),weightKg:302,bodyCondition:"3 — Ideal",notes:""},
    {id:uid(),animalId:a1.id,date:iso(-45),weightKg:315,bodyCondition:"3 — Ideal",notes:""},
    {id:uid(),animalId:a1.id,date:iso(-5),weightKg:328,bodyCondition:"3 — Ideal",notes:"Good condition"},
    {id:uid(),animalId:a5.id,date:iso(-60),weightKg:56,bodyCondition:"2 — Thin",notes:""},
    {id:uid(),animalId:a5.id,date:iso(-20),weightKg:65,bodyCondition:"3 — Ideal",notes:"Improving"},
    {id:uid(),animalId:a5.id,date:iso(-5),weightKg:71,bodyCondition:"",notes:"Off feed past 2 days"},
  ];

  const health=[
    {id:uid(),animalId:a5.id,type:"Illness",date:iso(-6),description:"Off feed, lethargic",treatment:"Oxytetracycline 10ml IM, electrolytes",vetName:"Dr. Wanjiru",followUpDate:iso(2),resolved:false},
    {id:uid(),animalId:a1.id,type:"Injury",date:iso(-40),description:"Minor wire cut on left flank",treatment:"Iodine wash, fly spray",vetName:"",followUpDate:"",resolved:true},
    {id:uid(),animalId:a3.id,type:"Observation",date:iso(-10),description:"Slight nasal discharge",treatment:"Monitored, cleared in 3 days",vetName:"",followUpDate:"",resolved:true},
  ];

  const feed=[
    {id:uid(),feedType:"Dairy meal",quantityKg:120,reorderLevel:80,costPerKg:48,supplier:"Highland Millers",lastRestocked:iso(-10)},
    {id:uid(),feedType:"Hay bales",quantityKg:35,reorderLevel:50,costPerKg:12,supplier:"Riverside Farm Supplies",lastRestocked:iso(-20)},
    {id:uid(),feedType:"Pig grower pellets",quantityKg:200,reorderLevel:60,costPerKg:52,supplier:"Highland Millers",lastRestocked:iso(-3)},
  ];

  const sales=[
    {id:uid(),type:"Animal sale",animalId:null,animalLabel:"",description:"Sold 3 weaner piglets",date:iso(-60),quantity:3,unitPrice:8000,amount:24000,buyer:"Mwangi Farm",notes:""},
    {id:uid(),type:"Milk / dairy",animalId:a1.id,animalLabel:`CT-014 — Bramble`,description:"Milk sales — March",date:iso(-30),quantity:180,unitPrice:65,amount:11700,buyer:"Githunguri Dairy",notes:""},
    {id:uid(),type:"Milk / dairy",animalId:a1.id,animalLabel:`CT-014 — Bramble`,description:"Milk sales — April",date:iso(-5),quantity:175,unitPrice:65,amount:11375,buyer:"Githunguri Dairy",notes:""},
    {id:uid(),type:"Animal sale",animalId:null,animalLabel:"",description:"Sold 1 mature goat",date:iso(-14),quantity:1,unitPrice:12000,amount:12000,buyer:"Local market",notes:"Sold at Limuru market"},
  ];

  const expenses=[
    {id:uid(),category:"Animal purchase",description:`Purchased CT-015 — Rosie`,date:iso(-180),amount:42000,vendor:"Muthiga Livestock",notes:"",autoLogged:true},
    {id:uid(),category:"Animal purchase",description:`Purchased GT-002 — Pepper`,date:iso(-120),amount:9500,vendor:"Githunguri market",notes:"",autoLogged:true},
    {id:uid(),category:"Animal purchase",description:`Purchased PG-007 — Wilbur`,date:iso(-90),amount:6000,vendor:"Githunguri market",notes:"",autoLogged:true},
    {id:uid(),category:"Feed purchase",description:"Dairy meal restock — 120 kg",date:iso(-10),amount:120*48,vendor:"Highland Millers",notes:"",autoLogged:true},
    {id:uid(),category:"Veterinary",description:"Routine herd health check",date:iso(-45),amount:3500,vendor:"Dr. Wanjiru",notes:""},
    {id:uid(),category:"Veterinary",description:"Emergency call — Wilbur",date:iso(-6),amount:2800,vendor:"Dr. Wanjiru",notes:"Oxytetracycline + consult"},
    {id:uid(),category:"Labor",description:"Casual labor — fencing repair",date:iso(-20),amount:4500,vendor:"",notes:"2 workers × 2 days"},
    {id:uid(),category:"Feed purchase",description:"Hay bales purchase",date:iso(-20),amount:35*12,vendor:"Riverside Farm Supplies",notes:"",autoLogged:true},
  ];

  return { animals, vaccinations, growth, health, feed, sales, expenses };
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  { items:[{key:"dashboard",label:"Overview",icon:LayoutDashboard}] },
  { label:"Livestock", items:[
    {key:"animals",      label:"Animals",      icon:PawPrint},
    {key:"vaccinations", label:"Vaccinations", icon:Syringe},
    {key:"growth",       label:"Growth",       icon:TrendingUp},
    {key:"feed",         label:"Feed stock",   icon:Wheat},
  ]},
  { label:"Finance", items:[
    {key:"finances",  label:"Overview",      icon:BadgeDollarSign},
    {key:"sales",     label:"Sales & Revenue", icon:Banknote},
    {key:"expenses",  label:"Expenses",      icon:Receipt},
  ]},
  { label:"Administration", items:[
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
  const [users, setUsers]               = useState([]);
  const [currentUser, setCurrentUser]   = useState(null);

  // modals
  const [showAnimalForm, setShowAnimalForm] = useState(false);
  const [editingAnimalId, setEditingAnimalId] = useState(null);
  const [showVaxForm, setShowVaxForm]     = useState(false);
  const [showGrowthForm, setShowGrowthForm] = useState(false);
  const [showHealthForm, setShowHealthForm] = useState(false);
  const [showFeedForm, setShowFeedForm]   = useState(false);
  const [showSaleForm, setShowSaleForm]   = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showAddUser, setShowAddUser]     = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [defaultAnimal, setDefaultAnimal] = useState(null);
  const [openAnimalId, setOpenAnimalId]   = useState(null);

  useEffect(()=>{
    (async()=>{
      let loadedUsers=[];
      await Promise.all([
        loadKey(STORAGE_KEYS.animals,      setAnimals),
        loadKey(STORAGE_KEYS.vaccinations, setVaccinations),
        loadKey(STORAGE_KEYS.growth,       setGrowthRecords),
        loadKey(STORAGE_KEYS.health,       setHealthEvents),
        loadKey(STORAGE_KEYS.feed,         setFeedItems),
        loadKey(STORAGE_KEYS.sales,        setSales),
        loadKey(STORAGE_KEYS.expenses,     setExpenses),
        loadKey(STORAGE_KEYS.users, u=>{ loadedUsers=u; setUsers(u); }),
      ]);
      if (!loadedUsers?.length) {
        const admin={id:uid(),name:"Farm Admin",email:"admin@farm.local",password:"admin123",role:"Admin",status:"Active",createdAtDate:todayStr()};
        loadedUsers=[admin]; setUsers(loadedUsers);
        await persist(STORAGE_KEYS.users, loadedUsers);
      }
      try {
        const s=await window.storage.get(STORAGE_KEYS.session,false);
        if (s?.value) { const {userId}=JSON.parse(s.value); const m=loadedUsers.find(u=>u.id===userId&&u.status==="Active"); if(m) setCurrentUser(m); }
      } catch(e){}
      setLoading(false);
    })();
  },[]);

  const handleLogin=user=>{ setCurrentUser(user); persist(STORAGE_KEYS.session,{userId:user.id}); };
  const handleLogout=()=>{ setCurrentUser(null); setMobileNavOpen(false); deleteKey(STORAGE_KEYS.session); };

  // mutators — auto-log expense helpers
  const _addExpense=(data)=>{ setExpenses(prev=>{ const next=[...prev,{id:uid(),createdAt:Date.now(),...data}]; persist(STORAGE_KEYS.expenses,next); return next; }); };

  const addAnimal=data=>{
    const newId=uid();
    const next=[...animals,{id:newId,createdAt:Date.now(),...data}];
    setAnimals(next); persist(STORAGE_KEYS.animals,next);
    if (data.origin==="Purchased" && data.purchaseCost>0)
      _addExpense({category:"Animal purchase",description:`Purchased ${data.tagId}${data.name?" — "+data.name:""}`,date:data.dob||todayStr(),amount:data.purchaseCost,vendor:"",notes:"",autoLogged:true});
    setShowAnimalForm(false);
  };
  const editAnimal=(id,data)=>{ const next=animals.map(a=>a.id===id?{...a,...data}:a); setAnimals(next); persist(STORAGE_KEYS.animals,next); setEditingAnimalId(null); };
  const deleteAnimal=id=>{ const next=animals.filter(a=>a.id!==id); setAnimals(next); persist(STORAGE_KEYS.animals,next); if(openAnimalId===id) setOpenAnimalId(null); };
  const addVaccination=data=>{ const next=[...vaccinations,{id:uid(),createdAt:Date.now(),...data}]; setVaccinations(next); persist(STORAGE_KEYS.vaccinations,next); setShowVaxForm(false); };
  const deleteVaccination=id=>{ const next=vaccinations.filter(v=>v.id!==id); setVaccinations(next); persist(STORAGE_KEYS.vaccinations,next); };
  const addGrowth=data=>{ const next=[...growthRecords,{id:uid(),createdAt:Date.now(),...data}]; setGrowthRecords(next); persist(STORAGE_KEYS.growth,next); const ani=animals.find(a=>a.id===data.animalId); if(ani){ const an=animals.map(a=>a.id===data.animalId?{...a,weightKg:data.weightKg}:a); setAnimals(an); persist(STORAGE_KEYS.animals,an); } setShowGrowthForm(false); };
  const deleteGrowth=id=>{ const next=growthRecords.filter(g=>g.id!==id); setGrowthRecords(next); persist(STORAGE_KEYS.growth,next); };
  const addHealthEvent=data=>{ const next=[...healthEvents,{id:uid(),createdAt:Date.now(),...data}]; setHealthEvents(next); persist(STORAGE_KEYS.health,next); setShowHealthForm(false); };
  const deleteHealthEvent=id=>{ const next=healthEvents.filter(h=>h.id!==id); setHealthEvents(next); persist(STORAGE_KEYS.health,next); };
  const addFeed=data=>{
    const next=[...feedItems,{id:uid(),createdAt:Date.now(),...data}];
    setFeedItems(next); persist(STORAGE_KEYS.feed,next);
    if (data.quantityKg>0 && data.costPerKg>0)
      _addExpense({category:"Feed purchase",description:`Initial stock — ${data.feedType}`,date:data.lastRestocked||todayStr(),amount:Math.round(data.quantityKg*data.costPerKg*100)/100,vendor:data.supplier||"",notes:"",autoLogged:true});
    setShowFeedForm(false);
  };
  const adjustFeed=(id,delta)=>{ const next=feedItems.map(f=>f.id===id?{...f,quantityKg:Math.max(0,Math.round((f.quantityKg+delta)*10)/10),lastRestocked:delta>0?todayStr():f.lastRestocked}:f); setFeedItems(next); persist(STORAGE_KEYS.feed,next); };
  const deleteFeed=id=>{ const next=feedItems.filter(f=>f.id!==id); setFeedItems(next); persist(STORAGE_KEYS.feed,next); };
  const addSale=data=>{ const next=[...sales,{id:uid(),createdAt:Date.now(),...data}]; setSales(next); persist(STORAGE_KEYS.sales,next); setShowSaleForm(false); };
  const deleteSale=id=>{ const next=sales.filter(x=>x.id!==id); setSales(next); persist(STORAGE_KEYS.sales,next); };
  const addExpense=data=>{ const next=[...expenses,{id:uid(),createdAt:Date.now(),...data,autoLogged:false}]; setExpenses(next); persist(STORAGE_KEYS.expenses,next); setShowExpenseForm(false); };
  const deleteExpense=id=>{ const next=expenses.filter(x=>x.id!==id); setExpenses(next); persist(STORAGE_KEYS.expenses,next); };
  const addUser=data=>{ const next=[...users,{id:uid(),name:data.name,email:data.email,password:data.password,role:data.role,status:"Active",createdAtDate:todayStr()}]; setUsers(next); persist(STORAGE_KEYS.users,next); setShowAddUser(false); };
  const editUser=(id,update)=>{ const next=users.map(u=>u.id===id?{...u,...update}:u); setUsers(next); persist(STORAGE_KEYS.users,next); if(currentUser?.id===id) setCurrentUser(c=>({...c,...update})); setEditingUserId(null); };
  const toggleUser=id=>{ const next=users.map(u=>u.id===id?{...u,status:u.status==="Active"?"Disabled":"Active"}:u); setUsers(next); persist(STORAGE_KEYS.users,next); };
  const deleteUser=id=>{ const next=users.filter(u=>u.id!==id); setUsers(next); persist(STORAGE_KEYS.users,next); };

  const seedData=async()=>{
    const s=buildSampleData();
    setAnimals(s.animals); setVaccinations(s.vaccinations); setGrowthRecords(s.growth);
    setHealthEvents(s.health); setFeedItems(s.feed);
    setSales(s.sales); setExpenses(s.expenses);
    await Promise.all([
      persist(STORAGE_KEYS.animals,s.animals), persist(STORAGE_KEYS.vaccinations,s.vaccinations),
      persist(STORAGE_KEYS.growth,s.growth),   persist(STORAGE_KEYS.health,s.health),
      persist(STORAGE_KEYS.feed,s.feed),        persist(STORAGE_KEYS.sales,s.sales),
      persist(STORAGE_KEYS.expenses,s.expenses),
    ]);
  };

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
        <LoginPage users={users} onLogin={handleLogin}/>
      ) : (
        <div className="app-shell">
          {mobileNavOpen && <div className="sidebar-backdrop" onClick={()=>setMobileNavOpen(false)}/>}
          <aside className={`sidebar ${mobileNavOpen?"is-open":""}`}>
            <div className="sidebar__brand">
              <span className="sidebar__brand-mark"><Sprout size={18}/></span>
              <div><div className="sidebar__brand-name">Pasture Ledger</div><div className="sidebar__brand-sub">Farm management</div></div>
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
                <div className="topbar__user-info"><strong>{currentUser.name}</strong><span className="muted small">{currentUser.role}</span></div>
                <button className="icon-btn" onClick={handleLogout} title="Log out" aria-label="Log out"><LogOut size={17}/></button>
              </div>
            </header>
            <div className="content">
              {activeTab==="dashboard"    && <DashboardPage animals={animals} vaccinations={vaccinations} growthRecords={growthRecords} healthEvents={healthEvents} feedItems={feedItems} sales={sales} expenses={expenses} onSeed={seedData} onNavigate={setActiveTab}/>}
              {activeTab==="animals"      && <AnimalsPage animals={animals} vaccinations={vaccinations} growthRecords={growthRecords} healthEvents={healthEvents} onAdd={()=>setShowAnimalForm(true)} onDelete={deleteAnimal} onOpen={setOpenAnimalId}/>}
              {activeTab==="vaccinations" && <VaccinationsPage animals={animals} vaccinations={vaccinations} onAdd={()=>{setDefaultAnimal(null);setShowVaxForm(true);}} onDelete={deleteVaccination}/>}
              {activeTab==="growth"       && <GrowthPage animals={animals} growthRecords={growthRecords} onAdd={()=>{setDefaultAnimal(null);setShowGrowthForm(true);}} onDelete={deleteGrowth}/>}
              {activeTab==="feed"         && <FeedPage feedItems={feedItems} onAdd={()=>setShowFeedForm(true)} onAdjust={adjustFeed} onDelete={deleteFeed}/>}
              {activeTab==="finances"     && <FinancesPage sales={sales} expenses={expenses} onNavigate={setActiveTab}/>}
              {activeTab==="sales"        && <SalesPage animals={animals} sales={sales} onAdd={()=>setShowSaleForm(true)} onDelete={deleteSale}/>}
              {activeTab==="expenses"     && <ExpensesPage expenses={expenses} onAdd={()=>setShowExpenseForm(true)} onDelete={deleteExpense}/>}
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

/* Tables */
.toolbar { display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
.search-box { display:flex;align-items:center;gap:7px;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:7px 11px;flex:1;max-width:320px;color:var(--muted); }
.search-box input { border:none;outline:none;background:transparent;font-size:13.5px;flex:1;color:var(--ink);font-family:'Inter',sans-serif; }
.toolbar select { border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:13px;background:var(--paper);color:var(--ink);font-family:'Inter',sans-serif; }
.table-wrap { background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:auto;-webkit-overflow-scrolling:touch; }
table { width:100%;border-collapse:collapse;font-size:13px; }
th { text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600;padding:11px 14px;border-bottom:1px solid var(--line);white-space:nowrap; }
td { padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:middle; }
tr:last-child td { border-bottom:none; }
tr.clickable { cursor:pointer; }
tr.clickable:hover { background:#F3EDDD; }
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
.btn--tiny:disabled,.icon-btn:disabled { opacity:.4;cursor:not-allowed; }
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
.form-grid { display:grid;grid-template-columns:1fr 1fr;gap:12px 14px; }
.form-grid label { display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:600;color:var(--muted); }
.form-grid .span-2 { grid-column:span 2; }
.form-grid input,.form-grid select,.form-grid textarea { border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:13.5px;font-family:'Inter',sans-serif;color:var(--ink);background:var(--cream);outline:none; }
.form-grid input:focus,.form-grid select:focus,.form-grid textarea:focus { border-color:var(--rust); }
.form-grid input:disabled { opacity:.5;cursor:not-allowed; }
.form-grid textarea { resize:vertical; }
.form-actions { display:flex;justify-content:flex-end;gap:8px;margin-top:18px; }
.form-error { background:#F4DCD6;color:var(--rust);font-size:12.5px;font-weight:600;padding:8px 10px;border-radius:7px;margin-top:10px; }

/* Login */
.login-screen { min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--green);padding:24px; }
.login-card { background:var(--paper);border-radius:16px;padding:30px 28px;width:100%;max-width:380px;box-shadow:0 24px 60px rgba(0,0,0,.3); }
.login-brand { display:flex;align-items:center;gap:10px;margin-bottom:22px; }
.login-hint  { margin-top:14px;line-height:1.5; }

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
.fin-dash-strip__title { display:flex;align-items:center;gap:7px;font-family:'Zilla Slab',serif;font-size:14.5px;font-weight:600;white-space:nowrap;color:var(--ink); }
.fin-dash-strip__kpis { display:flex;align-items:center;gap:24px;flex:1;flex-wrap:wrap; }
.fin-dash-strip__kpis > div { display:flex;flex-direction:column;gap:2px; }
.fin-dash-strip__kpis strong { font-size:15px; }
.fin-dash-strip__kpis .muted { font-size:11px;text-transform:uppercase;letter-spacing:.04em; }
.fin-dash-strip__divider { width:1px;height:30px;background:var(--line);flex-shrink:0; }

/* Finance pages */
.fin-stats { grid-template-columns:repeat(4,minmax(0,1fr)); }
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
  .panel--wide { grid-column:span 1; }
  .fin-stats { grid-template-columns:1fr 1fr; }
  .fin-dash-strip { flex-wrap:wrap; gap:12px; }
  .fin-dash-strip__kpis { gap:14px; }
  .fin-dash-strip__divider { display:none; }
  .fin-month-strip { gap:12px; }
  .fin-month-strip__kpis { gap:16px; }
  .form-grid { grid-template-columns:1fr; }
  .form-grid .span-2 { grid-column:span 1; }
  .drawer { max-width:100%; }
  .drawer__quick-stats { grid-template-columns:1fr 1fr; }
  .form-grid input,.form-grid select,.form-grid textarea,.search-box input,.toolbar select,.login-card input { font-size:16px; }
  .btn,.btn--tiny { min-height:36px; }
  .icon-btn { padding:8px; }
  .composition { flex-direction:column;align-items:flex-start; }
}

@media (max-width:480px) {
  .stat-row { grid-template-columns:1fr; }
  .fin-stats { grid-template-columns:1fr 1fr; }
  .topbar h1 { font-size:17px; }
  .login-card { padding:24px 18px; }
  .search-box { max-width:none;width:100%; }
  .toolbar select { flex:1; }
  .modal-overlay { padding:0;align-items:flex-end; }
  .modal-card { max-width:100%;max-height:92dvh;border-radius:16px 16px 0 0; }
  .drawer__quick-stats { grid-template-columns:1fr 1fr; }
  .overview-grid { grid-template-columns:1fr; }
  .drawer__tabs { overflow-x:auto;-webkit-overflow-scrolling:touch; }
  .fin-month-strip__kpis { gap:12px; }
}
`;