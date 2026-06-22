import { storage } from "@/src/utils/storage";

const KEY = "rupeelog_templates";
export const TEMPLATE_LIMIT = 5;

export interface Template {
  id: string;
  title: string;
  amount: number;
  category: string;
  paymentMethod: string;
  createdAt: string;
}

export async function getTemplates(): Promise<Template[]> {
  const raw = await storage.getItem<string>(KEY, "");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Template[];
  } catch {
    return [];
  }
}

async function write(list: Template[]): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(list));
}

// Returns false when the free limit is already reached.
export async function addTemplate(t: Omit<Template, "id" | "createdAt">): Promise<boolean> {
  const list = await getTemplates();
  if (list.length >= TEMPLATE_LIMIT) return false;
  list.push({ ...t, id: Date.now().toString(), createdAt: new Date().toISOString() });
  await write(list);
  return true;
}

export async function deleteTemplate(id: string): Promise<void> {
  const list = await getTemplates();
  await write(list.filter((t) => t.id !== id));
}
