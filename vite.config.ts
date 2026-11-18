import { defineConfig,loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,'.');
 return {
  plugins:[react()],base:env.VITE_BASE_PATH||'./',
  build:{rollupOptions:{output:{manualChunks:{
   react:['react','react-dom','react-router-dom'],charts:['recharts'],
   motion:['framer-motion'],supabase:['@supabase/supabase-js']
  }}}}
 };
});
