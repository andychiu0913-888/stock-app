export const BROKER_TYPES = {
    DAY_TRADE: '隔日沖',
    SWING: '波段大戶',
    MYSTERY: '神祕分點'
};

export const brokerDictionary = {
    // 常見隔日沖分點 (今日大買，隔日開高倒貨)
    '凱基-台北': BROKER_TYPES.DAY_TRADE,
    '美林': BROKER_TYPES.DAY_TRADE,
    '摩根大通': BROKER_TYPES.DAY_TRADE,
    '富邦-建國': BROKER_TYPES.DAY_TRADE,
    '凱基-松山': BROKER_TYPES.DAY_TRADE,
    '元大-土城永寧': BROKER_TYPES.DAY_TRADE,
    '群益金鼎-大安': BROKER_TYPES.DAY_TRADE,
    '永豐金': BROKER_TYPES.DAY_TRADE, // 依據使用者提到的永豐金
    '永豐金-松山': BROKER_TYPES.DAY_TRADE,
    
    // 常見波段大戶 / 官股 (逢低買進，具備護盤或波段持有特性)
    '臺灣企銀': BROKER_TYPES.SWING,
    '合庫': BROKER_TYPES.SWING,
    '土銀': BROKER_TYPES.SWING,
    '兆豐': BROKER_TYPES.SWING,
    '富邦': BROKER_TYPES.SWING,

    // 常見地緣分點或神祕大戶 (平時不交易或特定個股專屬)
    '國票-安和': BROKER_TYPES.MYSTERY,
    '康和-永和': BROKER_TYPES.MYSTERY,
    '元富-城東': BROKER_TYPES.MYSTERY
};

export const getBrokerType = (brokerName) => {
    // 模糊比對，例如 "美林-台北" 也能配對到 "美林"
    for (const [key, type] of Object.entries(brokerDictionary)) {
        if (brokerName.includes(key)) {
            return type;
        }
    }
    return null; // 無特殊標籤
};
