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

const formatDate = (value?: string | null) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
};

const toIso = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

type PlanConfig = {
  id: string;
  key: string;
  name: string;
  price: number;
  currency: string;
  durationDays: number;
  trialEnabled: boolean;
  trialDays: number;
  isActive: boolean;
  isDefault: boolean;
};

type SubscriptionSummary = {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELED';
  startsAt: string;
  endsAt?: string | null;
  trialEndsAt?: string | null;
  canceledAt?: string | null;
  plan?: PlanConfig | null;
};

type AdminOrganization = {
  id: string;
  name: string;
  createdAt: string;
  paymentId?: string | null;
  subscription: SubscriptionSummary | null;
  owner?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
  usersCount: number;
};

type SubscriptionForm = {
  planId: string;
  status: SubscriptionSummary['status'];
  endsAt: string;
  trialEndsAt: string;
};

const STATUS_OPTIONS: SubscriptionSummary['status'][] = [
  'PENDING',
  'ACTIVE',
  'TRIAL',
  'EXPIRED',
  'CANCELED',
];

export default function AdminOrganizationsPage() {
  const fetcher = useFetch();
  const user = useUser();
  const toaster = useToaster();
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<AdminOrganization | null>(null);
  const [form, setForm] = useState<SubscriptionForm>({
    planId: '',
    status: 'PENDING',
    endsAt: '',
    trialEndsAt: '',
  });

  const isAdmin = !!(user as any)?.admin;

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      const qs = appliedQuery
        ? `?q=${encodeURIComponent(appliedQuery)}`
        : '';
      const res = await fetcher(`/admin/organizations${qs}`);
      const data = (await res.json()) as AdminOrganization[];
      setOrganizations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to load organizations', 'warning');
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, [appliedQuery]);

  const loadPlans = useCallback(async () => {
    try {
      const res = await fetcher('/admin/plans');
      const data = (await res.json()) as PlanConfig[];
      setPlans(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to load plans', 'warning');
      setPlans([]);
    }
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const defaultPlanId = useMemo(() => {
    const activePlans = plans.filter((plan) => plan.isActive);
    const defaultPlan = activePlans.find((plan) => plan.isDefault) || activePlans[0];
    return defaultPlan?.id || '';
  }, [plans]);

  const updateFormFromOrg = useCallback((org: AdminOrganization | null) => {
    if (!org) {
      setForm({
        planId: defaultPlanId,
        status: 'PENDING',
        endsAt: '',
        trialEndsAt: '',
      });
      return;
    }

    const subscription = org.subscription;
    setForm({
      planId: subscription?.plan?.id || defaultPlanId,
      status: subscription?.status || 'PENDING',
      endsAt: formatDate(subscription?.endsAt),
      trialEndsAt: formatDate(subscription?.trialEndsAt),
    });
  }, [defaultPlanId]);

  const onSelectOrg = useCallback(
    (org: AdminOrganization) => {
      setSelected(org);
      updateFormFromOrg(org);
    },
    [updateFormFromOrg]
  );

  const onSave = useCallback(async () => {
    if (!selected) {
      return;
    }
    setSaving(true);
    try {
      await fetcher(`/admin/organizations/${selected.id}/subscription`, {
        method: 'POST',
        body: JSON.stringify({
          planId: form.planId || undefined,
          status: form.status,
          endsAt: toIso(form.endsAt),
          trialEndsAt: toIso(form.trialEndsAt),
        }),
      });
      toaster.show('Organization updated', 'success');
      await loadOrganizations();
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to update organization', 'warning');
    } finally {
      setSaving(false);
    }
  }, [selected, form, loadOrganizations]);

  const selectedId = selected?.id;
  const hasSelection = !!selectedId;

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
            <div className="text-[20px] font-[600]">Organizations</div>
            <div className="text-[12px] text-customColor18">
              Assign plans and override subscription status per organization.
            </div>
          </div>
          <AdminNav active="organizations" />
          <div className="flex flex-col sm:flex-row gap-[12px]">
            <Input
              label="Search"
              name="orgSearch"
              disableForm={true}
              placeholder="Name or email"
              value={query}
              onChange={(e: any) => setQuery(e.target.value)}
            />
            <div className="flex gap-[8px] items-end">
              <Button
                type="button"
                onClick={() => setAppliedQuery(query.trim())}
              >
                Search
              </Button>
              <Button
                type="button"
                secondary
                onClick={() => {
                  setQuery('');
                  setAppliedQuery('');
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-[16px]">
          <div className="border border-newTableBorder rounded-[12px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead className="bg-newBgLineColor text-textColor">
                  <tr>
                    <th className="px-[12px] py-[10px] text-left">Organization</th>
                    <th className="px-[12px] py-[10px] text-left">Owner</th>
                    <th className="px-[12px] py-[10px] text-left">Plan</th>
                    <th className="px-[12px] py-[10px] text-left">Status</th>
                    <th className="px-[12px] py-[10px] text-left">Ends</th>
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
                  {!loading && organizations.length === 0 && (
                    <tr>
                      <td
                        className="px-[12px] py-[16px] text-center text-customColor18"
                        colSpan={5}
                      >
                        No organizations found.
                      </td>
                    </tr>
                  )}
                  {organizations.map((org) => {
                    const plan = org.subscription?.plan;
                    return (
                      <tr
                        key={org.id}
                        className={clsx(
                          'border-t border-newTableBorder cursor-pointer hover:bg-newBgLineColor',
                          selectedId === org.id && 'bg-newBgLineColor'
                        )}
                        onClick={() => onSelectOrg(org)}
                      >
                        <td className="px-[12px] py-[10px]">
                          <div className="font-[600]">{org.name}</div>
                          <div className="text-[11px] text-customColor18">
                            {org.id}
                          </div>
                        </td>
                        <td className="px-[12px] py-[10px]">
                          <div>{org.owner?.email || '-'}</div>
                          <div className="text-[11px] text-customColor18">
                            {org.owner?.name || ''}
                          </div>
                        </td>
                        <td className="px-[12px] py-[10px]">
                          {plan ? plan.name : '-'}
                        </td>
                        <td className="px-[12px] py-[10px]">
                          {org.subscription?.status || '-'}
                        </td>
                        <td className="px-[12px] py-[10px]">
                          {formatDate(org.subscription?.endsAt) || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[12px]">
            <div className="text-[16px] font-[600]">Subscription</div>
            {!hasSelection && (
              <div className="text-[12px] text-customColor18">
                Select an organization to edit its subscription.
              </div>
            )}
            {hasSelection && (
              <>
                <Input
                  label="Organization"
                  name="orgName"
                  disableForm={true}
                  value={selected?.name || ''}
                  readOnly
                />
                <Select
                  label="Plan"
                  name="planId"
                  disableForm={true}
                  value={form.planId}
                  onChange={(e: any) =>
                    setForm((prev) => ({
                      ...prev,
                      planId: e.target.value,
                    }))
                  }
                >
                  {plans
                    .filter((plan) => plan.isActive)
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({plan.key})
                      </option>
                    ))}
                </Select>
                <Select
                  label="Status"
                  name="status"
                  disableForm={true}
                  value={form.status}
                  onChange={(e: any) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as SubscriptionSummary['status'],
                    }))
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Ends at"
                  name="endsAt"
                  disableForm={true}
                  type="date"
                  value={form.endsAt}
                  onChange={(e: any) =>
                    setForm((prev) => ({
                      ...prev,
                      endsAt: e.target.value,
                    }))
                  }
                />
                <Input
                  label="Trial ends at"
                  name="trialEndsAt"
                  disableForm={true}
                  type="date"
                  value={form.trialEndsAt}
                  onChange={(e: any) =>
                    setForm((prev) => ({
                      ...prev,
                      trialEndsAt: e.target.value,
                    }))
                  }
                />
                <Button
                  type="button"
                  onClick={onSave}
                  loading={saving}
                  disabled={!selected}
                >
                  Save changes
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
