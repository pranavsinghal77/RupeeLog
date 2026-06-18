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

export async function addExpense(e: NewExpense): Promise<void> {
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
    return;
  }
  const db = await getDb();
  await db.runAsync(
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
}
