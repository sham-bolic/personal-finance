import { getCurrentUser, getItemsByUser } from '@/lib/db';
import type { ItemDTO } from '@/lib/db/types';

export async function GET() {
    try {
        const user = await getCurrentUser();
        const items = await getItemsByUser(user.id);

        const dto: ItemDTO[] = items.map((item) => ({
            id: item.id,
            institutionName: item.institutionName,
            investmentsConsented: item.investmentsConsented,
        }));

        return Response.json({ items: dto }, { status: 200 });
    } catch (e) {
        console.error('Error fetching items', e);
        return Response.json(
            { error: 'Error fetching items' },
            { status: 500 }
        );
    }
}
