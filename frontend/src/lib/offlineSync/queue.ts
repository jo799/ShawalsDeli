import { dbPut, dbGetAll, dbDelete, QUEUE_STORE } from './db';
import type { QueuedSale } from './types';

function generateId(): string {
  // crypto.randomUUID is available in every browser this app already
  // targets (same one used elsewhere in this codebase); no extra
  // dependency needed for a client-generated idempotency key.
  return crypto.randomUUID();
}

export async function enqueueSale(
  orderPayload: QueuedSale['orderPayload'],
  paymentPayload: QueuedSale['paymentPayload']
): Promise<QueuedSale> {
  const sale: QueuedSale = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    orderPayload,
    paymentPayload,
  };
  await dbPut(QUEUE_STORE, sale);
  return sale;
}

export async function listQueuedSales(): Promise<QueuedSale[]> {
  const sales = await dbGetAll<QueuedSale>(QUEUE_STORE);
  return sales.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateQueuedSale(sale: QueuedSale): Promise<void> {
  await dbPut(QUEUE_STORE, sale);
}

export async function removeQueuedSale(id: string): Promise<void> {
  await dbDelete(QUEUE_STORE, id);
}