import axios from 'axios';
import CryptoJS from 'crypto-js';
import { SmartLight, TuyaApiResponse } from '../types';

// Tuya API Configuration - inspired by the Android app
const TUYA_CONFIG = {
  BASE_URL: 'https://openapi.tuyaus.com',
  ACCESS_ID: 'asf4xfpnfxuc3kpgkfkn',
  ACCESS_SECRET: '2bb6eb3bf50d47c3bfd727d168cfbb49',
  PROJECT_CODE: 'p1760488081408794mmg', // Project Code for reference
  DEVICE_IDS: [
    'eb0620af64cf53f1dfu4hy',  // KHSUIN(7x24 Service Online) 4
    'eb0d6f535fa9a1fd42ngda',  // KHSUIN(7x24 Service Online)
    'eb62a25695c44a3a64bnzx',  // KHSUIN(7x24 Service Online) 2
    'ebae2a6a1599da5bc11t1w'   // KHSUIN(7x24 Service Online) 3
  ],
  REGIONS: [
    'https://openapi.tuyaus.com',  // US
    'https://openapi.tuyaeu.com',  // Europe
    'https://openapi.tuyacn.com'   // China
  ]
};

class SmartLightService {
  private static instance: SmartLightService;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private userUid: string | null = null;

  private constructor() {}

  public static getInstance(): SmartLightService {
    if (!SmartLightService.instance) {
      SmartLightService.instance = new SmartLightService();
    }
    return SmartLightService.instance;
  }

  // Clear cached token to force fresh authentication
  public clearTokenCache(): void {
    console.log('🔄 Clearing token cache for fresh authentication...');
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.userUid = null;
  }

  // Force reload light discovery with fresh authentication
  public async reloadLightDiscovery(): Promise<{ lights: SmartLight[], error: string | null }> {
    console.log('🔄 Forcing light discovery reload...');
    this.clearTokenCache();
    return await this.getSmartLights();
  }

