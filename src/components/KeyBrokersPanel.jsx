import React, { useEffect, useState } from 'react';
import { fetchBrokerBranches } from '../hooks/useMarketData';
import { getBrokerType, BROKER_TYPES } from '../utils/brokerConfig';
import './MarketStatus.css';

export default function KeyBrokersPanel({ symbol }) {
    const [brokerData, setBrokerData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            const data = await fetchBrokerBranches(symbol);
            if (mounted) {
                setBrokerData(data);
                setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [symbol]);

    if (loading) return <div className="broker-loading">正在解析關鍵分點...</div>;
    if (!brokerData || !brokerData.buyTop) return null;

    const renderBrokerRow = (broker) => {
        const type = getBrokerType(broker.name);
        let badgeClass = '';
        if (type === BROKER_TYPES.DAY_TRADE) badgeClass = 'badge-day-trade';
        else if (type === BROKER_TYPES.SWING) badgeClass = 'badge-swing';
        else if (type === BROKER_TYPES.MYSTERY) badgeClass = 'badge-mystery';

        const formatNet = (net) => (net > 0 ? '+' : '') + net.toLocaleString();

        return (
            <div className="broker-row" key={broker.name}>
                <div className="broker-name">
                    {type && <span className={`broker-badge ${badgeClass}`}>{type}</span>}
                    {broker.name}
                </div>
                <div className={`broker-net ${broker.net > 0 ? 'up-color' : 'down-color'}`}>
                    {formatNet(broker.net)}
                </div>
            </div>
        );
    };

    return (
        <div className="key-brokers-container">
            <h4 className="market-section-title">主力關鍵分點追蹤 ({brokerData.date})</h4>
            <div className="broker-scroll-area">
                <div className="broker-columns">
                    <div className="broker-col buy-col">
                        <div className="broker-header">買超前 15 名</div>
                        {brokerData.buyTop.map(renderBrokerRow)}
                    </div>
                    <div className="broker-col sell-col">
                        <div className="broker-header">賣超前 15 名</div>
                        {brokerData.sellTop.map(renderBrokerRow)}
                    </div>
                </div>
            </div>
        </div>
    );
}
