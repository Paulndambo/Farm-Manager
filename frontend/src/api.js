const API_BASE_URL = (
  import.meta.env.VITE_BACKEND_BASE_URL || "https://backend.wazaschool.co.ke/api"
).replace(/\/$/, "");
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
    // Authentication uses the JWT Authorization header, not cross-site cookies.
    // Omitting credentials also keeps requests compatible with API gateways that
    // respond with Access-Control-Allow-Origin: *.
    credentials: "omit",
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
    phoneNumber: user.phoneNumber || "",
    gender: user.gender || "",
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

function normalizeProduction(record) {
  return { ...record, quantity: toNumber(record.quantity) || 0 };
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

function normalizeContract(contract) {
  return {
    ...contract,
    agreedRate: toNumber(contract.agreedRate),
  };
}

function normalizeInvoice(invoice) {
  return {
    ...invoice,
    amount: toNumber(invoice.amount) || 0,
    amountPaid: toNumber(invoice.amountPaid) || 0,
    outstandingBalance: toNumber(invoice.outstandingBalance) || 0,
    payments: (invoice.payments || []).map(payment => ({
      ...payment,
      amount: toNumber(payment.amount) || 0,
    })),
    items: (invoice.items || []).map(item => ({
      ...item,
      quantity: toNumber(item.quantity) || 0,
      unitPrice: toNumber(item.unitPrice) || 0,
      lineTotal: toNumber(item.lineTotal) || 0,
    })),
  };
}

function normalizeLoanPayment(payment) {
  return {
    ...payment,
    amount: toNumber(payment.amount) || 0,
  };
}

function normalizeLoan(loan) {
  return {
    ...loan,
    principalAmount: toNumber(loan.principalAmount) || 0,
    interestRate: toNumber(loan.interestRate) || 0,
    totalDue: toNumber(loan.totalDue) || 0,
    totalPaid: toNumber(loan.totalPaid) || 0,
    outstandingBalance: toNumber(loan.outstandingBalance) || 0,
    payments: (loan.payments || []).map(normalizeLoanPayment),
  };
}

function normalizeUserAction(action) {
  return {
    ...action,
    userId: action.userId,
    userName: action.userName || "Unknown user",
    userEmail: action.userEmail || "",
    actionType: action.actionType,
    createdAt: action.createdAt,
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

  async registerFarm(data) {
    const response = await request("/auth/register-farm/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setTokens(response);
    return normalizeUser(response.user);
  },

  async me() {
    return normalizeUser(await request("/auth/me/"));
  },

  async loadAll(currentUser) {
    const [farm, animals, vaccinations, growth, production, health, feed, sales, expenses, partners, contracts, invoices, loans, users, userActions] = await Promise.all([
      request("/farm/"),
      request("/animals/"),
      request("/vaccinations/"),
      request("/growth-records/"),
      request("/production-records/"),
      request("/health-events/"),
      request("/feed-items/"),
      request("/sales/"),
      request("/expenses/"),
      request("/partners/"),
      request("/contracts/"),
      request("/invoices/"),
      request("/loans/"),
      currentUser?.role === "Admin" ? request("/users/") : Promise.resolve([]),
      currentUser?.role === "Admin" ? request("/user-actions/") : Promise.resolve([]),
    ]);

    const normalizedUsers = users.map(normalizeUser);

    return {
      farm,
      animals: animals.map(normalizeAnimal),
      vaccinations,
      growthRecords: growth.map(record => ({ ...record, weightKg: toNumber(record.weightKg) || 0 })),
      productionRecords: production.map(normalizeProduction),
      healthEvents: health,
      feedItems: feed.map(normalizeFeed),
      sales: sales.map(normalizeSale),
      expenses: expenses.map(normalizeExpense),
      partners,
      contracts: contracts.map(normalizeContract),
      invoices: invoices.map(normalizeInvoice),
      loans: loans.map(normalizeLoan),
      users: normalizedUsers,
      userActions: userActions.map(normalizeUserAction),
    };
  },

  getFarm() {
    return request("/farm/");
  },

  updateFarm(data) {
    return request("/farm/", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
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

  createProductionRecord(data) {
    return request("/production-records/", { method: "POST", body: JSON.stringify(data) });
  },

  deleteProductionRecord(id) {
    return request(`/production-records/${id}/`, { method: "DELETE" });
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

  createPartner(data) {
    return request("/partners/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updatePartner(id, data) {
    return request(`/partners/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deletePartner(id) {
    return request(`/partners/${id}/`, { method: "DELETE" });
  },

  createContract(data) {
    return request("/contracts/", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        endDate: nullIfBlank(data.endDate),
        agreedRate: data.agreedRate === "" ? null : data.agreedRate,
      }),
    }).then(normalizeContract);
  },

  updateContract(id, data) {
    return request(`/contracts/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({
        ...data,
        endDate: nullIfBlank(data.endDate),
        agreedRate: data.agreedRate === "" ? null : data.agreedRate,
      }),
    }).then(normalizeContract);
  },

  deleteContract(id) {
    return request(`/contracts/${id}/`, { method: "DELETE" });
  },

  createInvoice(data) {
    return request("/invoices/", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        contractId: data.contractId || null,
        dueDate: nullIfBlank(data.dueDate),
        items: data.items.map(item => ({
          ...item,
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
        })),
      }),
    }).then(normalizeInvoice);
  },

  updateInvoice(id, data) {
    return request(`/invoices/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({
        ...data,
        contractId: data.contractId || null,
        dueDate: nullIfBlank(data.dueDate),
        items: data.items.map(item => ({
          ...item,
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
        })),
      }),
    }).then(normalizeInvoice);
  },

  recordInvoicePayment(id, data) {
    return request(`/invoices/${id}/record-payment/`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then(normalizeInvoice);
  },

  reverseInvoicePayment(id, paymentId) {
    return request(`/invoices/${id}/reverse-payment/`, {
      method: "POST",
      body: JSON.stringify({ paymentId }),
    }).then(normalizeInvoice);
  },

  transitionInvoice(id, action) {
    return request(`/invoices/${id}/transition/`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }).then(normalizeInvoice);
  },

  deleteInvoice(id) {
    return request(`/invoices/${id}/`, { method: "DELETE" });
  },

  createLoan(data) {
    return request("/loans/", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        dueDate: nullIfBlank(data.dueDate),
      }),
    }).then(normalizeLoan);
  },

  deleteLoan(id) {
    return request(`/loans/${id}/`, { method: "DELETE" });
  },

  createLoanPayment(data) {
    return request("/loan-payments/", {
      method: "POST",
      body: JSON.stringify(data),
    }).then(normalizeLoanPayment);
  },

  deleteLoanPayment(id) {
    return request(`/loan-payments/${id}/`, { method: "DELETE" });
  },

  createUser(data) {
    return request("/users/", {
      method: "POST",
      body: JSON.stringify({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        gender: data.gender,
        phoneNumber: data.phoneNumber,
        password: data.password,
        role: data.role,
        status: "Active",
      }),
    }).then(normalizeUser);
  },

  updateUser(id, data) {
    const payload = {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      gender: data.gender,
      phoneNumber: data.phoneNumber,
      role: data.role,
    };
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
