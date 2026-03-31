import fs from 'fs';

async function fetchStocks() {
    try {
        console.log('Fetching TWSE (上市)...');
        const resTse = await fetch('https://openapi.twse.com.tw/v1/opendata/t187ap03_L');
        const tseData = await resTse.json();
        
        console.log('Fetching TPEx (上櫃)...');
        const resOtc = await fetch('https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O');
        const otcData = await resOtc.json();
        
        const allStocks = [];
        
        for (const item of tseData) {
            if (item.公司代號 && item.公司名稱) {
                allStocks.push({ symbol: item.公司代號, name: item.公司簡稱 || item.公司名稱 });
            }
        }
        for (const item of otcData) {
            if (item.公司代號 && item.公司名稱) {
                allStocks.push({ symbol: item.公司代號, name: item.公司簡稱 || item.公司名稱 });
            }
        }
        
        // Remove duplicates just in case
        const uniqueStocks = [];
        const seen = new Set();
        for (const stock of allStocks) {
            if (!seen.has(stock.symbol)) {
                seen.add(stock.symbol);
                uniqueStocks.push(stock);
            }
        }
        
        // Sort by symbol logically
        uniqueStocks.sort((a, b) => {
            const aNum = parseInt(a.symbol);
            const bNum = parseInt(b.symbol);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.symbol.localeCompare(b.symbol);
        });
        
        fs.writeFileSync('./src/utils/stocks.json', JSON.stringify(uniqueStocks, null, 2));
        console.log(`Saved ${uniqueStocks.length} stocks to src/utils/stocks.json`);
    } catch (e) {
         console.error('Error fetching data:', e);
    }
}

fetchStocks();
