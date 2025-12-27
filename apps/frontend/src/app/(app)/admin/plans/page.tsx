'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { AdminNav } from '@gitroom/frontend/components/admin/admin.nav';
import { Select } from '@gitroom/react/form/select';

const DEFAULT_LIMIT = 3;

type PlanConfig = {
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

type PlanForm = {
  key: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  durationDays: number;
  trialEnabled: boolean;
  trialDays: number;
  isActive: boolean;
  isDefault: boolean;
  channelLimit: number;
  channelLimitUnlimited: boolean;
  postLimitMonthly: number;
  postLimitMonthlyUnlimited: boolean;
  memberLimit: number;
  memberLimitUnlimited: boolean;
  storageLimitMb: number;
  storageLimitMbUnlimited: boolean;
  inboxLimitMonthly: number;
  inboxLimitMonthlyUnlimited: boolean;
  autoreplyLimit: number;
  autoreplyLimitUnlimited: boolean;
};

const buildDefaultForm = (): PlanForm => ({
  key: '',
  name: '',
  description: '',
  price: 20000,
  currency: 'IDR',
  durationDays: 30,
  trialEnabled: true,
  trialDays: 3,
  isActive: true,
  isDefault: false,
  channelLimit: DEFAULT_LIMIT,
  channelLimitUnlimited: false,
  postLimitMonthly: DEFAULT_LIMIT,
  postLimitMonthlyUnlimited: false,
  memberLimit: DEFAULT_LIMIT,
  memberLimitUnlimited: false,
  storageLimitMb: DEFAULT_LIMIT,
  storageLimitMbUnlimited: false,
  inboxLimitMonthly: DEFAULT_LIMIT,
  inboxLimitMonthlyUnlimited: false,
  autoreplyLimit: DEFAULT_LIMIT,
  autoreplyLimitUnlimited: false,
});

export default function AdminPlansPage() {
  const fetcher = useFetch();
  const user = useUser();
  const toaster = useToaster();
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<PlanConfig | null>(null);
  const [form, setForm] = useState<PlanForm>(buildDefaultForm());

  const isAdmin = !!(user as any)?.admin;

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetcher('/admin/plans');
      const data = (await res.json()) as PlanConfig[];
      const list = Array.isArray(data) ? data : [];
      setPlans(list);
      return list;
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to load plans', 'warning');
      setPlans([]);
      return [] as PlanConfig[];
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
      key: plan.key,
      name: plan.name,
      description: plan.description || '',
      price: plan.price,
      currency: plan.currency || 'IDR',
      durationDays: plan.durationDays,
      trialEnabled: plan.trialEnabled,
      trialDays: plan.trialDays,
      isActive: plan.isActive,
      isDefault: plan.isDefault,
      channelLimit: plan.channelLimit ?? DEFAULT_LIMIT,
      channelLimitUnlimited: plan.channelLimitUnlimited,
      postLimitMonthly: plan.postLimitMonthly ?? DEFAULT_LIMIT,
      postLimitMonthlyUnlimited: plan.postLimitMonthlyUnlimited,
      memberLimit: plan.memberLimit ?? DEFAULT_LIMIT,
      memberLimitUnlimited: plan.memberLimitUnlimited,
      storageLimitMb: plan.storageLimitMb ?? DEFAULT_LIMIT,
      storageLimitMbUnlimited: plan.storageLimitMbUnlimited,
      inboxLimitMonthly: plan.inboxLimitMonthly ?? DEFAULT_LIMIT,
      inboxLimitMonthlyUnlimited: plan.inboxLimitMonthlyUnlimited,
      autoreplyLimit: plan.autoreplyLimit ?? DEFAULT_LIMIT,
      autoreplyLimitUnlimited: plan.autoreplyLimitUnlimited,
    });
  }, []);

  const startNewPlan = useCallback(() => {
    setSelected(null);
    setForm(buildDefaultForm());
  }, []);

  const onSave = useCallback(async () => {
    if (!form.key.trim() || !form.name.trim()) {
      toaster.show('Plan key and name are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        key: form.key.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        currency: form.currency || 'IDR',
        durationDays: Number(form.durationDays),
        trialEnabled: form.trialEnabled,
        trialDays: Number(form.trialDays),
        isActive: form.isActive,
        isDefault: form.isDefault,
        channelLimit: Number(form.channelLimit),
        channelLimitUnlimited: form.channelLimitUnlimited,
        postLimitMonthly: Number(form.postLimitMonthly),
        postLimitMonthlyUnlimited: form.postLimitMonthlyUnlimited,
        memberLimit: Number(form.memberLimit),
        memberLimitUnlimited: form.memberLimitUnlimited,
        storageLimitMb: Number(form.storageLimitMb),
        storageLimitMbUnlimited: form.storageLimitMbUnlimited,
        inboxLimitMonthly: Number(form.inboxLimitMonthly),
        inboxLimitMonthlyUnlimited: form.inboxLimitMonthlyUnlimited,
        autoreplyLimit: Number(form.autoreplyLimit),
        autoreplyLimitUnlimited: form.autoreplyLimitUnlimited,
      };

      if (selected) {
        await fetcher(`/admin/plans/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toaster.show('Plan updated', 'success');
      } else {
        await fetcher('/admin/plans', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toaster.show('Plan created', 'success');
      }

      const list = await loadPlans();
      const next = list.find(
        (plan) => plan.key === payload.key
      );
      if (next) {
        selectPlan(next);
      }
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to save plan', 'warning');
    } finally {
      setSaving(false);
    }
  }, [form, selected, loadPlans]);

  const hasSelection = !!selected;
  const toNumber = (value: any) => (Number.isFinite(value) ? value : 0);

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
              Manage plan limits, pricing, and trial rules. Plans apply when subscriptions are activated.
            </div>
          </div>
          <AdminNav active="plans" />
          <div className="flex gap-[8px]">
            <Button type="button" secondary onClick={startNewPlan}>
              New plan
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-[16px]">
          <div className="border border-newTableBorder rounded-[12px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead className="bg-newBgLineColor text-textColor">
                  <tr>
                    <th className="px-[12px] py-[10px] text-left">Plan</th>
                    <th className="px-[12px] py-[10px] text-left">Price</th>
                    <th className="px-[12px] py-[10px] text-left">Duration</th>
                    <th className="px-[12px] py-[10px] text-left">Trial</th>
                    <th className="px-[12px] py-[10px] text-left">Status</th>
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
                      key={plan.id}
                      className={clsx(
                        'border-t border-newTableBorder cursor-pointer hover:bg-newBgLineColor',
                        selected?.id === plan.id && 'bg-newBgLineColor'
                      )}
                      onClick={() => selectPlan(plan)}
                    >
                      <td className="px-[12px] py-[10px]">
                        <div className="font-[600]">{plan.name}</div>
                        <div className="text-[11px] text-customColor18">
                          {plan.key}
                        </div>
                      </td>
                      <td className="px-[12px] py-[10px]">
                        {plan.currency} {plan.price}
                      </td>
                      <td className="px-[12px] py-[10px]">
                        {plan.durationDays} days
                      </td>
                      <td className="px-[12px] py-[10px]">
                        {plan.trialEnabled ? `${plan.trialDays} days` : 'Off'}
                      </td>
                      <td className="px-[12px] py-[10px]">
                        {plan.isDefault ? 'Default' : plan.isActive ? 'Active' : 'Disabled'}
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
                Create a new plan or select one to edit.
              </div>
            )}
            <Input
              label="Key"
              name="planKey"
              disableForm={true}
              value={form.key}
              readOnly={!!selected}
              onChange={(e: any) =>
                setForm((prev) => ({ ...prev, key: e.target.value }))
              }
            />
            <Input
              label="Name"
              name="planName"
              disableForm={true}
              value={form.name}
              onChange={(e: any) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <Input
              label="Description"
              name="description"
              disableForm={true}
              value={form.description}
              onChange={(e: any) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <Input
                label="Price (IDR)"
                name="price"
                disableForm={true}
                type="number"
                min={0}
                value={toNumber(form.price)}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    price: Number(e.target.value),
                  }))
                }
              />
              <Input
                label="Duration (days)"
                name="durationDays"
                disableForm={true}
                type="number"
                min={1}
                value={toNumber(form.durationDays)}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    durationDays: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <Select
                label="Trial"
                name="trialEnabled"
                disableForm={true}
                value={form.trialEnabled ? 'on' : 'off'}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    trialEnabled: e.target.value === 'on',
                  }))
                }
              >
                <option value="on">Enabled</option>
                <option value="off">Disabled</option>
              </Select>
              <Input
                label="Trial days"
                name="trialDays"
                disableForm={true}
                type="number"
                min={0}
                value={toNumber(form.trialDays)}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    trialDays: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <Select
                label="Status"
                name="isActive"
                disableForm={true}
                value={form.isActive ? 'on' : 'off'}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    isActive: e.target.value === 'on',
                  }))
                }
              >
                <option value="on">Active</option>
                <option value="off">Inactive</option>
              </Select>
              <Select
                label="Default plan"
                name="isDefault"
                disableForm={true}
                value={form.isDefault ? 'yes' : 'no'}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    isDefault: e.target.value === 'yes',
                  }))
                }
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </div>

            <div className="border-t border-newTableBorder pt-[12px] text-[13px] font-[600]">
              Limits
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <Input
                label="Channel limit"
                name="channelLimit"
                disableForm={true}
                type="number"
                min={0}
                disabled={form.channelLimitUnlimited}
                value={toNumber(form.channelLimit)}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    channelLimit: Number(e.target.value),
                  }))
                }
              />
              <Select
                label="Channel unlimited"
                name="channelLimitUnlimited"
                disableForm={true}
                value={form.channelLimitUnlimited ? 'yes' : 'no'}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    channelLimitUnlimited: e.target.value === 'yes',
                  }))
                }
              >
                <option value="no">No</option>
                <option value="yes">Unlimited</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <Input
                label="Post limit / month"
                name="postLimitMonthly"
                disableForm={true}
                type="number"
                min={0}
                disabled={form.postLimitMonthlyUnlimited}
                value={toNumber(form.postLimitMonthly)}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    postLimitMonthly: Number(e.target.value),
                  }))
                }
              />
              <Select
                label="Post unlimited"
                name="postLimitMonthlyUnlimited"
                disableForm={true}
                value={form.postLimitMonthlyUnlimited ? 'yes' : 'no'}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    postLimitMonthlyUnlimited: e.target.value === 'yes',
                  }))
                }
              >
                <option value="no">No</option>
                <option value="yes">Unlimited</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <Input
                label="Member limit"
                name="memberLimit"
                disableForm={true}
                type="number"
                min={0}
                disabled={form.memberLimitUnlimited}
                value={toNumber(form.memberLimit)}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    memberLimit: Number(e.target.value),
                  }))
                }
              />
              <Select
                label="Member unlimited"
                name="memberLimitUnlimited"
                disableForm={true}
                value={form.memberLimitUnlimited ? 'yes' : 'no'}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    memberLimitUnlimited: e.target.value === 'yes',
                  }))
                }
              >
                <option value="no">No</option>
                <option value="yes">Unlimited</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <Input
                label="Storage limit (MB)"
                name="storageLimitMb"
                disableForm={true}
                type="number"
                min={0}
                disabled={form.storageLimitMbUnlimited}
                value={toNumber(form.storageLimitMb)}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    storageLimitMb: Number(e.target.value),
                  }))
                }
              />
              <Select
                label="Storage unlimited"
                name="storageLimitMbUnlimited"
                disableForm={true}
                value={form.storageLimitMbUnlimited ? 'yes' : 'no'}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    storageLimitMbUnlimited: e.target.value === 'yes',
                  }))
                }
              >
                <option value="no">No</option>
                <option value="yes">Unlimited</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <Input
                label="Inbox limit / month"
                name="inboxLimitMonthly"
                disableForm={true}
                type="number"
                min={0}
                disabled={form.inboxLimitMonthlyUnlimited}
                value={toNumber(form.inboxLimitMonthly)}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    inboxLimitMonthly: Number(e.target.value),
                  }))
                }
              />
              <Select
                label="Inbox unlimited"
                name="inboxLimitMonthlyUnlimited"
                disableForm={true}
                value={form.inboxLimitMonthlyUnlimited ? 'yes' : 'no'}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    inboxLimitMonthlyUnlimited: e.target.value === 'yes',
                  }))
                }
              >
                <option value="no">No</option>
                <option value="yes">Unlimited</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              <Input
                label="Autoreply limit"
                name="autoreplyLimit"
                disableForm={true}
                type="number"
                min={0}
                disabled={form.autoreplyLimitUnlimited}
                value={toNumber(form.autoreplyLimit)}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    autoreplyLimit: Number(e.target.value),
                  }))
                }
              />
              <Select
                label="Autoreply unlimited"
                name="autoreplyLimitUnlimited"
                disableForm={true}
                value={form.autoreplyLimitUnlimited ? 'yes' : 'no'}
                onChange={(e: any) =>
                  setForm((prev) => ({
                    ...prev,
                    autoreplyLimitUnlimited: e.target.value === 'yes',
                  }))
                }
              >
                <option value="no">No</option>
                <option value="yes">Unlimited</option>
              </Select>
            </div>

            <div className="flex gap-[8px]">
              <Button type="button" onClick={onSave} loading={saving}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
