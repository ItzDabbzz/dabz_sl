import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const response = await fetch('https://api.secondlife.com/datafeeds/homepage.txt', {
            next: { revalidate: 300 } // Cache for 5 minutes
        });

        if (!response.ok) {
            throw new Error('Failed to fetch from SecondLife API');
        }

        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');

        let exchangeRate = 0;
        let lastUpdated = '';

        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('exchange_rate_updated_slt')) {
                const parts = trimmedLine.split('\t');
                if (parts.length > 1) {
                    lastUpdated = parts[1].trim();
                }
            } else if (trimmedLine === 'exchange_rate' || trimmedLine.startsWith('exchange_rate\t')) {
                // Handle case where exchange_rate might be on same line or next line
                if (trimmedLine.includes('\t')) {
                    const parts = trimmedLine.split('\t');
                    if (parts.length > 1) {
                        exchangeRate = parseFloat(parts[1].trim());
                    }
                } else {
                    // If exchange_rate is on its own line, get the next line
                    const currentIndex = lines.indexOf(line);
                    if (currentIndex + 1 < lines.length) {
                        const nextLine = lines[currentIndex + 1].trim();
                        exchangeRate = parseFloat(nextLine);
                    }
                }
            }
        }

        if (!exchangeRate || isNaN(exchangeRate) || exchangeRate <= 0) {
            // Fallback: try to find any line that looks like a number around 250-300 range
            for (const line of lines) {
                const trimmedLine = line.trim();
                const num = parseFloat(trimmedLine);
                if (!isNaN(num) && num > 200 && num < 400) {
                    exchangeRate = num;
                    break;
                }
            }
        }

        if (!exchangeRate || isNaN(exchangeRate) || exchangeRate <= 0) {
            throw new Error(`Exchange rate not found in API response. Raw data: ${text.substring(0, 500)}`);
        }

        return NextResponse.json({
            rate: exchangeRate,
            lastUpdated,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('Exchange rate API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch exchange rate' },
            { status: 500 }
        );
    }
}