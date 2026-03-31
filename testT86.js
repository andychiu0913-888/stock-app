fetch('https://openapi.twse.com.tw/v1/fund/T86_ALL')
  .then(res => res.json())
  .then(data => {
      console.log(data[0]);
  });
