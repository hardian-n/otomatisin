'use client';
import { FC, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import Link from 'next/link';

export const MenuItem: FC<{
  label: string;
  icon: ReactNode;
  path: string;
  compact?: boolean;
}> = ({ label, icon, path, compact }) => {
  const currentPath = usePathname();
  const isActive = currentPath.indexOf(path) === 0;

  return (
    <Link
      prefetch={true}
      href={path}
      className={clsx(
        compact
          ? 'min-w-[64px] h-[52px] py-[6px] px-[4px] gap-[3px] text-[9px]'
          : 'w-full h-[54px] py-[8px] px-[6px] gap-[4px] text-[10px]',
        'flex flex-col font-[600] items-center justify-center rounded-[12px] hover:text-textItemFocused hover:bg-boxFocused',
        isActive ? 'text-textItemFocused bg-boxFocused' : 'text-textItemBlur'
      )}
    >
      <div>{icon}</div>
      <div className={clsx(compact ? 'text-[9px]' : 'text-[10px]')}>
        {label}
      </div>
    </Link>
  );
};
