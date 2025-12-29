'use client';

import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button } from '@gitroom/react/form/button';
import { Select } from '@gitroom/react/form/select';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useSWRConfig } from 'swr';
import { useRouter } from 'next/navigation';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';

const FALLBACK_CURRENCY = 'IDR';

type Plan = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  durationDays: number;
  trialEnabled: boolean;
  trialDays: number;
  isActive: boolean;
  isDefault: boolean;
  channelLimit: number | null;
  channelLimitUnlimited: boolean;
  postLimitMonthly: number | null;
  postLimitMonthlyUnlimited: boolean;
  memberLimit: number | null;
  memberLimitUnlimited: boolean;
  storageLimitMb: number | null;
  storageLimitMbUnlimited: boolean;
  inboxLimitMonthly: number | null;
  inboxLimitMonthlyUnlimited: boolean;
  autoreplyLimit: number | null;
  autoreplyLimitUnlimited: boolean;
};

type PaymentMethod = {
  paymentMethod: string;
  paymentName?: string;
  totalFee?: number | string;
  paymentImage?: string;
};

type BillingSubscription = {
  id?: string;
  status?: 'PENDING' | 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELED' | string;
  planId?: string | null;
  plan?: { id: string; key: string; name: string } | null;
  startsAt?: string | Date;
  endsAt?: string | Date | null;
  trialEndsAt?: string | Date | null;
  canceledAt?: string | Date | null;
};

const formatAmount = (amount: number, currency?: string) => {
  const value = Number(amount || 0);
  try {
    const formatted = new Intl.NumberFormat('id-ID').format(value);
    return `${currency || FALLBACK_CURRENCY} ${formatted}`;
  } catch {
    return `${currency || FALLBACK_CURRENCY} ${value}`;
  }
};

const formatLimit = (value: number | null, unlimited: boolean) => {
  if (unlimited) {
    return 'Unlimited';
  }
  return String(value ?? 0);
};

const buildLimitRows = (plan: Plan) => {
  return [
    {
      label: 'Channels',
      value: formatLimit(plan.channelLimit, plan.channelLimitUnlimited),
    },
    {
      label: 'Posts per month',
      value: formatLimit(plan.postLimitMonthly, plan.postLimitMonthlyUnlimited),
    },
    {
      label: 'Members',
      value: formatLimit(plan.memberLimit, plan.memberLimitUnlimited),
    },
    {
      label: 'Storage (MB)',
      value: formatLimit(plan.storageLimitMb, plan.storageLimitMbUnlimited),
    },
    {
      label: 'Inbox per month',
      value: formatLimit(plan.inboxLimitMonthly, plan.inboxLimitMonthlyUnlimited),
    },
    {
      label: 'Autoreply',
      value: formatLimit(plan.autoreplyLimit, plan.autoreplyLimitUnlimited),
    },
  ];
};

