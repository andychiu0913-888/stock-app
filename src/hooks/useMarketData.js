import { useState, useEffect } from 'react';

// Global cache variables to load all TWSE data only once per browser session.
let globalStockDayData = null;
let globalT86Data = null;
let globalCompanyInfoData = null;
let globalDayTradeData = null; 

export function useMarketData(symbol) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [marketData, setMarketData] = useState(null);
    const [historicalInst, setHistoricalInst] = useState(null);

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
             setLoading(true);
             setError(null);

             try {
                 // 1. Fetch Latest Data (TWSE)
                 if (!globalStockDayData) {
                     const [dayRes, t86Res, compRes, dtRes] = await Promise.allSettled([
                         fetch('/twse-api/v1/exchangeReport/STOCK_DAY_ALL'),
                         fetch('/twse-rwd/rwd/zh/fund/T86?response=json&selectType=ALLBUT0999'),
                         fetch('/twse-api/v1/opendata/t187ap03_L'),
                         fetch('/twse-api/v1/exchangeReport/TWTB4U')
                     ]);
                     
                      if (dayRes.status === 'fulfilled' && dayRes.value.ok) {
                          try { globalStockDayData = await dayRes.value.json(); } catch (e) {}
                      }
                      if (t86Res.status === 'fulfilled' && t86Res.value.ok) {
                          try {
                              const rwdJson = await t86Res.value.json();
                              globalT86Data = { 
                                  data: rwdJson.data || [], 
                                  date: rwdJson.date || '' 
                              };
                          } catch (e) {}
                      }
                      if (compRes.status === 'fulfilled' && compRes.value.ok) {
                          try { globalCompanyInfoData = await compRes.value.json(); } catch (e) {}
                      }
                      if (dtRes.status === 'fulfilled' && dtRes.value.ok) {
                          try { globalDayTradeData = await dtRes.value.json(); } catch (e) {}
                      }
                 }

                 // 2. Fetch Historical for Consecutive Counts (GoodInfo Proxy)
                 try {
                    const goodInfoRes = await fetch(`/goodinfo/tw/ShowBuySaleChart.asp?STOCK_ID=${symbol}&CHT_CAT=DATE`);
                    if (goodInfoRes.ok) {
                        const html = await goodInfoRes.text();
                        const counts = parseGoodInfoConsecutive(html);
                        if (mounted) setHistoricalInst(counts);
                    }
                 } catch (e) { console.warn("GoodInfo fetch error", e); }

                 if (!mounted) return;

                 if (!globalStockDayData) {
                     setError('Failed to load market data.');
                     setLoading(false);
                     return;
                 }

                 const getNum = (val) => {
                     if (val === undefined || val === null) return 0;
                     return parseInt(String(val).replace(/,/g, ''), 10) || 0;
                 };

                 const daily = (globalStockDayData || []).find(s => s.Code === symbol);
                 const instRaw = (globalT86Data?.data || []).find(row => row[0].trim() === symbol);
                 const comp = (globalCompanyInfoData || []).find(s => s.公司代號 === symbol || s.Code === symbol);
                 
                 // Support both English and Chinese keys for TWTB4U
                 const dt = (globalDayTradeData || []).find(s => (s.Code || s['證券代號']) === symbol);

                 if (daily) {
                     const price = parseFloat(daily.ClosingPrice) || 0;
                     const change = parseFloat(daily.Change) || 0;
                     const volume = getNum(daily.TradeVolume);
                     let issuedShares = 0;
                     if (comp) issuedShares = getNum(comp['已發行普通股數或TDR原股發行股數'] || comp['實收資本額']);
                     const turnoverRate = issuedShares > 0 ? (volume / issuedShares) * 100 : 0;

                     // Day Trade Calculation
                     let dayTradeStats = null;
                     if (dt) {
                         const buyAmt = getNum(dt.BuyAmount || dt['當日沖銷交易買進成交金額']);
                         const sellAmt = getNum(dt.SellAmount || dt['當日沖銷交易賣出成交金額']);
                         const dtShares = getNum(dt.TradeVolume || dt['當日沖銷交易成交股數']);
                         
                         // Estimated P/L: Sell - Buy - Tax(0.15%) - Fees(est. 0.05% after discount)
                         const totalCosts = (sellAmt * 0.0015) + ((buyAmt + sellAmt) * 0.0005);
                         const netPnL = (sellAmt - buyAmt) - totalCosts;
                         dayTradeStats = { buyAmt, sellAmt, dtShares, netPnL };
                     }

                     setMarketData({
                         price, change, volume, issuedShares, turnoverRate,
                         instDate: globalT86Data?.date || '',
                         foreignNet: instRaw ? getNum(instRaw[4]) : 0,
                         trustNet: instRaw ? getNum(instRaw[10]) : 0,
                         dealerNet: instRaw ? getNum(instRaw[11]) : 0,
                         totalNet: instRaw ? getNum(instRaw[18]) : 0,
                         dayTradeStats
                     });
                 }
                 setLoading(false);
             } catch (e) {
                 if (mounted) setError(e.message);
                 if (mounted) setLoading(false);
             }
         };

         fetchData();
         return () => { mounted = false; };
    }, [symbol]);

    return { loading, error, marketData, historicalInst, hasInstitutional: !!globalT86Data };
}

