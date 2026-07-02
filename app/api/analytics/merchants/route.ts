import { getCurrentUser, getTopMerchants } from '@/lib/db';
import type { TopMerchantsOpts } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const params: TopMerchantsOpts = {
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
        accountId: searchParams.get('accountId') ?? undefined,
        limit: searchParams.get('limit')
            ? Number(searchParams.get('limit'))
            : undefined,
    };

    try {
        const user = await getCurrentUser();
        const merchants = await getTopMerchants(user.id, params);

        return Response.json({ top_merchants: merchants }, { status: 200 });
    } catch (e) {
        console.error('Error fetching top merchants', e);
        return Response.json(
            { error: 'Error fetching top merchants' },
            { status: 500 }
        );
    }
}
