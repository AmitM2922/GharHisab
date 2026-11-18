import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',timeout:45000,expect:{timeout:10000},workers:1,
 use:{baseURL:'http://127.0.0.1:5180',browserName:'chromium',reducedMotion:'reduce',trace:'retain-on-failure',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{},viewport:{width:390,height:844}},
 webServer:{command:`"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5180 --strictPort`,url:'http://127.0.0.1:5180',reuseExistingServer:!process.env.CI,env:{VITE_DEMO_MODE:'true',VITE_BASE_PATH:'/'}},
});
