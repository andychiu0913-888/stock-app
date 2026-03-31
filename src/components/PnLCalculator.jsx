import { useState, useMemo, useEffect } from 'react';
import './PnLCalculator.css';

export default function PnLCalculator({ selectedPrice }) {
    const [tradeMode, setTradeMode] = useState('long'); // 'long' or 'short'
    const [entryPrice, setEntryPrice] = useState(500);
    const [exitPrice, setExitPrice] = useState(505);
    const [shares, setShares] = useState(1000);
    const [isDayTrade, setIsDayTrade] = useState(false);
    const [discount, setDiscount] = useState(0.28);
    
    const [syncTarget, setSyncTarget] = useState('entry');

    useEffect(() => {
        if (selectedPrice !== null && selectedPrice !== undefined) {
            if (syncTarget === 'entry') {
                setEntryPrice(selectedPrice);
            } else if (syncTarget === 'exit') {
                setExitPrice(selectedPrice);
            }
        }
    }, [selectedPrice]);

    const calculateFee = (price, amt) => {
        const rawFee = price * amt * 0.001425;
        const discounted = rawFee * discount;
        return Math.max(Math.floor(discounted), 20);
    };

    const result = useMemo(() => {
        const pEntry = parseFloat(entryPrice) || 0;
        const pExit = parseFloat(exitPrice) || 0;
        const amt = parseInt(shares, 10) || 0;
        const taxRate = isDayTrade ? 0.0015 : 0.003;
        const feeRate = 0.001425 * discount;

        let entryFee, exitFee, tax, grossPnL, totalCosts, netPnL, breakeven;

        if (tradeMode === 'long') {
            // 做多: 買進 -> 賣出
            entryFee = calculateFee(pEntry, amt);
            exitFee = calculateFee(pExit, amt);
            tax = Math.floor(pExit * amt * taxRate); // 台灣股票賣出才收稅
            grossPnL = (pExit - pEntry) * amt;
            totalCosts = entryFee + exitFee + tax;
            netPnL = grossPnL - totalCosts;
            // Breakeven: pExit * (1 - taxRate - feeRate) = pEntry * (1 + feeRate)
            breakeven = (pEntry * (1 + feeRate)) / (1 - taxRate - feeRate);
        } else {
            // 放空: 賣出 -> 買進
            // 放空(融券/先賣後買) 在賣出時即預先繳交交易稅
            entryFee = calculateFee(pEntry, amt); // 賣出(開倉)手續費
            exitFee = calculateFee(pExit, amt);   // 買回(平倉)手續費
            tax = Math.floor(pEntry * amt * taxRate); // 放空賣出時收稅
            
            // 融券通常還有 融券手續費 (借券費), 通常為萬分之 8 (0.0008)
            const lendingFee = isDayTrade ? 0 : Math.floor(pEntry * amt * 0.0008);
            
            grossPnL = (pEntry - pExit) * amt;
            totalCosts = entryFee + exitFee + tax + lendingFee;
            netPnL = grossPnL - totalCosts;

            // Breakeven: pEntry * (1 - taxRate - feeRate) = pExit * (1 + feeRate) + lendingFee
            // Simplified breakeven (ignores fixed lending fee for curve):
            const adjEntry = pEntry * (1 - taxRate - feeRate) - (lendingFee / amt);
            breakeven = adjEntry / (1 + feeRate);
        }

        return { entryFee, exitFee, tax, grossPnL, totalCosts, netPnL, breakeven };
    }, [tradeMode, entryPrice, exitPrice, shares, isDayTrade, discount]);

    return (
        <div className="pnl-calculator">
            <div className="pnl-header">
                <h3>股票損益試算</h3>
                <div className="trade-mode-toggle">
                    <button 
                        className={tradeMode === 'long' ? 'active active-long' : ''} 
                        onClick={() => setTradeMode('long')}
                    >做多 (Long)</button>
                    <button 
                        className={tradeMode === 'short' ? 'active active-short' : ''} 
                        onClick={() => setTradeMode('short')}
                    >放空 (Short)</button>
                </div>
            </div>
            
            <div className="form-group row-check sync-options">
                <span className="sync-label">滑鼠點擊連動：</span>
                <label>
                    <input type="radio" value="entry" checked={syncTarget === 'entry'} onChange={() => setSyncTarget('entry')} /> {tradeMode === 'long' ? '買價' : '空價'}
                </label>
                <label>
                    <input type="radio" value="exit" checked={syncTarget === 'exit'} onChange={() => setSyncTarget('exit')} /> {tradeMode === 'long' ? '賣價' : '補價'}
                </label>
            </div>

            <div className="form-group">
                <label>{tradeMode === 'long' ? '買進價格 (Entry)' : '放空價格 (Entry)'}</label>
                <input type="number" step="0.5" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} />
            </div>
            <div className="form-group">
                <label>{tradeMode === 'long' ? '賣出價格 (Exit)' : '回補價格 (Exit)'}</label>
                <input type="number" step="0.5" value={exitPrice} onChange={e => setExitPrice(e.target.value)} />
            </div>
            <div className="form-group">
                <label>股數 (1張 = 1000股)</label>
                <input type="number" step="1000" value={shares} onChange={e => setShares(e.target.value)} />
            </div>
            
            <div className="form-group row-check">
                <label>
                    <input type="checkbox" checked={isDayTrade} onChange={e => setIsDayTrade(e.target.checked)} /> 
                    {tradeMode === 'long' ? '現股當沖 (稅 0.15%)' : '當沖交易 (稅 0.15%)'}
                </label>
            </div>
            
            <div className="form-group">
                <label>手續費折讓 (預設 2.8 折 = 0.28)</label>
                <input type="number" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} />
            </div>

            <div className="results">
                <div className="result-row breakeven-row">
                    <span>保本價 (Breakeven)</span>
                    <span className="breakeven-val">{result.breakeven.toFixed(2)}</span>
                </div>
                <div className="result-divider"></div>
                <div className="result-row">
                    <span>{tradeMode === 'long' ? '買進' : '放空'}手續費</span>
                    <span>${result.entryFee.toLocaleString()}</span>
                </div>
                <div className="result-row">
                    <span>{tradeMode === 'long' ? '賣出' : '回補'}手續費</span>
                    <span>${result.exitFee.toLocaleString()}</span>
                </div>
                <div className="result-row">
                    <span>交易稅 ({isDayTrade ? '0.15%' : '0.3%'})</span>
                    <span>${result.tax.toLocaleString()}</span>
                </div>
                <div className="result-divider"></div>
                <div className="result-status">
                    <div className="status-label">淨損益 (Net Profit)</div>
                    <div className={`status-val ${result.netPnL >= 0 ? 'profit' : 'loss'}`}>
                        {result.netPnL >= 0 ? '+' : ''}${result.netPnL.toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    );
}
