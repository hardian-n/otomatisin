'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';

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
  proofUrl?: string | null;
  proofFilename?: string | null;
  proofUploadedAt?: string | null;
  plan?: InvoicePlan | null;
  manual?: {
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
  } | null;
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
  const toaster = useToaster();
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);

  const { data: invoice, isLoading, mutate } = useSWR<InvoiceResponse>(
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
  const amountValue = Number(invoice.amount ?? 0);
  const baseAmountValue = Number(invoice.baseAmount ?? invoice.amount ?? 0);
  const amountLabel = formatAmount(amountValue);
  const baseAmountLabel = formatAmount(baseAmountValue);
  const currencyLabel = invoice.currency || 'IDR';
  const uniqueCodeLabel = formatUniqueCode(invoice.uniqueCode);
  const isManual =
    invoice.provider === 'MANUAL' ||
    invoice.paymentMethod === 'MANUAL_TRANSFER';
  const manual = invoice.manual;
  const message = invoice.pending
    ? uniqueCodeLabel
      ? `Maaf, akun anda belum aktif. Silahkan lakukan pembayaran sebesar ${amountLabel} ${currencyLabel} dengan metode pembayaran ${methodLabel}. Nomor unik ${uniqueCodeLabel} sudah termasuk di total transfer.`
      : `Maaf, akun anda belum aktif. Silahkan lakukan pembayaran sebesar ${amountLabel} ${currencyLabel} dengan metode pembayaran ${methodLabel}.`
    : 'Tidak ada tagihan aktif untuk akun anda.';

  const handleUploadProof = async () => {
    if (!proofFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', proofFile);
      const res = await fetch('/billing/invoice/proof', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        let message = 'Gagal mengunggah bukti transfer';
        try {
          const data = await res.json();
          if (data?.message) {
            message = data.message;
          }
        } catch {}
        throw new Error(message);
      }
      toaster.show('Bukti transfer berhasil dikirim', 'success');
      setProofFile(null);
      await mutate();
    } catch (err: any) {
      toaster.show(err?.message || 'Gagal mengunggah bukti transfer', 'warning');
    } finally {
      setUploading(false);
    }
  };

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
        {invoice.pending && isManual && manual?.bankAccountNumber && (
          <div className="text-textItemBlur mt-[12px]">
            Silahkan kirimkan ke nomor rekening {manual.bankAccountNumber} bank{' '}
            {manual.bankName || '-'} atas nama {manual.bankAccountName || '-'} sejumlah{' '}
            {amountLabel} {currencyLabel}.
          </div>
        )}
        {invoice.pending && isManual && (
          <div className="mt-[16px] border border-newTableBorder rounded-[10px] p-[12px] flex flex-col gap-[10px]">
            <div className="text-[14px] font-[600]">Bukti transfer</div>
            {invoice.proofUrl ? (
              <div className="text-[12px] text-customColor18">
                Bukti sudah diunggah:{' '}
                <a
                  href={invoice.proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {invoice.proofFilename || invoice.proofUrl}
                </a>
              </div>
            ) : (
              <div className="text-[12px] text-customColor18">
                Unggah bukti transfer agar admin dapat memverifikasi pembayaran.
              </div>
            )}
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) =>
                setProofFile(event.target.files?.[0] || null)
              }
              className="text-[12px] text-customColor18"
            />
            <Button
              type="button"
              onClick={handleUploadProof}
              disabled={!proofFile || uploading}
              loading={uploading}
            >
              Kirim bukti transfer
            </Button>
          </div>
        )}
        <div className="mt-[20px]">
          <Button onClick={handleOk} className="w-full sm:w-auto">
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
