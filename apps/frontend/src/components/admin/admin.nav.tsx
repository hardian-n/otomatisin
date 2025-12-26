'use client';

import Link from 'next/link';
import clsx from 'clsx';

type AdminNavProps = {
  active: 'organizations' | 'users' | 'plans';
};

const items = [
  { key: 'organizations', label: 'Organizations', href: '/admin/organizations' },
  { key: 'users', label: 'Users', href: '/admin/users' },
  { key: 'plans', label: 'Plans', href: '/admin/plans' },
] as const;

export const AdminNav = ({ active }: AdminNavProps) => {
  return (
    <div className="flex flex-wrap gap-[8px]">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={clsx(
            'px-[12px] py-[6px] rounded-[8px] text-[13px] border border-newTableBorder',
            active === item.key
              ? 'bg-newBgLineColor text-textColor'
              : 'text-customColor18 hover:bg-newBgLineColor'
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
};