  // Get access token using OAuth
  async getAccessToken(): Promise<string | null> {
    try {
      if (this.accessToken && Date.now() < this.tokenExpiry) {
        console.log('🔑 Using cached access token');
        return this.accessToken;
      }

      console.log('🔑 Requesting new access token...');

      const timestamp = Date.now().toString();
      const nonce = '';

      // Token Management API signature
      const method = 'GET';
      const contentHash = this.sha256(''); // Empty body for GET
      const headers = ''; // No additional headers to sign
      const url = '/v1.0/token?grant_type=1';

      const stringToSign = `${method}\n${contentHash}\n${headers}\n${url}`;
      const str = TUYA_CONFIG.ACCESS_ID + timestamp + nonce + stringToSign;
      const signature = this.hmacSha256(TUYA_CONFIG.ACCESS_SECRET, str);

      const fullUrl = `${TUYA_CONFIG.BASE_URL}${url}`;

      console.log(`🔑 Token request URL: ${fullUrl}`);
      console.log(`🔑 Signature: ${signature.substring(0, 20)}...`);

      const response = await axios.get(fullUrl, {
        headers: {
          'client_id': TUYA_CONFIG.ACCESS_ID,
          'sign': signature,
          't': timestamp,
          'sign_method': 'HMAC-SHA256',
          'Content-Type': 'application/json'
        }
      });

      console.log(`🔑 Token Response: ${response.status}`);

      if (response.status === 200) {
        const data = response.data;
        const success = data.success || false;

        if (success) {
          const result = data.result;
          this.accessToken = result.access_token;
          this.userUid = result.uid;
          const expiresIn = result.expire_time;
          this.tokenExpiry = Date.now() + (expiresIn * 1000);

          console.log('✅ Token obtained successfully!');
          console.log(`🔑 Token: ${this.accessToken?.substring(0, 15)}...`);
          console.log(`🔑 User UID: ${this.userUid}`);
          return this.accessToken;
        } else {
          const errorMsg = data.msg || data.errorMsg || 'Unknown error';
          const errorCode = data.code || 'N/A';
          console.error('❌ Token request failed:');
          console.error(`❌ Error Code: ${errorCode}`);
          console.error(`❌ Error Message: ${errorMsg}`);
        }
      } else {
        console.error('❌ HTTP Error:', response.status);
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting access token:', error);
      return null;
    }
  }

  // Get all smart lights
  async getSmartLights(): Promise<{ lights: SmartLight[], error: string | null }> {
    try {
      console.log('💡 Starting smart light discovery...');

      const token = await this.getAccessToken();
      if (!token) {
        const error = 'Failed to get access token. Check API credentials.';
        console.error('❌ Authentication failed');
        return { lights: [], error };
      }

      console.log('✅ Authentication successful!');

      const lights: SmartLight[] = [];
      let successCount = 0;
      let errorCount = 0;

      // Fetch each device individually
      for (let index = 0; index < TUYA_CONFIG.DEVICE_IDS.length; index++) {
        const deviceId = TUYA_CONFIG.DEVICE_IDS[index];
        try {
          console.log(`🔍 Fetching device ${index + 1}/${TUYA_CONFIG.DEVICE_IDS.length}: ${deviceId}`);

          const deviceInfo = await this.getDeviceInfo(token, deviceId);
          if (deviceInfo) {
            lights.push(deviceInfo);
            successCount++;
            console.log(`✅ Successfully loaded: ${deviceInfo.name}`);
          } else {
            errorCount++;
            console.warn(`⚠️ Failed to load device: ${deviceId}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Exception loading device ${deviceId}:`, error);
        }
      }

      console.log(`📊 Results: ${successCount} successful, ${errorCount} failed`);

      if (lights.length > 0) {
        console.log('✅ Smart light discovery successful!');
        return { lights, error: null };
      } else {
        const error = `Failed to load any devices. All ${TUYA_CONFIG.DEVICE_IDS.length} devices failed to load.`;
        console.error('❌ Smart light discovery failed');
        return { lights: [], error };
      }
    } catch (error) {
      const errorMsg = `Exception while fetching devices: ${error}`;
      console.error(errorMsg, error);
      return { lights: [], error: errorMsg };
    }
  }

  // Get individual device information
  private async getDeviceInfo(token: string, deviceId: string): Promise<SmartLight | null> {
    try {
      console.log(`📡 Requesting device info for: ${deviceId}`);

      const endpoint = `/v1.0/iot-03/devices/${deviceId}`;
      const url = `${TUYA_CONFIG.BASE_URL}${endpoint}`;

      // General business API signature
      const timestamp = Date.now().toString();
      const nonce = '';
      const method = 'GET';
      const contentHash = this.sha256(''); // Empty body for GET
      const headers = '';

      const stringToSign = `${method}\n${contentHash}\n${headers}\n${endpoint}`;
      const str = TUYA_CONFIG.ACCESS_ID + token + timestamp + nonce + stringToSign;
      const signature = this.hmacSha256(TUYA_CONFIG.ACCESS_SECRET, str);

      const response = await axios.get(url, {
        headers: {
          'client_id': TUYA_CONFIG.ACCESS_ID,
          'access_token': token,
          'sign': signature,
          't': timestamp,
          'sign_method': 'HMAC-SHA256',
          'Content-Type': 'application/json'
        }
      });

      console.log(`📡 HTTP Status: ${response.status}`);

      if (response.status === 200) {
        const data = response.data;
        const success = data.success || false;

        if (success) {
          const result = data.result;
          if (result) {
            const name = result.name || 'Unknown Device';
            const online = result.online || false;
            const category = result.category || 'unknown';

            console.log(`📱 Device: ${name} (${online ? '🟢 Online' : '🔴 Offline'})`);

            // Parse device status
            const status = result.status;
            let isOn = false;
            let brightness = 100;
            let color = '#FFFFFF';

            if (Array.isArray(status)) {
              for (const item of status) {
                const code = item.code || '';
                const value = item.value;

                switch (code) {
                  case 'switch_led':
                  case 'switch':
                  case 'power':
                  case 'switch_1':
                    isOn = Boolean(value);
                    break;
                  case 'bright_value':
                  case 'brightness':
                  case 'bright':
                    brightness = Number(value) || 100;
                    break;
                  case 'colour_data':
                  case 'color_data':
                  case 'colour':
                  case 'color':
                    color = this.convertColorToHex(String(value || '#FFFFFF'));
                    break;
                }
              }
            }

            return {
              id: deviceId,
              name: name,
              isOnline: online,
              isOn: isOn,
              brightness: brightness,
              color: color,
              colorTemperature: 5000,
              lastUpdated: new Date().toISOString()
            };
          }
        } else {
          const errorMsg = data.msg || 'Unknown error';
          const errorCode = data.code || 'N/A';
          console.warn(`⚠️ API Error: ${errorCode} - ${errorMsg}`);
        }
      } else {
        console.warn(`⚠️ HTTP Error: ${response.status}`);
      }

      return null;
    } catch (error) {
      console.error(`❌ Exception: ${error}`);
      return null;
    }
  }

  // Control device power
  async setDevicePower(deviceId: string, isOn: boolean): Promise<boolean> {
    try {
      console.log(`💡 Controlling device power: ${deviceId} -> ${isOn ? 'ON' : 'OFF'}`);

      const token = await this.getAccessToken();
      if (!token) {
        console.error('❌ No access token available');
        return false;
      }

      // Try different command codes for different device types
      const commandCodes = ['switch_led', 'switch', 'power', 'switch_1'];
      const commands = {
        commands: [
          {
            code: commandCodes[0], // Start with switch_led
            value: isOn
          }
        ]
      };

      const endpoint = `/v1.0/iot-03/devices/${deviceId}/commands`;
      const url = `${TUYA_CONFIG.BASE_URL}${endpoint}`;
      const body = JSON.stringify(commands);

      // General business API signature for POST
      const timestamp = Date.now().toString();
      const nonce = '';
      const method = 'POST';
      const contentHash = this.sha256(body);
      const headers = '';

      const stringToSign = `${method}\n${contentHash}\n${headers}\n${endpoint}`;
      const str = TUYA_CONFIG.ACCESS_ID + token + timestamp + nonce + stringToSign;
      const signature = this.hmacSha256(TUYA_CONFIG.ACCESS_SECRET, str);

      const response = await axios.post(url, commands, {
        headers: {
          'client_id': TUYA_CONFIG.ACCESS_ID,
          'access_token': token,
          'sign': signature,
          't': timestamp,
          'sign_method': 'HMAC-SHA256',
          'Content-Type': 'application/json'
        }
      });

      console.log(`📡 Response: ${response.status}`);

      if (response.status === 200) {
        const data = response.data;
        const success = data.success || false;

        if (success) {
          console.log('✅ Device power control successful!');
        } else {
          console.error(`❌ Device power control failed: ${data.msg || 'Unknown error'}`);
        }

        return success;
      } else {
        console.error(`❌ HTTP Error: ${response.status}`);
      }

      return false;
    } catch (error) {
      console.error('❌ Exception controlling device power:', error);
      return false;
    }
  }

  // Set device brightness
  async setDeviceBrightness(deviceId: string, brightness: number): Promise<boolean> {
    try {
      console.log(`🔆 Controlling device brightness: ${deviceId} -> ${brightness}%`);

      const token = await this.getAccessToken();
      if (!token) {
        console.error('❌ No access token available');
        return false;
      }

      // Use correct Tuya DP codes for KHSUIN bulbs
      const brightnessCodes = ['bright_value_v2', 'bright_value'];

      // Convert percentage (1-100) to Tuya range (10-1000)
      const tuyaBrightness = brightness <= 0 ? 10 : brightness >= 100 ? 1000 : Math.max(10, Math.min(1000, brightness * 10));

      console.log(`🔆 Brightness conversion: ${brightness}% → ${tuyaBrightness} (Tuya range)`);

      const commands = {
        commands: [
          {
            code: brightnessCodes[0], // Start with bright_value_v2
            value: tuyaBrightness
          }
        ]
      };

      const endpoint = `/v1.0/iot-03/devices/${deviceId}/commands`;
      const url = `${TUYA_CONFIG.BASE_URL}${endpoint}`;

      // General business API signature for POST
      const timestamp = Date.now().toString();
      const nonce = '';
      const method = 'POST';
      const contentHash = this.sha256(JSON.stringify(commands));
      const headers = '';

      const stringToSign = `${method}\n${contentHash}\n${headers}\n${endpoint}`;
      const str = TUYA_CONFIG.ACCESS_ID + token + timestamp + nonce + stringToSign;
      const signature = this.hmacSha256(TUYA_CONFIG.ACCESS_SECRET, str);

      const response = await axios.post(url, commands, {
        headers: {
          'client_id': TUYA_CONFIG.ACCESS_ID,
          'access_token': token,
          'sign': signature,
          't': timestamp,
          'sign_method': 'HMAC-SHA256',
          'Content-Type': 'application/json'
        }
      });

      console.log(`📡 Response: ${response.status}`);

      if (response.status === 200) {
        const data = response.data;
        const success = data.success || false;

        if (success) {
          console.log('✅ Device brightness control successful!');
        } else {
          console.error(`❌ Device brightness control failed: ${data.msg || 'Unknown error'}`);
        }

        return success;
      } else {
        console.error(`❌ HTTP Error: ${response.status}`);
      }

      return false;
    } catch (error) {
      console.error('❌ Exception controlling device brightness:', error);
      return false;
    }
  }

  // Set device color
  async setDeviceColor(deviceId: string, colorHex: string): Promise<boolean> {
    try {
      console.log(`🎨 Controlling device color: ${deviceId} -> ${colorHex}`);

      const token = await this.getAccessToken();
      if (!token) {
        console.error('❌ No access token available');
        return false;
      }

      // Convert hex color to HSV
      const hsv = this.hexToHsv(colorHex);

      // Convert HSV to Tuya format (h: 0-360, s: 0-1000, v: 0-1000)
      const tuyaHsv = {
        h: hsv[0], // Hue: 0-360
        s: Math.max(0, Math.min(1000, hsv[1] * 10)), // Saturation: 0-1000
        v: Math.max(0, Math.min(1000, hsv[2] * 10)) // Value: 0-1000
      };

      console.log(`🎨 Color conversion: ${colorHex} -> HSV(${hsv[0]}, ${hsv[1]}, ${hsv[2]}) -> Tuya(${tuyaHsv.h}, ${tuyaHsv.s}, ${tuyaHsv.v})`);

      // Use correct Tuya DP codes for KHSUIN bulbs
      const commands = {
        commands: [
          {
            code: 'colour_data_v2',
            value: JSON.stringify(tuyaHsv)
          }
        ]
      };

      const endpoint = `/v1.0/iot-03/devices/${deviceId}/commands`;
      const url = `${TUYA_CONFIG.BASE_URL}${endpoint}`;

      // General business API signature for POST
      const timestamp = Date.now().toString();
      const nonce = '';
      const method = 'POST';
      const contentHash = this.sha256(JSON.stringify(commands));
      const headers = '';

      const stringToSign = `${method}\n${contentHash}\n${headers}\n${endpoint}`;
      const str = TUYA_CONFIG.ACCESS_ID + token + timestamp + nonce + stringToSign;
      const signature = this.hmacSha256(TUYA_CONFIG.ACCESS_SECRET, str);

      const response = await axios.post(url, commands, {
        headers: {
          'client_id': TUYA_CONFIG.ACCESS_ID,
          'access_token': token,
          'sign': signature,
          't': timestamp,
          'sign_method': 'HMAC-SHA256',
          'Content-Type': 'application/json'
        }
      });

      console.log(`📡 Response: ${response.status}`);

      if (response.status === 200) {
        const data = response.data;
        const success = data.success || false;

        if (success) {
          console.log('✅ Device color control successful!');
        } else {
          console.error(`❌ Device color control failed: ${data.msg || 'Unknown error'}`);
        }

        return success;
      } else {
        console.error(`❌ HTTP Error: ${response.status}`);
      }

      return false;
    } catch (error) {
      console.error('❌ Exception controlling device color:', error);
      return false;
    }
  }

  // Flash light for medication reminder
  async flashLight(deviceId: string, duration: number = 5000): Promise<boolean> {
    try {
      console.log(`⚡ Flashing light: ${deviceId} for ${duration}ms`);

      // Turn on light
      await this.setDevicePower(deviceId, true);

      // Set to bright red for attention
      await this.setDeviceColor(deviceId, '#FF0000');
      await this.setDeviceBrightness(deviceId, 100);

      // Wait for duration
      await new Promise(resolve => setTimeout(resolve, duration));

      // Turn off light
      await this.setDevicePower(deviceId, false);

      console.log(`✅ Light flashed for ${duration}ms`);
      return true;
    } catch (error) {
      console.error(`❌ Error flashing light: ${error}`);
      return false;
    }
  }

  // Helper functions
  private sha256(data: string): string {
    return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex).toLowerCase();
  }

  private hmacSha256(secret: string, data: string): string {
    return CryptoJS.HmacSHA256(data, secret).toString(CryptoJS.enc.Hex).toUpperCase();
  }

  private convertColorToHex(colorData: string): string {
    try {
      if (colorData.startsWith('#')) {
        return colorData.toUpperCase();
      }
      
      // Try to parse JSON color data
      const colorJson = JSON.parse(colorData);
      const h = colorJson.h;
      const s = colorJson.s / 100.0;
      const v = colorJson.v / 100.0;

      const rgb = this.hsvToRgb(h, s, v);
      return `#${rgb[0].toString(16).padStart(2, '0')}${rgb[1].toString(16).padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`.toUpperCase();
    } catch (error) {
      return '#FFFFFF';
    }
  }

  private hexToHsv(hex: string): number[] {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert hex to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    // Convert RGB to HSV
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    if (diff !== 0) {
      if (max === r) {
        h = ((g - b) / diff) % 6;
      } else if (max === g) {
        h = (b - r) / diff + 2;
      } else {
        h = (r - g) / diff + 4;
      }
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : diff / max;
    const v = max;

    return [
      h,
      Math.round(s * 100),
      Math.round(v * 100)
    ];
  }

  private hsvToRgb(h: number, s: number, v: number): number[] {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;
    if (h < 60) {
      r = c; g = x; b = 0;
    } else if (h < 120) {
      r = x; g = c; b = 0;
    } else if (h < 180) {
      r = 0; g = c; b = x;
    } else if (h < 240) {
      r = 0; g = x; b = c;
    } else if (h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ];
  }
}

export default SmartLightService;

