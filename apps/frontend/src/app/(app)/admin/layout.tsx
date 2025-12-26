import { ReactNode } from 'react';
import { LayoutComponent } from '@gitroom/frontend/components/new-layout/layout.component';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <LayoutComponent>{children}</LayoutComponent>;
}
