import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";

import { storage } from "@/src/utils/storage";

export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  payment_method: string;
  expense_date: string; // YYYY-MM-DD
  expense_time: string; // HH:mm
  note: string | null;
  created_at: string; // ISO
}

export interface NewExpense {
  title: string;
  amount: number;
  category: string;
  payment_method: string;
  expense_date: string;
  expense_time: string;
  note?: string | null;
  created_at?: string;
}

const IS_WEB = Platform.OS === "web";
const WEB_KEY = "rupeelog_expenses";

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function dateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function timeOnly(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function seedRows(): Expense[] {
  const seeds = [
    { title: "Zomato order", amount: 349, category: "Food", pm: "UPI", daysAgo: 1 },
    { title: "Petrol fill", amount: 800, category: "Fuel", pm: "Cash", daysAgo: 2 },
    { title: "Netflix", amount: 649, category: "Entertainment", pm: "Credit Card", daysAgo: 3 },
    { title: "Metro recharge", amount: 200, category: "Transport", pm: "UPI", daysAgo: 4 },
    { title: "DMart groceries", amount: 1250, category: "Shopping", pm: "Debit Card", daysAgo: 5 },
  ];
  return seeds.map((s, i) => {
    const d = new Date();
    d.setDate(d.getDate() - s.daysAgo);
    return {
      id: i + 1,
      title: s.title,
      amount: s.amount,
      category: s.category,
      payment_method: s.pm,
      expense_date: dateOnly(d),
      expense_time: timeOnly(d),
      note: null,
      created_at: d.toISOString(),
    };
  });
}

/* ----------------------------- Web (localStorage) ----------------------------- */

async function webRead(): Promise<Expense[]> {
  const raw = await storage.getItem<string>(WEB_KEY, "");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Expense[];
  } catch {
    return [];
  }
}
async function webWrite(rows: Expense[]): Promise<void> {
  await storage.setItem(WEB_KEY, JSON.stringify(rows));
}

/* ------------------------------ Native (SQLite) ------------------------------ */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync("rupeelog.db");
  return dbPromise;
}

/* --------------------------------- Public API -------------------------------- */

export async function initDb(): Promise<void> {
  if (IS_WEB) {
    const existing = await webRead();
    if (existing.length === 0) await webWrite(seedRows());
    return;
  }

  const db = await getDb();
  await db.execAsync(
    `PRAGMA journal_mode = WAL;
     PRAGMA foreign_keys = ON;
     CREATE TABLE IF NOT EXISTS expenses (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       title TEXT NOT NULL,
       amount REAL NOT NULL,
       category TEXT NOT NULL,
       payment_method TEXT NOT NULL,
       expense_date TEXT NOT NULL,
       expense_time TEXT NOT NULL,
       note TEXT,
       created_at TEXT NOT NULL
     );
     CREATE TABLE IF NOT EXISTS settings (
       key TEXT PRIMARY KEY NOT NULL,
       value TEXT
     );
     CREATE TABLE IF NOT EXISTS groups (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       colour TEXT NOT NULL,
       created_at TEXT NOT NULL
     );
     CREATE TABLE IF NOT EXISTS expense_groups (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       expense_id INTEGER NOT NULL,
       group_id INTEGER NOT NULL,
       FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
       FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
     );`,
  );

  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM expenses");
  if (!row || row.c === 0) {
    for (const s of seedRows()) {
      await db.runAsync(
        "INSERT INTO expenses (title, amount, category, payment_method, expense_date, expense_time, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        s.title,
        s.amount,
        s.category,
        s.payment_method,
        s.expense_date,
        s.expense_time,
        s.note,
        s.created_at,
      );
    }
  }
}

