import { useMarketData } from '../hooks/useMarketData';
import KeyBrokersPanel from './KeyBrokersPanel';
import './MarketStatus.css';

export default function MarketStatus({ symbol, stockName }) {
    const { loading, error, marketData, historicalInst, hasInstitutional } = useMarketData(symbol);

    if (loading) return <div className="market-skeleton">讀取盤後籌碼與報價中...</div>;
    if (error) return <div className="market-error">無法取得即時資料：{error}</div>;
    if (!marketData) return <div className="market-empty">暫無該個股資料</div>;

    const { price, change, volume, issuedShares, turnoverRate, 
            instDate, foreignNet, trustNet, dealerNet, totalNet, dayTradeStats } = marketData;

    const formatNumber = (num) => (num / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
    const formatFull = (num) => num.toLocaleString();

    const renderCount = (count) => {
        if (!count) return null;
        const isBuy = count > 0;
        const absCount = Math.abs(count);
        const text = `連 ${absCount} ${isBuy ? '買' : '賣'}`;
        const isPivot = absCount === 1;
        return (
            <span className={`inst-count-label ${isBuy ? 'up' : 'down'} ${isPivot ? 'pivot' : ''}`}>
                {text}
            </span>
        );
    };

    return (
        <div className="market-status-panel">
            <h3 className="market-panel-title">{symbol} {stockName} 即時籌碼動態</h3>
            
            <div className="market-quote-block">
                <div className="metric">
                    <span>現價</span>
                    <strong className={change > 0 ? 'up-color' : (change < 0 ? 'down-color' : '')}>{price.toFixed(2)}</strong>
                </div>
                <div className="metric">
                    <span>漲跌</span>
                    <strong className={change > 0 ? 'up-color' : (change < 0 ? 'down-color' : '')}>
                        {change > 0 ? '▲ ' : (change < 0 ? '▼ ' : '')}{Math.abs(change).toFixed(2)}
                    </strong>
                </div>
                <div className="metric">
                    <span>本日總量</span>
                    <strong>{formatNumber(volume)} <small>張</small></strong>
                </div>
            </div>

            <div className="market-turnover-block">
                <div className="turnover-header">
                    <span>市場換手率 (Turnover Rate)</span>
                    <strong className="turnover-val">{turnoverRate.toFixed(3)} %</strong>
                </div>
                <div className="turnover-bar-bg">
                    <div className="turnover-bar-fill" style={{ width: `${Math.min(turnoverRate * 25, 100)}%` }}></div>
                </div>
                <div className="turnover-subtext">
                    發行總張數: {issuedShares > 0 ? formatNumber(issuedShares) : '未知'} 張
                </div>
            </div>

            <div className="market-inst-block">
                <h4>三大法人買賣超 (張) <small className="inst-date">{instDate}</small></h4>
                <div className="inst-grid">
                    <div className="inst-item">
                        <div className="inst-label-box">
                             <span>外資</span>
                             {historicalInst && renderCount(historicalInst.foreign)}
                        </div>
                        <strong className={foreignNet > 0 ? 'up-color' : (foreignNet < 0 ? 'down-color' : '')}>{formatNumber(foreignNet)}</strong>
                    </div>
                    <div className="inst-item">
                        <div className="inst-label-box">
                             <span>投信</span>
                             {historicalInst && renderCount(historicalInst.trust)}
                        </div>
                        <strong className={trustNet > 0 ? 'up-color' : (trustNet < 0 ? 'down-color' : '')}>{formatNumber(trustNet)}</strong>
                    </div>
                    <div className="inst-item">
                        <div className="inst-label-box">
                             <span>自營商</span>
                             {historicalInst && renderCount(historicalInst.dealer)}
                        </div>
                        <strong className={dealerNet > 0 ? 'up-color' : (dealerNet < 0 ? 'down-color' : '')}>{formatNumber(dealerNet)}</strong>
                    </div>
                </div>
                <div className="inst-total">
                    <span>合計買賣超</span>
                    <strong className={totalNet > 0 ? 'up-color' : (totalNet < 0 ? 'down-color' : '')}>{formatNumber(totalNet)} 張</strong>
                </div>
            </div>

            {dayTradeStats && (
                <div className="market-daytrade-block">
                    <h4>當日沖銷統計 (當沖)</h4>
                    <div className="dt-grid">
                        <div className="dt-item">
                            <span>當沖成交</span>
                            <strong>{formatNumber(dayTradeStats.dtShares)} <small>張</small></strong>
                        </div>
                        <div className="dt-item">
                            <span>估計損益 (Total P/L)</span>
                            <strong className={dayTradeStats.netPnL >= 0 ? 'profit-color' : 'loss-color'}>
                                {dayTradeStats.netPnL >= 0 ? '+' : ''}{Math.floor(dayTradeStats.netPnL / 1000).toLocaleString()} <small>k</small>
                            </strong>
                        </div>
                    </div>
                    <div className="dt-subtext">
                        買進: {Math.floor(dayTradeStats.buyAmt / 1000000).toLocaleString()}M / 
                        賣出: {Math.floor(dayTradeStats.sellAmt / 1000000).toLocaleString()}M
                    </div>
                </div>
            )}

            <KeyBrokersPanel symbol={symbol} />
        </div>
    );
}
