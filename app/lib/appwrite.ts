import { Client, Account, Databases, ID, Query, Permission, Role } from "appwrite";

const ENDPOINT   = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT   || "https://cloud.appwrite.io/v1";
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "";

export const DB_ID  = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID   || "financial_db";
export const COL_ID = process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID || "user_data";

// ─── Singleton client ────────────────────────────────────────────────────────
let _client:    Client    | null = null;
let _account:   Account   | null = null;
let _databases: Databases | null = null;

function init() {
  if (!PROJECT_ID || _client) return;
  _client    = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
  _account   = new Account(_client);
  _databases = new Databases(_client);
}

export const isConfigured = () => !!PROJECT_ID;
export const getAccount   = () => { init(); return _account; };
export const getDB        = () => { init(); return _databases; };

// ─── Types ───────────────────────────────────────────────────────────────────
export type AppUser  = { $id: string; email: string; name: string };
export type CloudDoc = { $id: string; rawData: string; kas: number };

// ─── Auth helpers ────────────────────────────────────────────────────────────
export async function getCurrentUser(): Promise<AppUser | null> {
  const a = getAccount(); if (!a) return null;
  try   { return (await a.get()) as unknown as AppUser; }
  catch { return null; }
}

export async function loginUser(email: string, password: string): Promise<AppUser> {
  const a = getAccount();
  if (!a) throw new Error("Appwrite belum dikonfigurasi. Set NEXT_PUBLIC_APPWRITE_PROJECT_ID di .env.local");
  await a.createEmailPasswordSession(email, password);
  return (await a.get()) as unknown as AppUser;
}

export async function registerUser(email: string, password: string, name: string): Promise<AppUser> {
  const a = getAccount();
  if (!a) throw new Error("Appwrite belum dikonfigurasi");
  await a.create(ID.unique(), email, password, name);
  await a.createEmailPasswordSession(email, password);
  return (await a.get()) as unknown as AppUser;
}

export async function logoutUser(): Promise<void> {
  const a = getAccount(); if (!a) return;
  try { await a.deleteSession("current"); } catch {}
}

// ─── Data sync ───────────────────────────────────────────────────────────────
export async function loadCloudData(userId: string): Promise<CloudDoc | null> {
  const db = getDB(); if (!db) return null;
  try {
    const r = await db.listDocuments(DB_ID, COL_ID, [Query.equal("userId", userId)]);
    return (r.documents[0] as unknown as CloudDoc) || null;
  } catch { return null; }
}

export async function saveCloudData(
  userId: string,
  rawData: object[],
  kas: number,
  docId?: string,
): Promise<string> {
  const db = getDB();
  if (!db) throw new Error("Appwrite belum dikonfigurasi");
  const payload = { userId, rawData: JSON.stringify(rawData), kas };
  if (docId) {
    const d = await db.updateDocument(DB_ID, COL_ID, docId, payload);
    return d.$id;
  }
  const d = await db.createDocument(DB_ID, COL_ID, ID.unique(), payload, [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ]);
  return d.$id;
}