export const MainBillingComponent: FC<{ sub?: BillingSubscription }> = (props) => {
  const { sub } = props;
  const fetch = useFetch();
  const toast = useToaster();
  const user = useUser();
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const subscription: BillingSubscription | undefined = sub || user?.subscription || undefined;
  const currentPlanId =
    subscription?.planId || subscription?.plan?.id || user?.plan?.id || null;

  const isPending = subscription?.status === 'PENDING';

  const loadPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res = await fetch('/billing/plans');
      const data = await res.json();
      const list = Array.isArray(data?.plans) ? (data.plans as Plan[]) : [];
      setPlans(list);
    } catch {
      toast.show('Failed to load plans');
      setPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (!plans.length) {
      return;
    }
    const preferred =
      plans.find((plan) => plan.id === currentPlanId) ||
      plans.find((plan) => plan.isDefault) ||
      plans[0];
    if (preferred && selectedPlanId !== preferred.id) {
      setSelectedPlanId(preferred.id);
    }
  }, [plans, currentPlanId]);

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.id === selectedPlanId) || null;
  }, [plans, selectedPlanId]);

  useEffect(() => {
    let active = true;
    const loadMethods = async () => {
      if (!selectedPlan || selectedPlan.price <= 0) {
        setMethods([]);
        setPaymentMethod('');
        return;
      }
      setLoadingMethods(true);
      try {
        const res = await fetch(
          `/billing/duitku/methods?planId=${selectedPlan.id}`
        );
        const data = await res.json();
        const list = Array.isArray(data?.methods)
          ? (data.methods as PaymentMethod[])
          : [];
        if (active) {
          setMethods(list);
          setPaymentMethod(list[0]?.paymentMethod || '');
        }
      } catch {
        if (active) {
          setMethods([]);
          setPaymentMethod('');
          toast.show('Failed to load payment methods');
        }
      } finally {
        if (active) {
          setLoadingMethods(false);
        }
      }
    };

    loadMethods();
    return () => {
      active = false;
    };
  }, [selectedPlanId, selectedPlan?.price]);

  const handleSubscribe = useCallback(async () => {
    if (!selectedPlan) {
      return;
    }

    if (selectedPlan.price > 0 && !paymentMethod) {
      toast.show('Select a payment method first');
      return;
    }

    const returnUrl =
      typeof window !== 'undefined' ? window.location.origin : undefined;

    setSubmitting(true);
    try {
      const res = await fetch('/billing/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          planKey: selectedPlan.key,
          paymentMethod: selectedPlan.price > 0 ? paymentMethod : undefined,
          returnUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Failed to subscribe');
      }

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      toast.show('Plan updated successfully');
      await mutate('/user/self');
      router.refresh();
    } catch (err: any) {
      toast.show(err?.message || 'Failed to subscribe');
    } finally {
      setSubmitting(false);
    }
  }, [selectedPlan, paymentMethod]);

  if (loadingPlans) {
    return <LoadingComponent />;
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[6px]">
        <div className="text-[20px] font-[600]">Billing</div>
        <div className="text-[13px] text-customColor18">
          Manage your plan and payment method.
        </div>
      </div>

      {isPending && (
        <div className="bg-sixth border border-customColor6 rounded-[8px] p-[12px] text-[13px] flex flex-col gap-[10px]">
          <div>
            Your subscription is pending. Complete payment to activate your
            plan.
          </div>
          <div>
            <Button
              className="w-full sm:w-auto"
              onClick={() => router.push('/billing/invoice')}
            >
              Go to invoice
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-[12px] lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isSelected = plan.id === selectedPlanId;
          const priceLabel =
            plan.price <= 0
              ? 'Free'
              : `${formatAmount(plan.price, plan.currency)} / ${plan.durationDays} days`;
          const trialLabel = plan.trialEnabled
            ? `${plan.trialDays} day trial`
            : 'No trial';
          return (
            <button
              key={plan.id}
              type="button"
              className={clsx(
                'text-left bg-sixth border rounded-[10px] p-[14px] flex flex-col gap-[10px] transition',
                isSelected ? 'border-customColor7' : 'border-customColor6'
              )}
              onClick={() => setSelectedPlanId(plan.id)}
            >
              <div className="flex items-center justify-between gap-[10px]">
                <div className="text-[16px] font-[600]">{plan.name}</div>
                {plan.isDefault && (
                  <span className="text-[11px] bg-newBgColorInner px-[8px] py-[2px] rounded-full">
                    Default
                  </span>
                )}
              </div>
              <div className="text-[20px]">{priceLabel}</div>
              <div className="text-[12px] text-customColor18">{trialLabel}</div>
              {plan.description && (
                <div className="text-[12px] text-customColor18">
                  {plan.description}
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-[12px] gap-y-[6px] text-[12px] text-customColor18">
                {buildLimitRows(plan).map((row) => (
                  <div key={row.label} className="flex justify-between gap-[6px]">
                    <span>{row.label}</span>
                    <span className="text-white">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="pt-[6px]">
                <Button
                  type="button"
                  disabled={isCurrent}
                  className={clsx(isCurrent && '!bg-newBgColorInner')}
                >
                  {isCurrent ? 'Current plan' : 'Select plan'}
                </Button>
              </div>
            </button>
          );
        })}
      </div>

      {selectedPlan && (
        <div className="bg-sixth border border-customColor6 rounded-[10px] p-[16px] flex flex-col gap-[12px]">
          <div className="text-[16px] font-[600]">Selected plan</div>
          <div className="text-[14px]">
            {selectedPlan.name} ({selectedPlan.key})
          </div>
          <div className="text-[13px] text-customColor18">
            {selectedPlan.price <= 0
              ? 'This plan is free and can be activated immediately.'
              : 'Choose a payment method to continue.'}
          </div>

          {selectedPlan.price > 0 && (
            <div className="grid gap-[12px]">
              <Select
                label="Payment method"
                name="paymentMethod"
                disableForm={true}
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                <option value="">
                  {loadingMethods ? 'Loading methods...' : 'Select a method'}
                </option>
                {methods.map((method) => (
                  <option key={method.paymentMethod} value={method.paymentMethod}>
                    {method.paymentName || method.paymentMethod}
                  </option>
                ))}
              </Select>
              {methods.length === 0 && !loadingMethods && (
                <div className="text-[12px] text-customColor18">
                  Payment methods are not available. Check Duitku settings in
                  admin.
                </div>
              )}
            </div>
          )}

          <div>
            <Button
              onClick={handleSubscribe}
              loading={submitting}
              disabled={selectedPlan.price > 0 && !paymentMethod}
              className="w-full sm:w-auto"
            >
              {selectedPlan.price <= 0
                ? 'Activate plan'
                : 'Continue to payment'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
