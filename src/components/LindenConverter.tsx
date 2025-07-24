'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IoSwapHorizontal, IoRefresh } from 'react-icons/io5';
import { useLindenExchange, convertLindenToUSD, formatUSD } from '@/hooks/useLindenExchange';

interface LindenConverterProps {
    initialLinden?: number;
    compact?: boolean;
}

export default function LindenConverter({ initialLinden = 0, compact = false }: LindenConverterProps) {
    const [lindenAmount, setLindenAmount] = useState(initialLinden);
    const { rate, lastUpdated, loading, error } = useLindenExchange();

    const usdAmount = rate > 0 ? convertLindenToUSD(lindenAmount, rate) : 0;

    if (compact) {
        return (
            <div className="inline-flex items-center gap-2 text-sm">
                <span className="text-[var(--accent)] font-bold">L$ {lindenAmount.toLocaleString()}</span>
                {!loading && rate > 0 && (
                    <>
                        <span className="text-muted-foreground">≈</span>
                        <span className="text-green-400 font-semibold">{formatUSD(usdAmount)}</span>
                    </>
                )}
            </div>
        );
    }

    return (
        <Card className="bg-[var(--card)]/60 border border-[var(--accent)]/20 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg text-[var(--accent)] flex items-center gap-2">
                    <IoSwapHorizontal className="w-5 h-5" />
                    Linden Dollar Converter
                </CardTitle>
                {lastUpdated && (
                    <p className="text-xs text-muted-foreground">
                        Rate updated: {lastUpdated}
                    </p>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                {error ? (
                    <div className="text-red-400 text-sm">{error}</div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Linden Dollars (L$)</label>
                            <Input
                                type="number"
                                value={lindenAmount}
                                onChange={(e) => setLindenAmount(Number(e.target.value) || 0)}
                                placeholder="Enter L$ amount"
                                className="bg-background/50 border-[var(--accent)]/30"
                            />
                        </div>

                        <div className="flex items-center justify-center py-2">
                            <IoSwapHorizontal className="w-6 h-6 text-[var(--accent)]" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">US Dollars (USD)</label>
                            <div className="p-3 bg-background/50 border border-[var(--accent)]/30 rounded-md">
                                {loading ? (
                                    <div className="text-muted-foreground">Loading...</div>
                                ) : (
                                    <div className="text-2xl font-bold text-green-400">
                                        {formatUSD(usdAmount)}
                                    </div>
                                )}
                            </div>
                        </div>

                        {rate > 0 && (
                            <div className="text-xs text-muted-foreground text-center">
                                Exchange rate: L$ {rate.toFixed(2)} = $1.00 USD
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}