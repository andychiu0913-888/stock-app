import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { fetchRealTimeTicks } from '../hooks/useMarketData';
import './TradingChart.css';

export default function TradingChart({ symbol = '2330', data, indicators = {}, onPriceClick, chartType = 'candlestick', extTicks = [] }) {
    console.log('[TradingChart] Rendering with symbol:', symbol);
    const chartContainerRef = useRef();
    const legendRef = useRef();
    const chartRef = useRef(null);
    const mainSeriesRef = useRef(null);
    
    // Using refs for series to clean them up properly
    const seriesRefs = useRef({
        ema: {},
        sma: {},
        bollinger: {},
        rsi: null,
        macd: {},
        kd: {}
    });

    const [liveTicks, setLiveTicks] = useState([]);
    const [stats, setStats] = useState({ buyVol: 0, sellVol: 0, total: 0 });
    const [streak, setStreak] = useState({ direction: null, count: 0, volume: 0 });

    // Merged ticks: Capital API (extTicks) + Yahoo (liveTicks)
    const displayTicks = useMemo(() => {
        if (extTicks && extTicks.length > 0) return extTicks;
        return liveTicks;
    }, [extTicks, liveTicks]);

    const upColor = '#ef5350';
    const downColor = '#26a69a';

    // Sync stats and streak whenever displayTicks changes (Yahoo or Capital)
    useEffect(() => {
        if (!displayTicks || displayTicks.length === 0) return;

        // Update Volume Stats (Buy/Sell)
        const buys = displayTicks.filter(t => t.direction === 'buy').reduce((sum, t) => sum + t.volume, 0);
        const sells = displayTicks.filter(t => t.direction === 'sell').reduce((sum, t) => sum + t.volume, 0);
        setStats({ buyVol: buys, sellVol: sells, total: buys + sells });

        // Update Streak (Consecutive Buy/Sell)
        const latest = displayTicks[0];
        setStreak(prev => {
            if (prev.direction === latest.direction) {
                return { ...prev, count: prev.count + 1, volume: prev.volume + latest.volume };
            } else {
                return { direction: latest.direction, count: 1, volume: latest.volume };
            }
        });
    }, [displayTicks]);

    // Real-time Tick Fetch Logic (Sync with Yahoo fallback)
    useEffect(() => {
        if (!data || data.length === 0) return;
        const currentSymbol = symbol;
        const syncTicks = async () => {
            try {
                const realTicks = await fetchRealTimeTicks(currentSymbol);
                if (realTicks && realTicks.length > 0) {
                    setLiveTicks(realTicks);
                }
            } catch (err) {
                console.error('syncTicks error:', err);
            }
        };
        syncTicks();
        const interval = setInterval(syncTicks, 10000); 
        return () => clearInterval(interval);
    }, [symbol, data]);

    useEffect(() => {
        if (!chartContainerRef.current || !data || data.length === 0) return;

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            layout: {
                background: { type: 'solid', color: '#080a0e' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.2)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.2)' },
            },
            crosshair: { mode: CrosshairMode.Normal },
            rightPriceScale: { 
                borderColor: '#2a2e39',
                scaleMargins: { top: 0.1, bottom: 0.3 }, // Leaves space for oscillators at bottom
            },
            timeScale: {
                borderColor: '#2a2e39',
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 15,
            },
            localization: {
                timeFormatter: (time) => {
                    const date = new Date(typeof time === 'number' ? time * 1000 : time);
                    if (isNaN(date)) return time;
                    const twDate = new Date(date.getTime() + (date.getTimezoneOffset() + 480) * 60000);
                    return twDate.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
                }
            }
        });
        chartRef.current = chart;

        const mainSeries = chartType === 'candlestick' 
            ? chart.addCandlestickSeries({ upColor, downColor, borderDownColor: downColor, borderUpColor: upColor, wickDownColor: downColor, wickUpColor: upColor }) 
            : chart.addAreaSeries({ 
                lineColor: '#2196f3', 
                topColor: 'rgba(33, 150, 243, 0.4)', 
                bottomColor: 'rgba(33, 150, 243, 0)' 
            });
        
        mainSeriesRef.current = mainSeries;

        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
            visible: false,
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        if (chartType === 'candlestick') {
            mainSeries.setData(data);
        } else {
            mainSeries.setData(data.map(d => ({ time: d.time, value: d.close })));
        }

        // Current Price Line
        if (data.length > 0) {
            const currentPrice = data[data.length - 1].close;
            mainSeries.createPriceLine({
                price: currentPrice,
                color: '#ffffff',
                lineWidth: 1,
                lineStyle: 3,
                title: '現價',
                axisLabelVisible: true,
            });
        }

        volumeSeries.setData(data.map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(239, 83, 80, 0.3)' : 'rgba(38, 166, 154, 0.3)'
        })));

        // ── Rendering Indicators ──────────────────────────────────────────────
        const emaColors = { 5: '#ffffff', 10: '#ffeb3b', 20: '#ff4081', 60: '#00bcd4' };
        if (indicators.ema) {
            Object.keys(indicators.ema).forEach(period => {
                const emaLine = chart.addLineSeries({ color: emaColors[period] || '#fff', lineWidth: 1, title: `EMA${period}` });
                emaLine.setData(indicators.ema[period]);
            });
        }

        if (indicators.sma) {
            Object.keys(indicators.sma).forEach(period => {
                const smaLine = chart.addLineSeries({ color: emaColors[period] || '#fff', lineWidth: 1, lineStyle: 2, title: `SMA${period}` });
                smaLine.setData(indicators.sma[period].filter(v => v.value !== null));
            });
        }

        if (indicators.bollinger && indicators.bollinger.upper) {
            const bUpper = chart.addLineSeries({ color: 'rgba(255, 255, 255, 0.3)', lineWidth: 1, lineStyle: 1 });
            const bLower = chart.addLineSeries({ color: 'rgba(255, 255, 255, 0.3)', lineWidth: 1, lineStyle: 1 });
            const bMiddle = chart.addLineSeries({ color: 'rgba(255, 255, 255, 0.5)', lineWidth: 1 });
            
            bUpper.setData(indicators.bollinger.upper);
            bLower.setData(indicators.bollinger.lower);
            bMiddle.setData(indicators.bollinger.middle);
        }

        // Oscillators (Bottom Panes)
        const oscillatorMargins = { top: 0.75, bottom: 0.05 };

        if (indicators.rsi) {
            const rsiSeries = chart.addLineSeries({ 
                color: '#9c27b0', 
                lineWidth: 2, 
                priceScaleId: 'rsi',
                title: 'RSI' 
            });
            rsiSeries.setData(indicators.rsi.filter(v => v.value !== null));
            chart.priceScale('rsi').applyOptions({ scaleMargins: oscillatorMargins, visible: true, borderColor: '#263238' });
            
            // RSI levels
            rsiSeries.createPriceLine({ price: 70, color: 'rgba(239, 83, 80, 0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
            rsiSeries.createPriceLine({ price: 30, color: 'rgba(38, 166, 154, 0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
        }

        if (indicators.macd) {
            const macdSeries = chart.addLineSeries({ color: '#2196f3', lineWidth: 1, priceScaleId: 'macd', title: 'MACD' });
            const signalSeries = chart.addLineSeries({ color: '#ff9800', lineWidth: 1, priceScaleId: 'macd', title: 'Signal' });
            const histSeries = chart.addHistogramSeries({ priceScaleId: 'macd' });

            macdSeries.setData(indicators.macd.macd);
            signalSeries.setData(indicators.macd.signal);
            histSeries.setData(indicators.macd.histogram.map(h => ({
                time: h.time, value: h.value, color: h.value >= 0 ? 'rgba(239, 83, 80, 0.5)' : 'rgba(38, 166, 154, 0.5)'
            })));
            chart.priceScale('macd').applyOptions({ scaleMargins: oscillatorMargins, visible: true });
        }

        if (indicators.kd) {
            const kSeries = chart.addLineSeries({ color: '#ffeb3b', lineWidth: 1, priceScaleId: 'kd', title: 'K' });
            const dSeries = chart.addLineSeries({ color: '#03a9f4', lineWidth: 1, priceScaleId: 'kd', title: 'D' });
            kSeries.setData(indicators.kd.map(v => ({ time: v.time, value: v.k })).filter(v => v.value !== null));
            dSeries.setData(indicators.kd.map(v => ({ time: v.time, value: v.d })).filter(v => v.value !== null));
            chart.priceScale('kd').applyOptions({ scaleMargins: oscillatorMargins, visible: true });
        }

        if (indicators.force) {
            const forceSeries = chart.addHistogramSeries({ 
                priceScaleId: 'force',
                title: '買賣力' 
            });
            forceSeries.setData(indicators.force.map(h => ({
                time: h.time, 
                value: h.value, 
                color: h.value >= 0 ? 'rgba(239, 83, 80, 0.6)' : 'rgba(38, 166, 154, 0.6)'
            })));
            chart.priceScale('force').applyOptions({ scaleMargins: oscillatorMargins, visible: true });
            forceSeries.createPriceLine({ price: 0, color: 'rgba(255, 255, 255, 0.2)', lineWidth: 1, lineStyle: 2 });
        }

        // ── Breakout Signals (突破訊) ──────────────────────────────────────────
        let markers = [];
        
        // 1. Price Multi-period High Breakout (e.g., 20 period)
        if (data.length > 40) {
            for (let i = 20; i < data.length; i++) {
                const prevSlice = data.slice(i - 20, i);
                const maxHigh = Math.max(...prevSlice.map(b => b.high));
                if (data[i].close > maxHigh && data[i-1].close <= maxHigh) {
                    markers.push({
                        time: data[i].time,
                        position: 'belowBar',
                        color: '#ffeb3b',
                        shape: 'arrowUp',
                        text: '高'
                    });
                }
            }
        }

        // 2. Volume Spike (Volume > 2.5x of previous average)
        if (data.length > 21) {
            const lastIdx = data.length - 1;
            const avgVol = data.slice(lastIdx - 20, lastIdx).reduce((a, b) => a + b.volume, 0) / 20;
            if (data[lastIdx].volume > avgVol * 2.5) {
                markers.push({
                    time: data[lastIdx].time,
                    position: 'aboveBar',
                    color: '#ff9800',
                    shape: 'circle',
                    text: '量'
                });
            }
        }

        // 3. Intraday Breakouts (5K High)
        const isIntraday = data.length > 0 && typeof data[0].time === 'number';
        if (isIntraday) {
            const lastCandle = data[data.length - 1];
            const lastDayStart = new Date(lastCandle.time * 1000).setHours(0,0,0,0) / 1000;
            const currentDayBars = data.filter(d => d.time >= lastDayStart);
            
            const interval = data.length > 1 ? data[1].time - data[0].time : 60;
            const barsIn5Min = Math.max(1, Math.floor(300 / interval));
            const firstBars = currentDayBars.slice(0, barsIn5Min);
            
            if (firstBars.length > 0) {
                const h = Math.max(...firstBars.map(b => b.high));
                const l = Math.min(...firstBars.map(b => b.low));
                mainSeries.createPriceLine({ price: h, color: 'rgba(255, 193, 7, 0.4)', lineWidth: 1, title: '5K H' });
                mainSeries.createPriceLine({ price: l, color: 'rgba(3, 169, 244, 0.4)', lineWidth: 1, title: '5K L' });
                
                // Active breakout of 5K High
                if (currentDayBars.length > barsIn5Min) {
                    const current = currentDayBars[currentDayBars.length - 1];
                    const prev = currentDayBars[currentDayBars.length - 2];
                    if (current.close > h && prev.close <= h) {
                        markers.push({ time: current.time, position: 'belowBar', color: '#ef5350', shape: 'arrowUp', text: '5K' });
                    }
                }
            }

            // Time range zoom
            const baseDate = new Date(lastCandle.time * 1000);
            const start900 = new Date(baseDate).setUTCHours(1, 0, 0, 0) / 1000;
            const end1330 = new Date(baseDate).setUTCHours(5, 30, 0, 0) / 1000;
            chart.timeScale().setVisibleRange({ from: start900, to: end1330 });
        }

        if (markers.length > 0) {
            mainSeries.setMarkers(markers.sort((a,b) => a.time - b.time));
        }

        const updateLegend = (point) => {
            const legend = legendRef.current;
            if (!legend) return;
            const date = new Date(typeof point.time === 'number' ? point.time * 1000 : point.time);
            const twTime = isNaN(date) ? point.time : new Date(date.getTime() + (date.getTimezoneOffset() + 480) * 60000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
            const colorClass = point.close >= point.open ? 'up' : 'down';
            legend.innerHTML = `
                <div class="legend-line">
                    <div class="legend-item"><span class="legend-label">時間</span> <span class="legend-value">${twTime}</span></div>
                    <div class="legend-item"><span class="legend-label">收</span> <span class="legend-value ${colorClass}">${point.close.toFixed(2)}</span></div>
                    <div class="legend-item"><span class="legend-label">量</span> <span class="legend-value ${colorClass}">${Math.floor(point.volume).toLocaleString()}</span></div>
                </div>
            `;
        };

        chart.subscribeCrosshairMove(param => {
            if (param.time) {
                const point = data.find(d => d.time === param.time);
                if (point) updateLegend(point);
            }
        });

        const handleResize = () => chart.resize(chartContainerRef.current.clientWidth, chartContainerRef.current.clientHeight);
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data, indicators, onPriceClick, chartType]);


    const buyPercent = stats.total > 0 ? (stats.buyVol / stats.total) * 100 : 50;

    return (
        <div className="chart-and-details">
            <div className="chart-wrapper">
                <div ref={legendRef} className="chart-legend"></div>
                <div ref={chartContainerRef} style={{ width: '100%', height: '100%', cursor: 'crosshair', position: 'relative' }} />
            </div>
            <div className="transaction-list">
                <div className="tx-header">
                    成交明細 ({extTicks.length > 0 ? '群益 API' : 'Yahoo 實時'})
                </div>
                
                <div className="streak-indicator">
                    <div className="streak-label">當沖神器 | 連次量偵測</div>
                    <div className="streak-content">
                        <div className={`streak-badge ${streak.direction === 'buy' ? 'streak-buy' : 'streak-sell'} ${streak.count >= 10 ? 'streak-alert' : ''}`}>
                            <span className="streak-icon">{streak.direction === 'buy' ? '🚀' : '🌊'}</span>
                            <span>{streak.direction === 'buy' ? '連外次' : streak.direction === 'sell' ? '連內次' : '等待中'} {streak.count}</span>
                        </div>
                    </div>
                </div>
                
                <div className="tx-table">
                    <div className="tx-row head">
                        <span>時間</span><span>價格</span><span>單量</span>
                    </div>
                    {displayTicks.map((tx, i) => (
                        <div key={i} className={`tx-row ${tx.direction || ''} ${tx.isLarge ? 'large-order' : ''}`}>
                            <span>{tx.time}</span>
                            <span>{tx.price.toFixed(2)}</span>
                            <span>{tx.volume}</span>
                        </div>
                    ))}
                </div>
                <div className="tx-stats">
                    <div className="stats-row">
                        <span>總量: </span>
                        <strong>{stats.total.toLocaleString()}</strong>
                    </div>
                    <div className="inner-outer-bar">
                        <div className="bar-buy" style={{ width: `${buyPercent}%` }}>{buyPercent.toFixed(0)}%</div>
                        <div className="bar-sell" style={{ width: `${100 - buyPercent}%` }}>{(100 - buyPercent).toFixed(0)}%</div>
                    </div>
                    <div className="stats-label">外盤 (買) / 內盤 (賣)</div>
                </div>
            </div>
        </div>
    );
}
