export const dynamic = 'force-dynamic';
import { InboxComponent } from '@gitroom/frontend/components/inbox/inbox.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Otomatis.in Inbox' : 'Gitroom Inbox'}`,
  description: '',
};

export default async function InboxPage() {
  return <InboxComponent />;
}
