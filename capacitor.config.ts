import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kodiaksoul.matzero',
  appName: 'MatZero',
  webDir: 'out',
  server: {
    url: 'https://matzeroapp.com',
    cleartext: true
  }
};

export default config;
