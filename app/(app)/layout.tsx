import SideNav from '@/app/components/SideNav';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const {
        data: { user: authUser },
    } = await supabase.auth.getUser();
    const user = authUser
        ? { email: authUser.email ?? null, name: authUser.user_metadata?.name ?? null }
        : null;

    return (
        <>
            <SideNav user={user} />
            <div className="flex min-h-full flex-1 flex-col pl-56">{children}</div>
        </>
    );
}
