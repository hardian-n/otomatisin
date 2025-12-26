'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { AdminNav } from '@gitroom/frontend/components/admin/admin.nav';
import { PricingInnerInterface } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';

type PlanConfig = {
  tier: 'FREE' | 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE';
  visible: boolean;
  pricing: PricingInnerInterface;
};

export default function AdminPlansPage() {
  const fetcher = useFetch();
  const user = useUser();
  const toaster = useToaster();
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<PlanConfig | null>(null);
  const [form, setForm] = useState({
    visible: true,
    channelLimit: 0,
    monthPrice: 0,
    yearPrice: 0,
  });

  const isAdmin = !!(user as any)?.admin;

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetcher('/admin/plans');
      const data = (await res.json()) as PlanConfig[];
      setPlans(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to load plans', 'warning');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const selectPlan = useCallback((plan: PlanConfig) => {
    setSelected(plan);
    setForm({
      visible: plan.visible,
      channelLimit: plan.pricing.channel || 0,
      monthPrice: plan.pricing.month_price,
      yearPrice: plan.pricing.year_price,
    });
  }, []);

  const onSave = useCallback(async () => {
    if (!selected) {
      return;
    }
    setSaving(true);
    try {
      await fetcher(`/admin/plans/${selected.tier}`, {
        method: 'POST',
        body: JSON.stringify({
          visible: form.visible,
          channelLimit: Number(form.channelLimit),
          monthPrice: Number(form.monthPrice),
          yearPrice: Number(form.yearPrice),
        }),
      });
      toaster.show('Plan updated', 'success');
      await loadPlans();
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to update plan', 'warning');
    } finally {
      setSaving(false);
    }
  }, [selected, form, loadPlans]);

  const onReset = useCallback(async () => {
    if (!selected) {
      return;
    }
    setSaving(true);
    try {
      await fetcher(`/admin/plans/${selected.tier}`, {
        method: 'DELETE',
      });
      toaster.show('Plan reset to default', 'success');
      await loadPlans();
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to reset plan', 'warning');
    } finally {
      setSaving(false);
    }
  }, [selected, loadPlans]);

  const hasSelection = !!selected;
  const channelLimitValue = useMemo(
    () => Number.isFinite(form.channelLimit) ? form.channelLimit : 0,
    [form.channelLimit]
  );
  const monthPriceValue = useMemo(
    () => Number.isFinite(form.monthPrice) ? form.monthPrice : 0,
    [form.monthPrice]
  );
  const yearPriceValue = useMemo(
    () => Number.isFinite(form.yearPrice) ? form.yearPrice : 0,
    [form.yearPrice]
  );

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
            <div className="text-[20px] font-[600]">Plans</div>
            <div className="text-[12px] text-customColor18">
              Update pricing and channel limits for new checkouts without changing existing subscriptions.
            </div>
          </div>
          <AdminNav active="plans" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-[16px]">
          <div className="border border-newTableBorder rounded-[12px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead className="bg-newBgLineColor text-textColor">
                  <tr>
                    <th className="px-[12px] py-[10px] text-left">Plan</th>
                    <th className="px-[12px] py-[10px] text-left">Visible</th>
                    <th className="px-[12px] py-[10px] text-left">Channels</th>
                    <th className="px-[12px] py-[10px] text-left">Monthly</th>
                    <th className="px-[12px] py-[10px] text-left">Yearly</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td
                        className="px-[12px] py-[16px] text-center text-customColor18"
                        colSpan={5}
                      >
                        Loading...
                      </td>
                    </tr>
                  )}
                  {!loading && plans.length === 0 && (
                    <tr>
                      <td
                        className="px-[12px] py-[16px] text-center text-customColor18"
                        colSpan={5}
                      >
                        No plans found.
                      </td>
                    </tr>
                  )}
                  {plans.map((plan) => (
                    <tr
                      key={plan.tier}
                      className={clsx(
                        'border-t border-newTableBorder cursor-pointer hover:bg-newBgLineColor',
                        selected?.tier === plan.tier && 'bg-newBgLineColor'
                      )}
                      onClick={() => selectPlan(plan)}
                    >
                      <td className="px-[12px] py-[10px] font-[600]">
                        {plan.tier}
                      </td>
                      <td className="px-[12px] py-[10px]">
                        {plan.visible ? 'Yes' : 'No'}
                      </td>
                      <td className="px-[12px] py-[10px]">
                        {plan.pricing.channel || 0}
                      </td>
                      <td className="px-[12px] py-[10px]">
                        ${plan.pricing.month_price}
                      </td>
                      <td className="px-[12px] py-[10px]">
                        ${plan.pricing.year_price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[12px]">
            <div className="text-[16px] font-[600]">Plan settings</div>
            {!hasSelection && (
              <div className="text-[12px] text-customColor18">
                Select a plan to edit its pricing and visibility.
              </div>
            )}
            {hasSelection && (
              <>
                <Input
                  label="Plan"
                  name="planName"
                  disableForm={true}
                  value={selected?.tier || ''}
                  readOnly
                />
                <Input
                  label="Channel Limit"
                  name="channelLimit"
                  disableForm={true}
                  type="number"
                  min={0}
                  value={channelLimitValue}
                  onChange={(e: any) =>
                    setForm((prev) => ({
                      ...prev,
                      channelLimit: Number(e.target.value),
                    }))
                  }
                />
                <Input
                  label="Monthly Price"
                  name="monthPrice"
                  disableForm={true}
                  type="number"
                  min={0}
                  value={monthPriceValue}
                  onChange={(e: any) =>
                    setForm((prev) => ({
                      ...prev,
                      monthPrice: Number(e.target.value),
                    }))
                  }
                />
                <Input
                  label="Yearly Price"
                  name="yearPrice"
                  disableForm={true}
                  type="number"
                  min={0}
                  value={yearPriceValue}
                  onChange={(e: any) =>
                    setForm((prev) => ({
                      ...prev,
                      yearPrice: Number(e.target.value),
                    }))
                  }
                />
                <div className="flex items-center gap-[8px]">
                  <input
                    id="planVisible"
                    type="checkbox"
                    checked={form.visible}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        visible: e.target.checked,
                      }))
                    }
                  />
                  <label htmlFor="planVisible" className="text-[13px]">
                    Visible to customers
                  </label>
                </div>
                <div className="flex gap-[8px]">
                  <Button
                    type="button"
                    onClick={onSave}
                    loading={saving}
                    disabled={!selected}
                  >
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    secondary
                    onClick={onReset}
                    loading={saving}
                    disabled={!selected}
                  >
                    Reset
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
