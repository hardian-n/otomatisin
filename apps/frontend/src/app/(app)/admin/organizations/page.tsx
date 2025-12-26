'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Input } from '@gitroom/react/form/input';
import { Select } from '@gitroom/react/form/select';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { AdminNav } from '@gitroom/frontend/components/admin/admin.nav';

type SubscriptionSummary = {
  subscriptionTier: 'FREE' | 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE';
  totalChannels: number;
  period: 'MONTHLY' | 'YEARLY';
  isLifetime: boolean;
  cancelAt?: string | null;
};

type AdminOrganization = {
  id: string;
  name: string;
  createdAt: string;
  allowTrial: boolean;
  isTrailing: boolean;
  paymentId?: string | null;
  subscription: SubscriptionSummary | null;
  owner?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
  usersCount: number;
};

const tierOptions = Object.keys(pricing) as SubscriptionSummary['subscriptionTier'][];

export default function AdminOrganizationsPage() {
  const fetcher = useFetch();
  const user = useUser();
  const toaster = useToaster();
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [globalTrialEnabled, setGlobalTrialEnabled] = useState(true);
  const [globalTrialLoading, setGlobalTrialLoading] = useState(false);
  const [globalTrialSaving, setGlobalTrialSaving] = useState(false);
  const [selected, setSelected] = useState<AdminOrganization | null>(null);
  const [form, setForm] = useState({
    subscriptionTier: 'FREE' as SubscriptionSummary['subscriptionTier'],
    totalChannels: 0,
    period: 'MONTHLY' as SubscriptionSummary['period'],
    isLifetime: false,
    allowTrial: false,
    isTrailing: false,
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

  const loadGlobalTrial = useCallback(async () => {
    setGlobalTrialLoading(true);
    try {
      const res = await fetcher('/admin/settings/trial');
      const data = (await res.json()) as { enabled?: boolean };
      setGlobalTrialEnabled(!!data?.enabled);
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to load global trial', 'warning');
    } finally {
      setGlobalTrialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    loadGlobalTrial();
  }, [loadGlobalTrial]);

  const updateFormFromOrg = useCallback((org: AdminOrganization | null) => {
    if (!org) {
      setForm({
        subscriptionTier: 'FREE',
        totalChannels: pricing.FREE.channel || 0,
        period: 'MONTHLY',
        isLifetime: false,
        allowTrial: false,
        isTrailing: false,
      });
      return;
    }

    const tier = org.subscription?.subscriptionTier || 'FREE';
    const defaultChannels = pricing[tier]?.channel || 0;
    setForm({
      subscriptionTier: tier,
      totalChannels: org.subscription?.totalChannels ?? defaultChannels,
      period: org.subscription?.period || 'MONTHLY',
      isLifetime: org.subscription?.isLifetime ?? false,
      allowTrial: org.allowTrial,
      isTrailing: org.isTrailing,
    });
  }, []);

  const onSelectOrg = useCallback(
    (org: AdminOrganization) => {
      setSelected(org);
      updateFormFromOrg(org);
    },
    [updateFormFromOrg]
  );

  const onTierChange = useCallback(
    (value: SubscriptionSummary['subscriptionTier']) => {
      const defaultChannels = pricing[value]?.channel || 0;
      setForm((prev) => ({
        ...prev,
        subscriptionTier: value,
        totalChannels: defaultChannels,
      }));
    },
    []
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
          subscriptionTier: form.subscriptionTier,
          totalChannels: Number(form.totalChannels),
          period: form.period,
          isLifetime: form.isLifetime,
          allowTrial: form.allowTrial,
          isTrailing: form.isTrailing,
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

  const onToggleGlobalTrial = useCallback(async () => {
    const nextValue = !globalTrialEnabled;
    setGlobalTrialSaving(true);
    try {
      await fetcher('/admin/settings/trial', {
        method: 'POST',
        body: JSON.stringify({ enabled: nextValue }),
      });
      setGlobalTrialEnabled(nextValue);
      toaster.show(
        nextValue
          ? 'Global trial enabled'
          : 'Global trial disabled and all trials stopped',
        'success'
      );
      await loadOrganizations();
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to update global trial', 'warning');
    } finally {
      setGlobalTrialSaving(false);
    }
  }, [globalTrialEnabled, loadOrganizations]);

  const selectedId = selected?.id;
  const hasSelection = !!selectedId;
  const totalChannelsValue = useMemo(
    () => Number.isFinite(form.totalChannels) ? form.totalChannels : 0,
    [form.totalChannels]
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
            <div className="text-[20px] font-[600]">Organizations</div>
            <div className="text-[12px] text-customColor18">
              Manage subscription tiers per organization without changing the existing flow.
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

        <div className="border border-newTableBorder rounded-[12px] p-[12px] flex flex-col md:flex-row md:items-center md:justify-between gap-[12px]">
          <div>
            <div className="text-[14px] font-[600]">Global Trial</div>
            <div className="text-[12px] text-customColor18">
              When disabled, all organization trials are turned off and new orgs cannot start a trial.
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-[12px]">
            <div className="text-[13px]">
              Status:{' '}
              <span className="font-[600]">
                {globalTrialLoading
                  ? 'Loading...'
                  : globalTrialEnabled
                    ? 'Enabled'
                    : 'Disabled'}
              </span>
            </div>
            <Button
              type="button"
              secondary={globalTrialEnabled}
              loading={globalTrialSaving}
              disabled={globalTrialLoading}
              onClick={onToggleGlobalTrial}
            >
              {globalTrialEnabled ? 'Disable trial' : 'Enable trial'}
            </Button>
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
                    <th className="px-[12px] py-[10px] text-left">Tier</th>
                    <th className="px-[12px] py-[10px] text-left">Channels</th>
                    <th className="px-[12px] py-[10px] text-left">Trial</th>
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
                    const tier = org.subscription?.subscriptionTier || 'FREE';
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
                        <td className="px-[12px] py-[10px]">{tier}</td>
                        <td className="px-[12px] py-[10px]">
                          {org.subscription?.totalChannels ?? 0}
                        </td>
                        <td className="px-[12px] py-[10px]">
                          {org.allowTrial ? 'Allowed' : 'No'}
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
                  label="Tier"
                  name="subscriptionTier"
                  disableForm={true}
                  value={form.subscriptionTier}
                  onChange={(e: any) =>
                    onTierChange(
                      e.target.value as SubscriptionSummary['subscriptionTier']
                    )
                  }
                >
                  {tierOptions.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Total Channels"
                  name="totalChannels"
                  disableForm={true}
                  type="number"
                  min={0}
                  value={totalChannelsValue}
                  onChange={(e: any) =>
                    setForm((prev) => ({
                      ...prev,
                      totalChannels: Number(e.target.value),
                    }))
                  }
                />
                <Select
                  label="Billing Period"
                  name="period"
                  disableForm={true}
                  value={form.period}
                  onChange={(e: any) =>
                    setForm((prev) => ({
                      ...prev,
                      period: e.target.value as SubscriptionSummary['period'],
                    }))
                  }
                >
                  <option value="MONTHLY">MONTHLY</option>
                  <option value="YEARLY">YEARLY</option>
                </Select>
                <div className="flex items-center gap-[8px]">
                  <input
                    id="isLifetime"
                    type="checkbox"
                    checked={form.isLifetime}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        isLifetime: e.target.checked,
                      }))
                    }
                  />
                  <label htmlFor="isLifetime" className="text-[13px]">
                    Lifetime subscription
                  </label>
                </div>
                <div className="flex items-center gap-[8px]">
                  <input
                    id="allowTrial"
                    type="checkbox"
                    checked={form.allowTrial}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        allowTrial: e.target.checked,
                      }))
                    }
                  />
                  <label htmlFor="allowTrial" className="text-[13px]">
                    Allow trial
                  </label>
                </div>
                <div className="flex items-center gap-[8px]">
                  <input
                    id="isTrailing"
                    type="checkbox"
                    checked={form.isTrailing}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        isTrailing: e.target.checked,
                      }))
                    }
                  />
                  <label htmlFor="isTrailing" className="text-[13px]">
                    On trial
                  </label>
                </div>
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
