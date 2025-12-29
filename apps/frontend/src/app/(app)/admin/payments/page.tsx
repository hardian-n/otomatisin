'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Input } from '@gitroom/react/form/input';
import { Select } from '@gitroom/react/form/select';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { AdminNav } from '@gitroom/frontend/components/admin/admin.nav';

type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'EXPIRED';

type PaymentRow = {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  provider?: string | null;
  merchantOrderId?: string | null;
  reference?: string | null;
  paymentMethod?: string | null;
  checkoutUrl?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
  organization?: { id: string; name: string } | null;
  plan?: { id: string; key: string; name: string; price: number; currency: string } | null;
  user?: { id: string; name?: string | null; email: string } | null;
};

type DuitkuSettings = {
  mode: 'SANDBOX' | 'PRODUCTION';
  merchantCode: string;
  apiKey: string;
};

const STATUS_OPTIONS: PaymentStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'CANCELED',
  'EXPIRED',
];

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString();
};

const formatAmount = (amount?: number, currency?: string) => {
  if (amount === undefined || amount === null) {
    return '-';
  }
  const prefix = currency || 'IDR';
  try {
    return `${prefix} ${new Intl.NumberFormat('id-ID').format(amount)}`;
  } catch {
    return `${prefix} ${amount}`;
  }
};

