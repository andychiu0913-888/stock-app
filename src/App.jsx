import React, { useState, useMemo, useEffect, useRef } from 'react';
import TradingChart from './components/TradingChart';
import PnLCalculator from './components/PnLCalculator';
import MarketStatus from './components/MarketStatus';
import Clock from './components/Clock';
import { fetchKLineData } from './utils/data';
import * as Indicators from './utils/indicators';
import allStocks from './utils/stocks.json';
import Select from 'react-select';
import './App.css';

const customSelectStyles = {
    control: (base, state) => ({
        ...base,
        background: '#080a0e',
        color: '#d1d4dc',
        borderColor: state.isFocused ? '#787b86' : '#2a2e39',
        boxShadow: state.isFocused ? '0 0 0 1px #787b86' : 'none',
        '&:hover': { borderColor: '#787b86' },
        width: '280px',
        minHeight: '40px',
        cursor: 'pointer'
    }),
    valueContainer: (base) => ({ ...base, padding: '0 8px' }),
    input: (base) => ({ ...base, color: '#d1d4dc', margin: '0' }),
    singleValue: (base) => ({ ...base, color: '#d1d4dc' }),
    menu: (base) => ({ ...base, background: '#131722', border: '1px solid #2a2e39', zIndex: 100 }),
    option: (base, state) => ({
        ...base,
        background: state.isSelected ? '#2a2e39' : state.isFocused ? '#080a0e' : 'transparent',
        color: '#d1d4dc',
        cursor: 'pointer',
        '&:active': { background: '#2a2e39' }
    }),
    menuList: (base) => ({ ...base, padding: '4px' }),
    groupHeading: (base) => ({
        ...base,
        color: '#ff9800', // Highlight color for groups
        fontSize: '0.85rem',
        fontWeight: 'bold',
        textTransform: 'none',
        padding: '8px 12px 4px 12px',
    })
};

const stockOptions = [
    { value: '^TWII', label: '加權指數 (TAIEX)' },
    { value: '^TWOO', label: '櫃買指數 (OTC)' },
    ...allStocks.map(s => ({
        value: s.symbol,
        label: `${s.symbol} ${s.name}`
    }))
];

const popularSymbols = ['^TWII', '2330', '2317', '2454', '2382', '3231', '2603', '2881', '1519', '3034', '2891'];
const groupedOptions = [
    {
        label: '🔥 熱門股 (Popular Pick)',
        options: popularSymbols.map(sym => stockOptions.find(o => o.value === sym)).filter(Boolean)
    },
    {
        label: '📁 所有上市櫃股票',
        options: stockOptions
    }
];


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorStr: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorStr: error.toString() + '\n' + error.stack };
  }
  render() {
    if (this.state.hasError) return <div style={{color:'red', padding:'20px', overflow:'auto'}}><pre>{this.state.errorStr}</pre></div>;
    return this.props.children;
  }
}

