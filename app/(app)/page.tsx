'use client';
import axios from 'axios';
import ConnectBankButton from '@/app/components/ConnectBankButton';

export default function Home() {
    return (
        <div className="flex flex-col">
            <ConnectBankButton></ConnectBankButton>
            <button
                onClick={async () => {
                    const response = await axios.get('/api/transactions');
                    console.log(response);
                }}
            >
                Ping
            </button>
        </div>
    );
}
