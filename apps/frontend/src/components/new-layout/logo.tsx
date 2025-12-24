'use client';

import Image from 'next/image';

export const Logo = () => {
  return (
    <div className="mt-[8px]">
      <Image src="/logo.png" width={60} height={60} alt="Logo" />
    </div>
  );
};
