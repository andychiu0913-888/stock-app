fetch('https://openapi.twse.com.tw/v1/opendata/t187ap03_L')
  .then(r => r.json())
  .then(d => {
      console.log(JSON.stringify(d.find(i => i.公司代號 === '2330'), null, 2));
  });
