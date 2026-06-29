'use client';

import axios from 'axios';
import { useEffect, useState } from 'react';
import { usePlaidLink, PlaidLinkOptions } from 'react-plaid-link';

export default function ConnectBankButton() {
    const [linkToken, setLinkToken] = useState<string | null>(null);

    const generateToken = async () => {
        const response = await axios.post('/api/create_link_token');
        setLinkToken(response.data.link_token);
    };

    useEffect(() => {
        generateToken();
    }, []);

    const config: PlaidLinkOptions = {
        onSuccess: async (public_token, metadata) => {
            try {
                await axios.post('/api/exchange_access_token', {
                    public_token,
                });
            } catch (e) {
                console.error(e);
            }
        },
        onExit: () => {},
        onEvent: () => {},
        token: linkToken,
    };

    const { open, exit, ready } = usePlaidLink(config);

    return <button onClick={() => open()}>Set Up Bank Auth</button>;
}
