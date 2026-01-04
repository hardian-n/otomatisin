'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';

type InvoicePlan = {
  id: string;
  key: string;
  name: string;
};

type InvoiceResponse = {
  pending: boolean;
  amount: number;
  baseAmount?: number | null;
  uniqueCode?: number | null;
  currency: string;
  paymentMethod?: string | null;
  provider?: string | null;
  checkoutUrl?: string | null;
  expiresAt?: string | null;
  plan?: InvoicePlan | null;
};

const formatAmount = (amount: number) => {
  try {
    return new Intl.NumberFormat('id-ID').format(amount);
  } catch {
    return String(amount);
  }
};

const formatUniqueCode = (value?: number | null) => {
  if (value === undefined || value === null) {
    return null;
  }
  return String(value).padStart(3, '0');
};

export default function InvoicePage() {
  const fetch = useFetch();
  const router = useRouter();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);

  const { data: invoice, isLoading } = useSWR<InvoiceResponse>(
    '/billing/invoice',
    load
  );

  if (isLoading || !invoice) {
    return (
      <div className="bg-newBgColorInner flex-1 flex-col flex p-[12px] lg:p-[20px] gap-[12px]">
        <LoadingComponent />
      </div>
    );
  }

  const methodLabel =
    invoice.paymentMethod || invoice.provider || 'payment method';
  const amountLabel = formatAmount(Number(invoice.amount || 0));
  const baseAmountLabel = formatAmount(
    Number(invoice.baseAmount ?? invoice.amount || 0)
  );
  const currencyLabel = invoice.currency || 'IDR';
  const uniqueCodeLabel = formatUniqueCode(invoice.uniqueCode);
  const message = invoice.pending
    ? uniqueCodeLabel
      ? `Maaf, akun anda belum aktif. Silahkan lakukan pembayaran sebesar ${amountLabel} ${currencyLabel} dengan metode pembayaran ${methodLabel}. Nomor unik ${uniqueCodeLabel} sudah termasuk di total transfer.`
      : `Maaf, akun anda belum aktif. Silahkan lakukan pembayaran sebesar ${amountLabel} ${currencyLabel} dengan metode pembayaran ${methodLabel}.`
    : 'Tidak ada tagihan aktif untuk akun anda.';

  const handleOk = () => {
    if (invoice.checkoutUrl) {
      window.location.href = invoice.checkoutUrl;
      return;
    }
    router.push('/billing');
  };

  return (
    <div className="bg-newBgColorInner flex-1 flex-col flex p-[12px] lg:p-[20px] gap-[12px]">
      <div className="bg-newBgColorInner border border-newBgLineColor rounded-[12px] p-[20px] max-w-[720px]">
        <div className="text-[20px] font-[600]">Invoice</div>
        {invoice.plan?.name && (
          <div className="text-textItemBlur mt-[6px]">
            Plan: {invoice.plan.name}
          </div>
        )}
        {invoice.pending && (
          <div className="text-textItemBlur mt-[6px]">
            Total: {amountLabel} {currencyLabel}
            {uniqueCodeLabel && (
              <> (Base {baseAmountLabel} + kode {uniqueCodeLabel})</>
            )}
          </div>
        )}
        <div className="text-textItemBlur mt-[12px]">{message}</div>
        <div className="mt-[20px]">
          <Button onClick={handleOk} className="w-full sm:w-auto">
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
