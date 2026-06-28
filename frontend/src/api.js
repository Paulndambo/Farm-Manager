const API_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL || "http://127.0.0.1:8000/api";
const ACCESS_KEY = "farm_manager_access_token";
const REFRESH_KEY = "farm_manager_refresh_token";

function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

function setTokens(tokens) {
  if (tokens.access) localStorage.setItem(ACCESS_KEY, tokens.access);
  if (tokens.refresh) localStorage.setItem(REFRESH_KEY, tokens.refresh);
}

function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) return null;

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.detail || Object.values(data || {}).flat().join(" ") || "Request failed.";
    throw new Error(message);
  }

  return data;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isNaN(next) ? null : next;
}

function normalizeUser(user) {
  return {
    ...user,
    name: user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
    createdAtDate: user.date_joined?.slice(0, 10),
  };
}

function normalizeAnimal(animal) {
  return {
    ...animal,
    weightKg: toNumber(animal.weightKg),
    purchaseCost: toNumber(animal.purchaseCost) || 0,
    currentValue: toNumber(animal.currentValue) || 0,
  };
}

function normalizeFeed(item) {
  return {
    ...item,
    quantityKg: toNumber(item.quantityKg) || 0,
    reorderLevel: toNumber(item.reorderLevel) || 0,
    costPerKg: toNumber(item.costPerKg) || 0,
  };
}

function normalizeSale(sale) {
  return {
    ...sale,
    type: sale.saleType,
    amount: toNumber(sale.amount) || 0,
    quantity: toNumber(sale.quantity),
    unitPrice: toNumber(sale.unitPrice),
  };
}

function normalizeExpense(expense) {
  return {
    ...expense,
    amount: toNumber(expense.amount) || 0,
    autoLogged: Boolean(expense.autoLogged),
  };
}

function splitName(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts.shift() || "",
    last_name: parts.join(" "),
  };
}

function nullIfBlank(value) {
  return value === "" ? null : value;
}

export const api = {
  hasToken() {
    return Boolean(getAccessToken());
  },

  clearTokens,

  async login(email, password) {
    const data = await request("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setTokens(data);
    return normalizeUser(data.user);
  },

  async me() {
    return normalizeUser(await request("/auth/me/"));
  },

  async loadAll(currentUser) {
    const [animals, vaccinations, growth, health, feed, sales, expenses, users] = await Promise.all([
      request("/animals/"),
      request("/vaccinations/"),
      request("/growth-records/"),
      request("/health-events/"),
      request("/feed-items/"),
      request("/sales/"),
      request("/expenses/"),
      currentUser?.role === "Admin" ? request("/users/") : Promise.resolve([]),
    ]);

    const normalizedUsers = users.map(normalizeUser);

    return {
      animals: animals.map(normalizeAnimal),
      vaccinations,
      growthRecords: growth.map(record => ({ ...record, weightKg: toNumber(record.weightKg) || 0 })),
      healthEvents: health,
      feedItems: feed.map(normalizeFeed),
      sales: sales.map(normalizeSale),
      expenses: expenses.map(normalizeExpense),
      users: normalizedUsers,
    };
  },

  createAnimal(data) {
    return request("/animals/", { method: "POST", body: JSON.stringify({ ...data, dob: nullIfBlank(data.dob) }) }).then(normalizeAnimal);
  },

  updateAnimal(id, data) {
    return request(`/animals/${id}/`, { method: "PATCH", body: JSON.stringify({ ...data, dob: nullIfBlank(data.dob) }) }).then(normalizeAnimal);
  },

  deleteAnimal(id) {
    return request(`/animals/${id}/`, { method: "DELETE" });
  },

  createVaccination(data) {
    return request("/vaccinations/", { method: "POST", body: JSON.stringify({ ...data, nextDue: nullIfBlank(data.nextDue) }) });
  },

  deleteVaccination(id) {
    return request(`/vaccinations/${id}/`, { method: "DELETE" });
  },

  createGrowthRecord(data) {
    return request("/growth-records/", { method: "POST", body: JSON.stringify(data) });
  },

  deleteGrowthRecord(id) {
    return request(`/growth-records/${id}/`, { method: "DELETE" });
  },

  createHealthEvent(data) {
    return request("/health-events/", { method: "POST", body: JSON.stringify({ ...data, followUpDate: nullIfBlank(data.followUpDate) }) });
  },

  deleteHealthEvent(id) {
    return request(`/health-events/${id}/`, { method: "DELETE" });
  },

  createFeedItem(data) {
    return request("/feed-items/", { method: "POST", body: JSON.stringify(data) }).then(normalizeFeed);
  },

  adjustFeedItem(id, mode, quantityKg) {
    return request(`/feed-items/${id}/adjust-stock/`, {
      method: "POST",
      body: JSON.stringify({ mode, quantityKg, createExpense: mode === "restock" }),
    });
  },

  deleteFeedItem(id) {
    return request(`/feed-items/${id}/`, { method: "DELETE" });
  },

  createSale(data) {
    const payload = {
      saleType: data.type,
      animalId: data.animalId,
      description: data.description,
      date: data.date,
      amount: data.amount,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      buyer: data.buyer,
      notes: data.notes,
    };
    return request("/sales/", { method: "POST", body: JSON.stringify(payload) }).then(normalizeSale);
  },

  deleteSale(id) {
    return request(`/sales/${id}/`, { method: "DELETE" });
  },

  createExpense(data) {
    return request("/expenses/", {
      method: "POST",
      body: JSON.stringify({ ...data, autoLogged: false }),
    }).then(normalizeExpense);
  },

  deleteExpense(id) {
    return request(`/expenses/${id}/`, { method: "DELETE" });
  },

  createUser(data) {
    return request("/users/", {
      method: "POST",
      body: JSON.stringify({ ...splitName(data.name), email: data.email, password: data.password, role: data.role, status: "Active" }),
    }).then(normalizeUser);
  },

  updateUser(id, data) {
    const payload = { ...splitName(data.name), email: data.email, role: data.role };
    if (data.password) payload.password = data.password;
    return request(`/users/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }).then(normalizeUser);
  },

  toggleUser(id) {
    return request(`/users/${id}/toggle-status/`, { method: "POST" }).then(normalizeUser);
  },

  deleteUser(id) {
    return request(`/users/${id}/`, { method: "DELETE" });
  },
};
