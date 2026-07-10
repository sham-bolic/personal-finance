import SideNavShell from '@/app/components/SideNavShell';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const {
        data: { user: authUser },
    } = await supabase.auth.getUser();
    const user = authUser
        ? {
              email: authUser.email ?? null,
              name: authUser.user_metadata?.name ?? null,
          }
        : null;

    return <SideNavShell user={user}>{children}</SideNavShell>;
}