export async function getAllExpenses(): Promise<Expense[]> {
  if (IS_WEB) {
    const rows = await webRead();
    return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  const db = await getDb();
  return db.getAllAsync<Expense>("SELECT * FROM expenses ORDER BY created_at DESC");
}

export async function addExpense(e: NewExpense): Promise<number> {
  const created_at = e.created_at ?? new Date().toISOString();
  if (IS_WEB) {
    const rows = await webRead();
    const id = rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    rows.push({
      id,
      title: e.title,
      amount: e.amount,
      category: e.category,
      payment_method: e.payment_method,
      expense_date: e.expense_date,
      expense_time: e.expense_time,
      note: e.note ?? null,
      created_at,
    });
    await webWrite(rows);
    return id;
  }
  const db = await getDb();
  const res = await db.runAsync(
    "INSERT INTO expenses (title, amount, category, payment_method, expense_date, expense_time, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    e.title,
    e.amount,
    e.category,
    e.payment_method,
    e.expense_date,
    e.expense_time,
    e.note ?? null,
    created_at,
  );
  return res.lastInsertRowId;
}

export async function updateExpense(id: number, e: NewExpense): Promise<void> {
  if (IS_WEB) {
    const rows = await webRead();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx >= 0) {
      rows[idx] = {
        ...rows[idx],
        title: e.title,
        amount: e.amount,
        category: e.category,
        payment_method: e.payment_method,
        expense_date: e.expense_date,
        expense_time: e.expense_time,
        note: e.note ?? null,
      };
      await webWrite(rows);
    }
    return;
  }
  const db = await getDb();
  await db.runAsync(
    "UPDATE expenses SET title=?, amount=?, category=?, payment_method=?, expense_date=?, expense_time=?, note=? WHERE id=?",
    e.title,
    e.amount,
    e.category,
    e.payment_method,
    e.expense_date,
    e.expense_time,
    e.note ?? null,
    id,
  );
}

export async function deleteExpense(id: number): Promise<void> {
  if (IS_WEB) {
    const rows = await webRead();
    await webWrite(rows.filter((r) => r.id !== id));
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM expenses WHERE id = ?", id);
}

/* --------------------------------- Groups ------------------------------------ */

export interface Group {
  id: number;
  name: string;
  colour: string;
  created_at: string;
}

export interface GroupWithStats extends Group {
  expense_count: number;
  total: number;
  min_date: string | null;
  max_date: string | null;
}

interface GroupLink {
  id: number;
  expense_id: number;
  group_id: number;
}

const WEB_GROUPS_KEY = "rupeelog_groups";
const WEB_LINKS_KEY = "rupeelog_expense_groups";

async function webReadGroups(): Promise<Group[]> {
  const raw = await storage.getItem<string>(WEB_GROUPS_KEY, "");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Group[];
  } catch {
    return [];
  }
}
async function webWriteGroups(rows: Group[]): Promise<void> {
  await storage.setItem(WEB_GROUPS_KEY, JSON.stringify(rows));
}
async function webReadLinks(): Promise<GroupLink[]> {
  const raw = await storage.getItem<string>(WEB_LINKS_KEY, "");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as GroupLink[];
  } catch {
    return [];
  }
}
async function webWriteLinks(rows: GroupLink[]): Promise<void> {
  await storage.setItem(WEB_LINKS_KEY, JSON.stringify(rows));
}

function statsFor(group: Group, links: GroupLink[], byId: Map<number, Expense>): GroupWithStats {
  const exps = links
    .filter((l) => l.group_id === group.id)
    .map((l) => byId.get(l.expense_id))
    .filter((e): e is Expense => !!e);
  const total = exps.reduce((s, e) => s + e.amount, 0);
  const dates = exps.map((e) => e.expense_date).sort();
  return {
    ...group,
    expense_count: exps.length,
    total,
    min_date: dates[0] ?? null,
    max_date: dates[dates.length - 1] ?? null,
  };
}

export async function createGroup(name: string, colour: string): Promise<number> {
  const created_at = new Date().toISOString();
  if (IS_WEB) {
    const groups = await webReadGroups();
    const id = groups.reduce((m, g) => Math.max(m, g.id), 0) + 1;
    groups.push({ id, name, colour, created_at });
    await webWriteGroups(groups);
    return id;
  }
  const db = await getDb();
  const res = await db.runAsync(
    "INSERT INTO groups (name, colour, created_at) VALUES (?, ?, ?)",
    name,
    colour,
    created_at,
  );
  return res.lastInsertRowId;
}

