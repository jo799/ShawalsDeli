import api from '@/lib/api';
import { listQueuedSales, updateQueuedSale, removeQueuedSale } from './queue';
import type { QueuedSale } from './types';

export interface SyncResult {
  synced: number;
  failed: number;
  errors: Array<{ saleId: string; message: string }>;
}

// Processes one queued sale to completion (or as far as it can go). Safe to
// call again on the same sale after a partial failure — if the order half
// already succeeded (serverOrderId is set), this resumes at the payment
// step instead of re-submitting the order. The order and payment endpoints
// both accept client_reference_id and treat a repeat with the same id as
// "already done, here's what you created" rather than creating a duplicate
// — the second layer of protection behind this resume logic, in case two
// sync attempts ever somehow overlap.
async function syncOne(sale: QueuedSale): Promise<void> {
  let orderId = sale.serverOrderId;

  if (!orderId) {
    const { data } = await api.post('/orders', {
      ...sale.orderPayload,
      client_reference_id: sale.id,
    });
    orderId = data.data.id;
    sale.serverOrderId = data.data.id;
    sale.serverOrderNumber = data.data.order_number;
    await updateQueuedSale(sale);
  }

  await api.post(`/orders/${orderId}/payment`, {
    ...sale.paymentPayload,
    client_reference_id: `${sale.id}-payment`,
  });
}

// Processes the whole queue once, in the order sales were originally rung
// up. Stops trying a sale that errors (marks it 'failed' with the reason,
// leaves it queued) but continues on to the rest — one bad sale shouldn't
// block every other one behind it from syncing.
export async function runSync(): Promise<SyncResult> {
  const sales = await listQueuedSales();
  const result: SyncResult = { synced: 0, failed: 0, errors: [] };

  for (const sale of sales) {
    if (sale.status === 'syncing') continue; // guard against re-entrant calls
    sale.status = 'syncing';
    await updateQueuedSale(sale);
    try {
      await syncOne(sale);
      await removeQueuedSale(sale.id);
      result.synced++;
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (e as Error)?.message
        || 'Sync failed';
      sale.status = 'failed';
      sale.lastError = message;
      await updateQueuedSale(sale);
      result.failed++;
      result.errors.push({ saleId: sale.id, message });
    }
  }

  return result;
}