export default function AdminPaymentsPage() {
  const fetcher = useFetch();
  const user = useUser();
  const toaster = useToaster();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PaymentRow | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [skip, setSkip] = useState(0);
  const [take, setTake] = useState(50);
  const [updating, setUpdating] = useState(false);
  const [detailStatus, setDetailStatus] = useState<PaymentStatus>('PENDING');
  const [settings, setSettings] = useState<DuitkuSettings>({
    mode: 'SANDBOX',
    merchantCode: '',
    apiKey: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const isAdmin = !!(user as any)?.admin;

  const ensureOk = async (res: Response, fallback: string) => {
    if (res.ok) return;
    let message = fallback;
    try {
      const data = await res.json();
      if (data?.message) {
        message = data.message;
      }
    } catch {}
    throw new Error(message);
  };

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (orgFilter.trim()) params.set('orgId', orgFilter.trim());
      if (skip) params.set('skip', String(skip));
      if (take) params.set('take', String(take));
      const qs = params.toString();
      const res = await fetcher(`/admin/payments${qs ? `?${qs}` : ''}`);
      const data = (await res.json()) as PaymentRow[];
      setPayments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to load payments', 'warning');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, orgFilter, skip, take]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetcher('/admin/payments/duitku');
      const data = (await res.json()) as Partial<DuitkuSettings>;
      setSettings({
        mode: data?.mode === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
        merchantCode: data?.merchantCode || '',
        apiKey: data?.apiKey || '',
      });
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to load Duitku settings', 'warning');
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (selected?.status) {
      setDetailStatus(selected.status);
    }
  }, [selected]);

  const applyFilters = () => {
    setSkip(0);
    loadPayments();
  };

  const saveStatus = async () => {
    if (!selected) return;
    setUpdating(true);
    try {
      const res = await fetcher(`/admin/payments/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: detailStatus }),
      });
      await ensureOk(res, 'Failed to update payment');
      toaster.show('Payment updated', 'success');
      await loadPayments();
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to update payment', 'warning');
    } finally {
      setUpdating(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetcher('/admin/payments/duitku', {
        method: 'POST',
        body: JSON.stringify({
          mode: settings.mode,
          merchantCode: settings.merchantCode,
          apiKey: settings.apiKey,
        }),
      });
      await ensureOk(res, 'Failed to save settings');
      toaster.show('Duitku settings saved', 'success');
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to save settings', 'warning');
    } finally {
      setSavingSettings(false);
    }
  };

  const pageCountLabel = useMemo(() => {
    const start = skip + 1;
    const end = skip + payments.length;
    if (!payments.length) {
      return '0 results';
    }
    return `${start}-${end}`;
  }, [skip, payments]);

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 bg-newBgColorInner p-[20px]">
        <div className="text-[18px] font-[600]">Admin</div>
        <div className="text-sm text-customColor18 mt-[6px]">
          You do not have access to this page.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-newBgColorInner p-[20px]">
      <div className="flex flex-col gap-[16px]">
        <div className="flex flex-col lg:flex-row lg:items-end gap-[12px]">
          <div className="flex-1">
            <div className="text-[20px] font-[600]">Payments</div>
            <div className="text-[12px] text-customColor18">
              Review payments and update statuses. Pending payments keep the subscription inactive.
            </div>
          </div>
          <AdminNav active="payments" />
          <div className="flex flex-col sm:flex-row gap-[12px]">
            <Select
              label="Status"
              name="statusFilter"
              disableForm={true}
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <Input
              label="Organization ID"
              name="orgFilter"
              disableForm={true}
              placeholder="Organization ID"
              value={orgFilter}
              onChange={(e: any) => setOrgFilter(e.target.value)}
            />
            <div className="flex gap-[8px] items-end">
              <Button type="button" onClick={applyFilters}>
                Search
              </Button>
              <Button
                type="button"
                secondary
                onClick={() => {
                  setStatusFilter('');
                  setOrgFilter('');
                  setSkip(0);
                  loadPayments();
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-[16px]">
          <div className="border border-newTableBorder rounded-[12px] overflow-hidden">
            <div className="flex items-center justify-between px-[12px] py-[10px] border-b border-newTableBorder text-[12px] text-customColor18">
              <div>{pageCountLabel}</div>
              <div className="flex items-center gap-[8px]">
                <Select
                  label="Rows"
                  name="rows"
                  disableForm={true}
                  value={String(take)}
                  onChange={(e: any) => setTake(Number(e.target.value))}
                >
                  {[25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  secondary
                  onClick={() => {
                    setSkip(Math.max(skip - take, 0));
                    loadPayments();
                  }}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  secondary
                  onClick={() => {
                    setSkip(skip + take);
                    loadPayments();
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead className="bg-newBgLineColor text-textColor">
                  <tr>
                    <th className="px-[12px] py-[10px] text-left">Payment</th>
                    <th className="px-[12px] py-[10px] text-left">Organization</th>
                    <th className="px-[12px] py-[10px] text-left">Plan</th>
                    <th className="px-[12px] py-[10px] text-left">Status</th>
                    <th className="px-[12px] py-[10px] text-left">Amount</th>
                    <th className="px-[12px] py-[10px] text-left">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td
                        className="px-[12px] py-[16px] text-center text-customColor18"
                        colSpan={6}
                      >
                        Loading...
                      </td>
                    </tr>
                  )}
                  {!loading && payments.length === 0 && (
                    <tr>
                      <td
                        className="px-[12px] py-[16px] text-center text-customColor18"
                        colSpan={6}
                      >
                        No payments found.
                      </td>
                    </tr>
                  )}
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className={clsx(
                        'border-t border-newTableBorder cursor-pointer hover:bg-newBgLineColor',
                        selected?.id === payment.id && 'bg-newBgLineColor'
                      )}
                      onClick={() => setSelected(payment)}
                    >
                      <td className="px-[12px] py-[10px]">
                        <div className="font-[600]">
                          {payment.id.slice(0, 8)}
                        </div>
                        <div className="text-[11px] text-customColor18">
                          {payment.provider || '-'}
                        </div>
                      </td>
                      <td className="px-[12px] py-[10px]">
                        {payment.organization?.name || '-'}
                      </td>
                      <td className="px-[12px] py-[10px]">
                        {payment.plan?.name || '-'}
                      </td>
                      <td className="px-[12px] py-[10px]">{payment.status}</td>
                      <td className="px-[12px] py-[10px]">
                        {formatAmount(payment.amount, payment.currency)}
                      </td>
                      <td className="px-[12px] py-[10px]">
                        {formatDateTime(payment.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-[16px]">
            <div className="border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[10px]">
              <div className="text-[16px] font-[600]">Payment detail</div>
              {!selected && (
                <div className="text-[12px] text-customColor18">
                  Select a payment to view details.
                </div>
              )}
              {selected && (
                <>
                  <Input
                    label="Organization"
                    name="orgName"
                    disableForm={true}
                    value={selected.organization?.name || ''}
                    readOnly
                  />
                  <Input
                    label="Plan"
                    name="planName"
                    disableForm={true}
                    value={selected.plan?.name || ''}
                    readOnly
                  />
                  <Input
                    label="Amount"
                    name="amount"
                    disableForm={true}
                    value={formatAmount(selected.amount, selected.currency)}
                    readOnly
                  />
                  <Input
                    label="Merchant Order ID"
                    name="merchantOrderId"
                    disableForm={true}
                    value={selected.merchantOrderId || ''}
                    readOnly
                  />
                  <Input
                    label="Reference"
                    name="reference"
                    disableForm={true}
                    value={selected.reference || ''}
                    readOnly
                  />
                  <Input
                    label="Payment method"
                    name="paymentMethod"
                    disableForm={true}
                    value={selected.paymentMethod || ''}
                    readOnly
                  />
                  <Input
                    label="Checkout URL"
                    name="checkoutUrl"
                    disableForm={true}
                    value={selected.checkoutUrl || ''}
                    readOnly
                  />
                  <Input
                    label="Created"
                    name="createdAt"
                    disableForm={true}
                    value={formatDateTime(selected.createdAt)}
                    readOnly
                  />
                  <Input
                    label="Expires"
                    name="expiresAt"
                    disableForm={true}
                    value={formatDateTime(selected.expiresAt || null)}
                    readOnly
                  />
                  <Input
                    label="Paid at"
                    name="paidAt"
                    disableForm={true}
                    value={formatDateTime(selected.paidAt || null)}
                    readOnly
                  />
                  <Select
                    label="Status"
                    name="status"
                    disableForm={true}
                    value={detailStatus}
                    onChange={(e: any) =>
                      setDetailStatus(e.target.value as PaymentStatus)
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                  <Button type="button" onClick={saveStatus} loading={updating}>
                    Update status
                  </Button>
                </>
              )}
            </div>

            <div className="border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[10px]">
              <div className="text-[16px] font-[600]">Duitku settings</div>
              <Select
                label="Mode"
                name="mode"
                disableForm={true}
                value={settings.mode}
                onChange={(e: any) =>
                  setSettings((prev) => ({
                    ...prev,
                    mode: e.target.value === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
                  }))
                }
              >
                <option value="SANDBOX">Sandbox</option>
                <option value="PRODUCTION">Production</option>
              </Select>
              <Input
                label="Merchant Code"
                name="merchantCode"
                disableForm={true}
                value={settings.merchantCode}
                onChange={(e: any) =>
                  setSettings((prev) => ({ ...prev, merchantCode: e.target.value }))
                }
              />
              <Input
                label="API Key"
                name="apiKey"
                disableForm={true}
                type="password"
                value={settings.apiKey}
                onChange={(e: any) =>
                  setSettings((prev) => ({ ...prev, apiKey: e.target.value }))
                }
              />
              <Button type="button" onClick={saveSettings} loading={savingSettings}>
                Save settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