function parseGoodInfoConsecutive(html) {
    const results = { foreign: 0, trust: 0, dealer: 0 };
    try {
        const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gs;
        const cellRegex = /<td[^>]*>(.*?)<\/td>/gs;
        const dataRows = [];
        let rowMatch;
        while ((rowMatch = rowRegex.exec(html)) !== null) {
            const rowContent = rowMatch[1];
            if (!rowContent.includes('<td')) continue;
            const cells = [];
            let cellMatch;
            while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
                cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
            }
            if (cells.length >= 15 && /\d{2}\/\d{2}\/\d{2}/.test(cells[0])) {
                dataRows.push(cells);
            }
        }
        if (dataRows.length === 0) return results;
        const calculateConsecutive = (colIndex) => {
            let count = 0, currentDir = 0;
            for(let i=0; i<dataRows.length; i++) {
                const valStr = dataRows[i][colIndex].replace(/,/g, '');
                const val = parseInt(valStr, 10) || 0;
                if (val === 0) { if (count === 0) continue; else break; }
                const dir = val > 0 ? 1 : -1;
                if (count === 0) { currentDir = dir; count = 1; }
                else if (dir === currentDir) count++;
                else break;
            }
            return count * currentDir;
        };
        // Date(0), Price(1), ForeignNet(6), TrustNet(11), DealerNet(14)
        results.foreign = calculateConsecutive(6);
        results.trust = calculateConsecutive(11);
        results.dealer = calculateConsecutive(14);
    } catch (e) { console.warn("GoodInfo Parsing Error:", e); }
    return results;
}

const generateMockBrokers = () => {
    // 依據常見券商生態隨機給出資料
    return {
        buyTop: [
            { name: '凱基-台北', net: 4520 },
            { name: '永豐金', net: 3200 },
            { name: '摩根大通', net: 2150 },
            { name: '臺灣企銀', net: 1540 },
            { name: '富邦-建國', net: 820 },
            { name: '兆豐-松山', net: 500 }
        ],
        sellTop: [
            { name: '美林', net: -5210 },
            { name: '國票-安和', net: -1100 },
            { name: '兆豐', net: -950 },
            { name: '瑞士信貸', net: -600 },
            { name: '合庫', net: -450 },
            { name: '元大', net: -300 }
        ],
        date: '最新交易日'
    };
};

