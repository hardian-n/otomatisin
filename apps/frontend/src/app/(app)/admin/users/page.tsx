'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { AdminNav } from '@gitroom/frontend/components/admin/admin.nav';

type AdminOwner = {
  id: string;
  name?: string | null;
  email: string;
  providerName: string;
  activated: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  lastOnline: string;
  ownerOrgCount: number;
  ownerOrganizations: Array<{ id: string; name: string }>;
};

const formatDate = (value?: string) => {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleDateString();
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString();
};

export default function AdminUsersPage() {
  const fetcher = useFetch();
  const user = useUser();
  const toaster = useToaster();
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [owners, setOwners] = useState<AdminOwner[]>([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = !!(user as any)?.admin;

  const loadOwners = useCallback(async () => {
    setLoading(true);
    try {
      const qs = appliedQuery ? `?q=${encodeURIComponent(appliedQuery)}` : '';
      const res = await fetcher(`/admin/users${qs}`);
      const data = (await res.json()) as AdminOwner[];
      setOwners(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toaster.show(err?.message || 'Failed to load users', 'warning');
      setOwners([]);
    } finally {
      setLoading(false);
    }
  }, [appliedQuery]);

  useEffect(() => {
    loadOwners();
  }, [loadOwners]);

  const hasOwners = useMemo(() => owners.length > 0, [owners]);

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
            <div className="text-[20px] font-[600]">Users</div>
            <div className="text-[12px] text-customColor18">
              Owners are users with SUPERADMIN role in at least one organization.
            </div>
          </div>
          <AdminNav active="users" />
          <div className="flex flex-col sm:flex-row gap-[12px]">
            <Input
              label="Search"
              name="userSearch"
              disableForm={true}
              placeholder="Name, email, or ID"
              value={query}
              onChange={(e: any) => setQuery(e.target.value)}
            />
            <div className="flex gap-[8px] items-end">
              <Button type="button" onClick={() => setAppliedQuery(query.trim())}>
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

        <div className="border border-newTableBorder rounded-[12px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="bg-newBgLineColor text-textColor">
                <tr>
                  <th className="px-[12px] py-[10px] text-left">User</th>
                  <th className="px-[12px] py-[10px] text-left">Email</th>
                  <th className="px-[12px] py-[10px] text-left">Provider</th>
                  <th className="px-[12px] py-[10px] text-left">Status</th>
                  <th className="px-[12px] py-[10px] text-left">Superadmin</th>
                  <th className="px-[12px] py-[10px] text-left">Created</th>
                  <th className="px-[12px] py-[10px] text-left">Last Online</th>
                  <th className="px-[12px] py-[10px] text-left">Owner Orgs</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      className="px-[12px] py-[16px] text-center text-customColor18"
                      colSpan={8}
                    >
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && !hasOwners && (
                  <tr>
                    <td
                      className="px-[12px] py-[16px] text-center text-customColor18"
                      colSpan={8}
                    >
                      No users found.
                    </td>
                  </tr>
                )}
                {owners.map((owner) => (
                  <tr
                    key={owner.id}
                    className={clsx(
                      'border-t border-newTableBorder',
                      'hover:bg-newBgLineColor'
                    )}
                  >
                    <td className="px-[12px] py-[10px]">
                      <div className="font-[600]">
                        {owner.name || 'Unnamed'}
                      </div>
                      <div className="text-[11px] text-customColor18">
                        {owner.id}
                      </div>
                    </td>
                    <td className="px-[12px] py-[10px]">{owner.email}</td>
                    <td className="px-[12px] py-[10px]">{owner.providerName}</td>
                    <td className="px-[12px] py-[10px]">
                      {owner.activated ? 'Active' : 'Disabled'}
                    </td>
                    <td className="px-[12px] py-[10px]">
                      {owner.isSuperAdmin ? 'Yes' : 'No'}
                    </td>
                    <td className="px-[12px] py-[10px]">
                      {formatDate(owner.createdAt)}
                    </td>
                    <td className="px-[12px] py-[10px]">
                      {formatDateTime(owner.lastOnline)}
                    </td>
                    <td className="px-[12px] py-[10px]">
                      {owner.ownerOrgCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
