/**
 * 技術指標計算工具
 */

// 1. SMA (Simple Moving Average)
export function calculateSMA(data, period, prop = 'close') {
    if (data.length < period) return [];
    let result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push({ time: data[i].time, value: null });
            continue;
        }
        let sum = 0;
        for (let j = 0; j < period; j++) {
            const val = data[i - j][prop] !== undefined ? data[i - j][prop] : (data[i - j].value ?? 0);
            sum += val;
        }
        result.push({
            time: data[i].time,
            value: parseFloat((sum / period).toFixed(2))
        });
    }
    return result;
}

// 2. EMA (Exponential Moving Average)
export function calculateEMA(data, period, prop = 'close') {
    if (data.length === 0) return [];
    const k = 2 / (period + 1);
    let ema = data[0][prop] !== undefined ? data[0][prop] : (data[0].value ?? 0);
    return data.map(item => {
        const val = item[prop] !== undefined ? item[prop] : (item.value ?? 0);
        ema = val * k + ema * (1 - k);
        return {
            time: item.time,
            value: parseFloat(ema.toFixed(2))
        };
    });
}

// 3. RSI (Relative Strength Index)
export function calculateRSI(data, period = 14) {
    if (data.length <= period) return [];
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const diff = data[i].close - data[i - 1].close;
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i <= period) {
            result.push({ time: data[i].time, value: null });
            continue;
        }
        const diff = data[i].close - data[i - 1].close;
        let gain = diff >= 0 ? diff : 0;
        let loss = diff < 0 ? -diff : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        result.push({
            time: data[i].time,
            value: parseFloat(rsi.toFixed(2))
        });
    }
    return result;
}

// 4. MACD (Moving Average Convergence Divergence)
export function calculateMACD(data, fast = 12, slow = 26, signal = 9) {
    if (data.length < slow) return [];
    
    const fastEma = calculateEMA(data, fast);
    const slowEma = calculateEMA(data, slow);
    
    const macdLine = fastEma.map((item, i) => {
        const slowVal = slowEma[i].value;
        return {
            time: item.time,
            value: item.value - slowVal
        };
    });
    
    // Signal Line is limited to data that has macd values
    const validMacd = macdLine.filter(m => !isNaN(m.value));
    const signalLine = calculateEMA(validMacd, signal);
    
    // Histogram
    const histogram = macdLine.map((m, i) => {
        // Find corresponding signal value
        const sig = signalLine.find(s => s.time === m.time);
        return {
            time: m.time,
            value: sig ? m.value - sig.value : 0
        };
    });
    
    return { macd: macdLine, signal: signalLine, histogram };
}

// 5. Bollinger Bands
export function calculateBollingerBands(data, period = 20, stdDev = 2) {
    if (data.length < period) return [];
    
    const sma = calculateSMA(data, period);
    
    return sma.map((item, i) => {
        if (item.value === null) return { time: item.time, middle: null, upper: null, lower: null };
        
        let sumSqDiff = 0;
        for (let j = 0; j < period; j++) {
            const diff = data[i - j].close - item.value;
            sumSqDiff += diff * diff;
        }
        const sd = Math.sqrt(sumSqDiff / period);
        
        return {
            time: item.time,
            middle: item.value,
            upper: parseFloat((item.value + stdDev * sd).toFixed(2)),
            lower: parseFloat((item.value - stdDev * sd).toFixed(2))
        };
    });
}

// 6. KD (Stochastic Oscillator)
export function calculateKD(data, n = 9, m1 = 3, m2 = 3) {
    if (data.length < n) return [];
    
    let k = 50;
    let d = 50;
    const result = [];
    
    for (let i = 0; i < data.length; i++) {
        if (i < n - 1) {
            result.push({ time: data[i].time, k: null, d: null });
            continue;
        }
        
        const slice = data.slice(i - n + 1, i + 1);
        const lowN = Math.min(...slice.map(b => b.low));
        const highN = Math.max(...slice.map(b => b.high));
        
        const rsv = highN === lowN ? 0 : ((data[i].close - lowN) / (highN - lowN)) * 100;
        
        k = (rsv + (m1 - 1) * k) / m1;
        d = (k + (m2 - 1) * d) / m2;
        
        result.push({
            time: data[i].time,
            k: parseFloat(k.toFixed(2)),
            d: parseFloat(d.toFixed(2))
        });
    }
    return result;
}

// 7. Force Index (力道指標 - 買賣力)
export function calculateForceIndex(data, period = 13) {
    if (data.length < 2) return [];
    
    const rawForce = data.map((item, i) => {
        if (i === 0) return { time: item.time, value: 0 };
        // Force = (Close[i] - Close[i-1]) * Volume[i]
        const force = (item.close - data[i - 1].close) * item.volume;
        return { time: item.time, value: force };
    });

    // Typically smoothed by EMA, using 'value' property here
    return calculateEMA(rawForce, period, 'value');
}

