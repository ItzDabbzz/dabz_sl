'use client';
import { useState, useEffect } from 'react';

interface ExchangeData {
    rate: number;
    lastUpdated: string;
    loading: boolean;
    error: string | null;
}

export function useLindenExchange(): ExchangeData {
    const [data, setData] = useState<ExchangeData>({
        rate: 0,
        lastUpdated: '',
        loading: true,
        error: null
    });

    useEffect(() => {
        const fetchExchangeRate = async () => {
            try {
                const response = await fetch('/api/exchange-rate');
                if (!response.ok) throw new Error('Failed to fetch exchange rate');

                const result = await response.json();
                setData({
                    rate: result.rate,
                    lastUpdated: result.lastUpdated,
                    loading: false,
                    error: null
                });
            } catch (error) {
                setData(prev => ({
                    ...prev,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }));
            }
        };

        fetchExchangeRate();

        // Update every 5 minutes
        const interval = setInterval(fetchExchangeRate, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return data;
}

export function convertLindenToUSD(lindenAmount: number, exchangeRate: number): number {
    return lindenAmount / exchangeRate;
}

export function formatUSD(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}