export async function fetchKLineData(symbol, interval = '1d', range = '6mo') {
    try {
        let yInterval = interval;
        let yRange = range;
        
        if (interval === '1m') yRange = '7d';
        else if (interval === '5m' || interval === '15m') yRange = '1mo';
        else if (interval === '1h') yRange = '3mo';

        // Check if it's an index (starts with ^) or a special symbol
        let fullSymbol = symbol;
        if (!symbol.startsWith('^') && !symbol.includes('.')) {
            fullSymbol = `${symbol}.TW`;
        }

        let res = await fetch(`/yahoo-api/v8/finance/chart/${fullSymbol}?interval=${yInterval}&range=${yRange}`);
        let data = await res.json();
        let result = data.chart?.result?.[0];
        
        // Fallback for stocks (if .TW fails, try .TWO)
        if ((!result || !result.timestamp) && !symbol.startsWith('^')) {
            fullSymbol = `${symbol}.TWO`;
            res = await fetch(`/yahoo-api/v8/finance/chart/${fullSymbol}?interval=${yInterval}&range=${yRange}`);
            data = await res.json();
            result = data.chart?.result?.[0];
        }

        if (!result || !result.timestamp) return [];

        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];
        const formatted = [];

        const isIntraday = !['1d', '1wk', '1mo'].includes(yInterval);

        for(let i=0; i<timestamps.length; i++) {
            if (quotes.close[i] !== null && quotes.volume[i] !== null) {
                // lightweight-charts takes number timestamp (seconds) for intraday data
                // For day data, it prefers 'YYYY-MM-DD' string
                let timeVal;
                if (isIntraday) {
                    timeVal = timestamps[i];
                } else {
                    const date = new Date(timestamps[i] * 1000);
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                    const dd = String(date.getDate()).padStart(2, '0');
                    timeVal = `${yyyy}-${mm}-${dd}`;
                }

                formatted.push({
                    time: timeVal,
                    open: parseFloat(quotes.open[i].toFixed(2)),
                    high: parseFloat(quotes.high[i].toFixed(2)),
                    low: parseFloat(quotes.low[i].toFixed(2)),
                    close: parseFloat(quotes.close[i].toFixed(2)),
                    volume: quotes.volume[i] || 0
                });
            }
        }
        return formatted;
    } catch (e) {
        console.error("Yahoo Fetch Error:", e);
        return [];
    }
}

export function calculateEMA(data, period) {
    if (data.length === 0) return [];
    const k = 2 / (period + 1);
    let ema = data[0].close;
    return data.map(item => {
        ema = item.close * k + ema * (1 - k);
        return {
            time: item.time,
            value: parseFloat(ema.toFixed(2))
        };
    });
}