function App() {
  const [symbol, setSymbol] = useState('2330');
  const [searchInput, setSearchInput] = useState('2330');
  const [timeframe, setTimeframe] = useState('1d');
  const [chartType, setChartType] = useState('candlestick');
  const [rawData, setRawData] = useState([]);
  const [selectedPrice, setSelectedPrice] = useState(null);
  const [activeTab, setActiveTab] = useState('market'); // 'market' | 'pnl'

  const [visibleIndicators, setVisibleIndicators] = useState({
      ema5: true, ema10: true, ema20: true, ema60: false,
      sma5: false, sma10: false, sma20: false, sma60: false,
      bolling: false, rsi: false, macd: false, kd: false, force: false
  });

  const toggleIndicator = (name) => {
    setVisibleIndicators(prev => ({ ...prev, [name]: !prev[name] }));
  };

  useEffect(() => {
      setSearchInput(symbol);
  }, [symbol]);

  useEffect(() => {
      let isMounted = true;
      const load = async () => {
          setRawData([]); // Clear previous data to show loading
          const data = await fetchKLineData(symbol, timeframe);
          if (isMounted) {
              setRawData(data);
              if (data.length > 0) {
                  setSelectedPrice(data[data.length - 1].close);
              }
          }
      };
      load();
      return () => { isMounted = false; };
  }, [symbol, timeframe]);

  const currentStock = allStocks.find(s => s.symbol === symbol) || { name: '未知' };
  const currentOption = stockOptions.find(o => o.value === symbol) || stockOptions[0];

  const [capitalApiStatus, setCapitalApiStatus] = useState('offline'); // 'offline' | 'connecting' | 'online'
  const [extTicks, setExtTicks] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
      let reconnectTimer = null;

      const connect = () => {
          setCapitalApiStatus('connecting');
          const ws = new WebSocket('ws://127.0.0.1:8010/ws');
          wsRef.current = ws;

          ws.onopen = () => {
              console.log('[App] Connected to Capital Bridge');
              setCapitalApiStatus('online');
              // Auto-subscribe to current symbol
              ws.send(JSON.stringify({ type: 'subscribe', symbol }));
          };

          ws.onmessage = (event) => {
              try {
                  const data = JSON.parse(event.data);
                  if (data.type === 'tick') {
                      setExtTicks(prev => [data, ...prev].slice(0, 50));
                  } else if (data.type === 'login_result') {
                      if (data.success) {
                          console.log('[App] Login successful, subscribing to', symbol);
                          ws.send(JSON.stringify({ type: 'subscribe', symbol }));
                      } else {
                          alert(`群益 API 登入失敗 (代碼: ${data.code})\n訊息: ${data.message || '未知錯誤'}\n請檢查帳密或憑證。`);
                      }
                  }
              } catch (e) {}
          };

          ws.onclose = () => {
              setCapitalApiStatus('offline');
              reconnectTimer = setTimeout(connect, 5000); 
          };
          
          ws.onerror = () => {
              setCapitalApiStatus('offline');
          };
      };

      connect();
      return () => {
          if (wsRef.current) wsRef.current.close();
          if (reconnectTimer) clearTimeout(reconnectTimer);
      };
  }, []);

  // Sync subscription on symbol change
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Map common Yahoo indices to SKCOM symbols
        let bridgeSymbol = symbol;
        if (symbol === '^TWII') bridgeSymbol = 'TSE001';
        if (symbol === '^TWOO') bridgeSymbol = 'OTC001';
        
        wsRef.current.send(JSON.stringify({ type: 'subscribe', symbol: bridgeSymbol }));
    }
  }, [symbol]);

  const indicators = useMemo(() => {
      if (rawData.length === 0) return {};
      const res = { ema: {}, sma: {} };
      
      const periods = [5, 10, 20, 60];
      periods.forEach(p => {
          if (visibleIndicators[`ema${p}`]) res.ema[p] = Indicators.calculateEMA(rawData, p);
          if (visibleIndicators[`sma${p}`]) res.sma[p] = Indicators.calculateSMA(rawData, p);
      });

      if (visibleIndicators.bolling) {
          const bb = Indicators.calculateBollingerBands(rawData);
          res.bollinger = {
              upper: bb.map(v => ({ time: v.time, value: v.upper })),
              middle: bb.map(v => ({ time: v.time, value: v.middle })),
              lower: bb.map(v => ({ time: v.time, value: v.lower }))
          };
      }

      if (visibleIndicators.rsi) res.rsi = Indicators.calculateRSI(rawData);
      if (visibleIndicators.macd) res.macd = Indicators.calculateMACD(rawData);
      if (visibleIndicators.kd) res.kd = Indicators.calculateKD(rawData);
      if (visibleIndicators.force) res.force = Indicators.calculateForceIndex(rawData);

      return res;
  }, [rawData, visibleIndicators]);

  const [showFloatingCalc, setShowFloatingCalc] = useState(false);

  const [showLogin, setShowLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ userId: '', password: '', certPath: '' });

  const handleLogin = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ 
              type: 'login', 
              userId: loginForm.userId, 
              password: loginForm.password,
              certPath: loginForm.certPath
          }));
          setShowLogin(false);
      }
  };

  return (
    <div className="app-layout">
        <header className="toolbar">
            <div className="brand-group">
                <div className="brand">ANDY的股票系統</div>
                <div className="api-status-row">
                    <Clock />
                    <div className={`api-indicator ${capitalApiStatus}`} onClick={() => setShowLogin(!showLogin)} style={{ cursor: 'pointer' }}>
                        {capitalApiStatus === 'online' ? '● 群益 API 在線' : '○ 群益 API 登入'}
                    </div>
                </div>
            </div>

            {showLogin && (
                <div className="login-popover">
                    <input 
                        type="text" 
                        placeholder="群益帳號 (ID)" 
                        value={loginForm.userId}
                        onChange={e => setLoginForm({...loginForm, userId: e.target.value})}
                    />
                    <input 
                        type="password" 
                        placeholder="密碼" 
                        value={loginForm.password}
                        onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                    />
                    <input 
                        type="text" 
                        placeholder="憑證路徑 (選填)" 
                        value={loginForm.certPath}
                        onChange={e => setLoginForm({...loginForm, certPath: e.target.value})}
                    />
                    <button onClick={handleLogin}>登入</button>
                </div>
            )}
            {/* ... controls ... */}
            <div className="controls">
                <Select
                    value={currentOption}
                    onChange={(selected) => {
                        if (selected) {
                            setSymbol(selected.value);
                            setSearchInput(selected.value);
                        }
                    }}
                    options={groupedOptions}
                    styles={customSelectStyles}
                    placeholder="搜尋股號或名稱..."
                    isSearchable={true}
                />
            </div>
            <div className="timeframe-selector">
                {[
                    { label: '實時', value: '1m', type: 'line' },
                    { label: '1分', value: '1m', type: 'candlestick' },
                    { label: '5分', value: '5m', type: 'candlestick' },
                    { label: '15分', value: '15m', type: 'candlestick' },
                    { label: '日K', value: '1d', type: 'candlestick' },
                    { label: '週K', value: '1wk', type: 'candlestick' }
                ].map(tf => (
                    <button 
                        key={tf.label}
                        className={`tf-btn ${timeframe === tf.value && chartType === tf.type ? 'active' : ''}`}
                        onClick={() => {
                            setTimeframe(tf.value);
                            setChartType(tf.type);
                        }}
                    >
                        {tf.label}
                    </button>
                ))}
            </div>
            <div className="style-selector" style={{marginLeft: '10px', display: 'flex', gap: '4px'}}>
                 <button className={`tf-btn ${chartType === 'candlestick' ? 'active' : ''}`} onClick={() => setChartType('candlestick')}>K</button>
                 <button className={`tf-btn ${chartType === 'line' ? 'active' : ''}`} onClick={() => setChartType('line')}>江</button>
            </div>
            <div className="indicator-toggles">
                <div className="indicator-group">
                    <span>均線:</span>
                    {[5, 10, 20, 60].map(p => (
                        <label key={p} className="toggle-label">
                            <input type="checkbox" checked={visibleIndicators[`ema${p}`]} onChange={() => toggleIndicator(`ema${p}`)} /> E{p}
                        </label>
                    ))}
                </div>
                <div className="indicator-group" style={{ marginLeft: '12px', borderLeft: '1px solid #333', paddingLeft: '12px' }}>
                    <span>指標:</span>
                    <label className="toggle-label"><input type="checkbox" checked={visibleIndicators.bolling} onChange={() => toggleIndicator('bolling')} /> 布林</label>
                    <label className="toggle-label"><input type="checkbox" checked={visibleIndicators.rsi} onChange={() => toggleIndicator('rsi')} /> RSI</label>
                    <label className="toggle-label"><input type="checkbox" checked={visibleIndicators.macd} onChange={() => toggleIndicator('macd')} /> MACD</label>
                    <label className="toggle-label"><input type="checkbox" checked={visibleIndicators.kd} onChange={() => toggleIndicator('kd')} /> KD</label>
                    <label className="toggle-label" style={{ color: '#ff9800', fontWeight: 'bold' }}><input type="checkbox" checked={visibleIndicators.force} onChange={() => toggleIndicator('force')} /> 買賣力</label>
                </div>
            </div>
            <button 
                className={`tf-btn calc-btn ${showFloatingCalc ? 'active' : ''}`}
                onClick={() => setShowFloatingCalc(!showFloatingCalc)}
                style={{ marginLeft: 'auto', background: '#f5a623', color: '#000', fontWeight: 'bold' }}
            >
                🖩 計算損益
            </button>
        </header>
        
        <main className="main-content">
            <div className="chart-area">
                <ErrorBoundary>
                    {rawData.length > 0 ? (
                        <TradingChart 
                            symbol={symbol}
                            data={rawData} 
                            indicators={indicators} 
                            chartType={chartType}
                            extTicks={extTicks}
                            onPriceClick={setSelectedPrice} 
                        />
                    ) : (
                        <div style={{ color: '#fff', padding: '20px' }}>載入資料中...</div>
                    )}
                </ErrorBoundary>
            </div>
            <aside className="sidebar">
                <div className="sidebar-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'market' ? 'active' : ''}`}
                        onClick={() => setActiveTab('market')}
                    >
                        📊 籌碼與報價
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'pnl' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pnl')}
                    >
                        📝 備註與策略
                    </button>
                </div>
                
                <div className="tab-content">
                    {activeTab === 'market' && (
                        <MarketStatus symbol={symbol} stockName={currentStock.name} />
                    )}
                    {activeTab === 'pnl' && (
                        <div className="notes-placeholder">
                            <h4>策略備忘錄</h4>
                            <textarea placeholder="點此輸入交易計畫..."></textarea>
                        </div>
                    )}
                </div>
            </aside>
        </main>

        {showFloatingCalc && (
            <div className="floating-calc-wrapper">
                <div className="floating-calc-header">
                    <span>股票損益試算</span>
                    <button onClick={() => setShowFloatingCalc(false)}>×</button>
                </div>
                <PnLCalculator selectedPrice={selectedPrice} />
            </div>
        )}
    </div>
  );
}

export default App;
