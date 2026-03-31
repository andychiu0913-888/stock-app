import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/yahoo-api': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo-api/, '')
      },
      '/twse-api': {
        target: 'https://openapi.twse.com.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/twse-api/, '')
      },
      '/twse-rwd': {
        target: 'https://www.twse.com.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/twse-rwd/, '')
      },
      '/goodinfo': {
        target: 'https://goodinfo.tw',
        changeOrigin: true,
        secure: false,
        headers: {
            'Referer': 'https://goodinfo.tw',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        rewrite: (path) => path.replace(/^\/goodinfo/, '')
      },
      '/histock': {
        target: 'https://histock.tw',
        changeOrigin: true,
        secure: false,
        headers: {
            'Referer': 'https://histock.tw',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        rewrite: (path) => path.replace(/^\/histock/, '')
      },
      '/yahoo-tw': {
        target: 'https://tw.stock.yahoo.com',
        changeOrigin: true,
        secure: false,
        headers: {
            'Referer': 'https://tw.stock.yahoo.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        rewrite: (path) => path.replace(/^\/yahoo-tw/, '')
      },
      '/yahoo-td': {
        target: 'https://tw.stock.yahoo.com/_td-stock/api',
        changeOrigin: true,
        secure: false,
        headers: {
            'Referer': 'https://tw.stock.yahoo.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        rewrite: (path) => path.replace(/^\/yahoo-td/, '')
      }
    }
  }
})
