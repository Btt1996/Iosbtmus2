import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ahmed.btmu',
  appName: 'btmu',
  webDir: 'dist',
  server: {
    iosScheme: 'capacitor',
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      overlaysWebView: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