export async function getGroups(): Promise<GroupWithStats[]> {
  if (IS_WEB) {
    const [groups, links, expenses] = await Promise.all([webReadGroups(), webReadLinks(), webRead()]);
    const byId = new Map(expenses.map((e) => [e.id, e]));
    return groups
      .map((g) => statsFor(g, links, byId))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  const db = await getDb();
  return db.getAllAsync<GroupWithStats>(
    `SELECT groups.*, COUNT(eg.expense_id) as expense_count,
            COALESCE(SUM(e.amount), 0) as total,
            MIN(e.expense_date) as min_date, MAX(e.expense_date) as max_date
     FROM groups
     LEFT JOIN expense_groups eg ON groups.id = eg.group_id
     LEFT JOIN expenses e ON eg.expense_id = e.id
     GROUP BY groups.id
     ORDER BY groups.created_at DESC`,
  );
}

export async function getGroupById(id: number): Promise<GroupWithStats | null> {
  if (IS_WEB) {
    const [groups, links, expenses] = await Promise.all([webReadGroups(), webReadLinks(), webRead()]);
    const g = groups.find((x) => x.id === id);
    if (!g) return null;
    const byId = new Map(expenses.map((e) => [e.id, e]));
    return statsFor(g, links, byId);
  }
  const db = await getDb();
  const row = await db.getFirstAsync<GroupWithStats>(
    `SELECT groups.*, COUNT(eg.expense_id) as expense_count,
            COALESCE(SUM(e.amount), 0) as total,
            MIN(e.expense_date) as min_date, MAX(e.expense_date) as max_date
     FROM groups
     LEFT JOIN expense_groups eg ON groups.id = eg.group_id
     LEFT JOIN expenses e ON eg.expense_id = e.id
     WHERE groups.id = ?
     GROUP BY groups.id`,
    id,
  );
  return row ?? null;
}

export async function getGroupExpenses(groupId: number): Promise<Expense[]> {
  if (IS_WEB) {
    const [links, expenses] = await Promise.all([webReadLinks(), webRead()]);
    const ids = new Set(links.filter((l) => l.group_id === groupId).map((l) => l.expense_id));
    return expenses
      .filter((e) => ids.has(e.id))
      .sort((a, b) => (a.expense_date < b.expense_date ? 1 : -1));
  }
  const db = await getDb();
  return db.getAllAsync<Expense>(
    `SELECT expenses.* FROM expenses
     JOIN expense_groups ON expenses.id = expense_groups.expense_id
     WHERE expense_groups.group_id = ?
     ORDER BY expenses.expense_date DESC`,
    groupId,
  );
}

export async function addExpenseToGroup(expenseId: number, groupId: number): Promise<void> {
  if (IS_WEB) {
    const links = await webReadLinks();
    if (links.some((l) => l.expense_id === expenseId && l.group_id === groupId)) return;
    const id = links.reduce((m, l) => Math.max(m, l.id), 0) + 1;
    links.push({ id, expense_id: expenseId, group_id: groupId });
    await webWriteLinks(links);
    return;
  }
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO expense_groups (expense_id, group_id) VALUES (?, ?)",
    expenseId,
    groupId,
  );
}

export async function getExpensesNotInAnyGroup(): Promise<Expense[]> {
  if (IS_WEB) {
    const [links, expenses] = await Promise.all([webReadLinks(), webRead()]);
    const linked = new Set(links.map((l) => l.expense_id));
    return expenses
      .filter((e) => !linked.has(e.id))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  const db = await getDb();
  return db.getAllAsync<Expense>(
    `SELECT * FROM expenses
     WHERE id NOT IN (SELECT expense_id FROM expense_groups)
     ORDER BY created_at DESC`,
  );
}

export async function deleteGroup(id: number): Promise<void> {
  if (IS_WEB) {
    const [groups, links] = await Promise.all([webReadGroups(), webReadLinks()]);
    await webWriteGroups(groups.filter((g) => g.id !== id));
    await webWriteLinks(links.filter((l) => l.group_id !== id));
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM expense_groups WHERE group_id = ?", id);
  await db.runAsync("DELETE FROM groups WHERE id = ?", id);
}