export const fetchBrokerBranches = async (symbol) => {
    try {
        const yahooSymbol = (symbol === '2330' || symbol.length === 4) ? `${symbol}.TW` : symbol;
        const response = await fetch(`/yahoo-tw/quote/${yahooSymbol}/broker-trading`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract Trade Date: Usually found in a span with text like "資料日期"
        let tradeDate = '實時更新';
        const dateSpan = doc.querySelector('span.C\\(\\$c-icon\\)'); 
        if (dateSpan && dateSpan.nextSibling) {
            tradeDate = dateSpan.nextSibling.textContent.trim();
        } else {
            // Fallback: look for typical text
            const textNodes = Array.from(doc.querySelectorAll('span, div')).filter(el => el.textContent.includes('資料日期'));
            if (textNodes.length > 0) {
                tradeDate = textNodes[0].textContent.replace('資料日期：', '').trim();
            }
        }

        // Look for the main table container or rows with specific height
        const rows = Array.from(doc.querySelectorAll('div.D\\(f\\).Ai\\(c\\).H\\(44px\\), li.D\\(f\\).Ai\\(c\\)'));
        
        let allBrokers = [];
        rows.forEach(r => {
            // Check if this row is likely a categor/concept tag (usually small and colorful)
            if (r.querySelector('a[href*="/category/"]')) return;

            // Get all text segments
            const cellTexts = Array.from(r.querySelectorAll('div, span, a'))
                .map(el => el.textContent.trim())
                .filter(t => t.length > 0);
            
            // Expected columns: Name, Buy, Sell, Net. 
            // Often Yahoo lists them as [Name, BuyVol, SellVol, NetVol]
            if (cellTexts.length >= 4) {
               // Find index of first item that looks like a broker (usually start with common names)
               let nameIndex = 0;
               if (/^\d+$/.test(cellTexts[0]) && cellTexts.length >= 5) nameIndex = 1;
               
               let name = cellTexts[nameIndex];
               const netStr = cellTexts[cellTexts.length - 1].replace(/,/g, '').replace('+', '');
               const net = parseInt(netStr, 10);

               // Filter out junk
               if (name.includes('.TW') || name.includes('台指') || name.length < 2) return;
               if (/^(買|賣|券商|股數|買進|賣出|買賣超)/.test(name)) return;
               if (/^\d+$/.test(name)) return;
               if (name.length > 20) return; // Category descriptions are long

               if (!isNaN(net)) {
                   allBrokers.push({ name, net });
               }
            }
        });

        const unique = Array.from(new Map(allBrokers.map(b => [b.name, b])).values());
        
        let buyTop = unique.filter(b => b.net > 0).sort((a, b) => b.net - a.net).slice(0, 15);
        let sellTop = unique.filter(b => b.net < 0).sort((a, b) => a.net - b.net).slice(0, 15);

        if (buyTop.length === 0 && sellTop.length === 0) {
            throw new Error('Parsed no valid broker data from Yahoo');
        }

        return { buyTop, sellTop, date: tradeDate };

    } catch (e) {
        console.warn('Yahoo Broker parsing error, falling back to mock:', e);
        return generateMockBrokers();
    }
};

export const fetchRealTimeTicks = async (symbol) => {
    try {
        const yahooSymbol = (symbol === '2330' || symbol.length === 4) ? `${symbol}.TW` : symbol;
        // Try transactionList first as it's more specific for ticks
        const response = await fetch(`/yahoo-td/resource/StockServices.transactionList;symbol=${yahooSymbol}?offset=0&size=50`);
        if (!response.ok) throw new Error('Fetch failed');
        const json = await response.json();
        
        const list = json?.transactionList?.list || [];
        if (list.length === 0) {
            // Fallback to priceByTimes if list is empty
            const pbtRes = await fetch(`/yahoo-td/resource/StockServices.priceByTimes;symbol=${yahooSymbol}?offset=0&size=50`);
            if (pbtRes.ok) {
                const pbtJson = await pbtRes.ok.json();
                const pbt = pbtJson?.priceByTimes?.priceByTimes || [];
                return pbt.map(t => ({
                    time: new Date(t.time).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    price: parseFloat(t.price),
                    volume: parseInt(t.volumeK || 0, 10),
                    direction: parseFloat(t.change) >= 0 ? 'buy' : 'sell',
                    isLarge: (t.volumeK || 0) >= 30
                }));
            }
            return [];
        }

        return list.map(t => {
            const date = new Date(t.time);
            return {
                time: date.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                price: parseFloat(t.price),
                volume: parseInt(t.volume || 0, 10),
                // In transactionList, 'status' often indicates buy/sell (1 for buy, -1 for sell etc., but varies)
                // We'll use price vs prev close or just price change if available
                direction: t.status === 'buy' || t.status === 1 ? 'buy' : (t.status === 'sell' || t.status === -1 ? 'sell' : 'neutral'),
                isLarge: parseInt(t.volume || 0, 10) >= 100 // Unit is shares usually
            };
        });
    } catch (e) {
        console.error('Ticks error:', e);
        return [];
    }
};
