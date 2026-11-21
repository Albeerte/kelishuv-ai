import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppData } from "./types";
import { hashPassword, seedData } from "./seed";
import { isCriminal } from "./legal";
import { PrismaClient, type Prisma } from "@prisma/client";

const directory = path.join(process.cwd(), ".data");
const storePath = path.join(directory, "medimatch.enc");
const state = globalThis as typeof globalThis & {
  mmQueue?: Promise<unknown>;
  mmPrisma?: PrismaClient;
};
export const LOCAL_DEMO =
  (process.env.LOCAL_DEMO !== "false" &&
    process.env.NODE_ENV !== "production") ||
  process.env.LOCAL_DEMO === "true";

export function encryptionKey(): Buffer {
  if (process.env.DATA_ENCRYPTION_KEY) {
    const key = Buffer.from(process.env.DATA_ENCRYPTION_KEY, "hex");
    if (key.length !== 32)
      throw new Error(
        "DATA_ENCRYPTION_KEY must contain 64 hexadecimal characters",
      );
    return key;
  }
  mkdirSync(directory, { recursive: true });
  const keyPath = path.join(directory, "encryption.key");
  if (!existsSync(keyPath)) {
    try {
      writeFileSync(keyPath, randomBytes(32), { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (!existsSync(keyPath)) throw error;
    }
  }
  return readFileSync(keyPath);
}

export function encrypt(data: Buffer | string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}
export function decrypt(data: Buffer): Buffer {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    data.subarray(0, 12),
  );
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]);
}
function prisma() {
  return (state.mmPrisma ??= new PrismaClient());
}
function decodeState(contents: Buffer): AppData {
  const data: AppData = JSON.parse(decrypt(contents).toString());
  data.payments ??= [];
  data.agreements ??= [];
  data.audit ??= [];
  data.complaints ??= [];
  for (const user of data.users) {
    if (user.mediatorApplication && !user.mediatorApplication.revision)
      user.mediatorApplication.revision = createHash("sha256")
        .update(JSON.stringify(user.mediatorApplication))
        .digest("hex");
  }
  for (const record of data.cases)
    record.analysis.criminal ||= isCriminal(record.description);
  if (LOCAL_DEMO && !data.users.some((user) => user.id === "demo-respondent")) {
    data.users.push({
      id: "demo-respondent",
      fullName: "Ikkinchi taraf (namuna)",
      email: "demo-respondent@demo.medimatch.uz",
      phone: "",
      region: "Toshkent shahri",
      city: "Toshkent",
      role: "CITIZEN",
      passwordHash: "",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }
  for (const mediator of data.mediators) {
    if (mediator.demo && !mediator.city)
      mediator.city = mediator.id === "mediator-3" ? "Samarqand" : "Toshkent";
  }
  return data;
}
async function readData(database?: Prisma.TransactionClient): Promise<AppData> {
  if (process.env.DATABASE_URL) {
    const record = await (database || prisma()).appState.findUnique({
      where: { id: "main" },
    });
    if (record) return decodeState(Buffer.from(record.payload, "base64"));
  } else if (existsSync(storePath))
    return decodeState(await readFile(storePath));
  const data = seedData();
  if (!LOCAL_DEMO) {
    data.users = [];
    data.cases = [];
    data.sessions = [];
    data.notifications = [];
    data.mediators = [];
    if (process.env.INITIAL_ADMIN_EMAIL && process.env.INITIAL_ADMIN_PASSWORD) {
      if (process.env.INITIAL_ADMIN_PASSWORD.length < 12)
        throw new Error(
          "The initial administrator password must contain at least 12 characters",
        );
      data.users.push({
        id: randomUUID(),
        fullName: "Administrator",
        email: process.env.INITIAL_ADMIN_EMAIL.toLowerCase(),
        phone: "",
        region: "Toshkent shahri",
        role: "ADMIN",
        isActive: true,
        createdAt: new Date().toISOString(),
        passwordHash: hashPassword(process.env.INITIAL_ADMIN_PASSWORD),
      });
    }
  }
  await saveData(data, database);
  return data;
}
async function saveData(data: AppData, database?: Prisma.TransactionClient) {
  const encrypted = encrypt(JSON.stringify(data));
  if (process.env.DATABASE_URL) {
    await (database || prisma()).appState.upsert({
      where: { id: "main" },
      create: { id: "main", payload: encrypted.toString("base64") },
      update: { payload: encrypted.toString("base64") },
    });
    return;
  }
  mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, `${randomUUID()}.tmp`);
  await writeFile(temporary, encrypted, { mode: 0o600 });
  await rename(temporary, storePath);
}
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  // Local file storage serves one loopback application process. PostgreSQL coordinates instances below.
  const result = (state.mmQueue ?? Promise.resolve()).then(
    operation,
    operation,
  );
  state.mmQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
export function readStore() {
  return serialized(() => withDatabaseLock(readData));
}
async function withDatabaseLock<T>(
  operation: (database?: Prisma.TransactionClient) => Promise<T>,
) {
  if (!process.env.DATABASE_URL) return operation();
  return prisma().$transaction(
    async (database) => {
      await database.$queryRaw`SELECT pg_advisory_xact_lock(2345001)::text`;
      return operation(database);
    },
    { maxWait: 10000, timeout: 15000 },
  );
}
export function mutateStore<T>(operation: (data: AppData) => T): Promise<T> {
  return serialized(() =>
    withDatabaseLock(async (database) => {
      const data = await readData(database);
      const result = operation(data);
      await saveData(data, database);
      return result;
    }),
  );
}
