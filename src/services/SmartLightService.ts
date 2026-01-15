import axios from 'axios';
import CryptoJS from 'crypto-js';
import { SmartLight, TuyaApiResponse } from '../types';

const TUYA_CONFIG = {
  BASE_URL: 'https://openapi.tuyaus.com',
  ACCESS_ID: 'asf4xfpnfxuc3kpgkfkn',
  ACCESS_SECRET: '2bb6eb3bf50d47c3bfd727d168cfbb49',
  PROJECT_CODE: 'p1760488081408794mmg',
  DEVICE_IDS: [
    'eb0620af64cf53f1dfu4hy',
    'eb0d6f535fa9a1fd42ngda',
    'eb62a25695c44a3a64bnzx',
    'ebae2a6a1599da5bc11t1w'
  ],
  REGIONS: [
    'https://openapi.tuyaus.com',
    'https://openapi.tuyaeu.com',
    'https://openapi.tuyacn.com'
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

  public clearTokenCache(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.userUid = null;
  }

  public async reloadLightDiscovery(): Promise<{ lights: SmartLight[], error: string | null }> {
    this.clearTokenCache();
    return await this.getSmartLights();
  }

  async getAccessToken(): Promise<string | null> {
    try {
      if (this.accessToken && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const timestamp = Date.now().toString();
      const nonce = '';
      const method = 'GET';
      const contentHash = this.sha256('');
      const headers = '';
      const url = '/v1.0/token?grant_type=1';

      const stringToSign = `${method}\n${contentHash}\n${headers}\n${url}`;
      const str = TUYA_CONFIG.ACCESS_ID + timestamp + nonce + stringToSign;
      const signature = this.hmacSha256(TUYA_CONFIG.ACCESS_SECRET, str);

      const fullUrl = `${TUYA_CONFIG.BASE_URL}${url}`;

      const response = await axios.get(fullUrl, {
        headers: {
          'client_id': TUYA_CONFIG.ACCESS_ID,
          'sign': signature,
          't': timestamp,
          'sign_method': 'HMAC-SHA256',
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        const data = response.data;
        const success = data.success || false;

        if (success) {
          const result = data.result;
          this.accessToken = result.access_token;
          this.userUid = result.uid;
          const expiresIn = result.expire_time;
          this.tokenExpiry = Date.now() + (expiresIn * 1000);
          return this.accessToken;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  async getSmartLights(): Promise<{ lights: SmartLight[], error: string | null }> {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        return { lights: [], error: 'Failed to get access token. Check API credentials.' };
      }

      const lights: SmartLight[] = [];

      for (const deviceId of TUYA_CONFIG.DEVICE_IDS) {
        try {
          const deviceInfo = await this.getDeviceInfo(token, deviceId);
          if (deviceInfo) {
            lights.push(deviceInfo);
          }
        } catch (error) {
          console.error(`Exception loading device ${deviceId}:`, error);
        }
      }

      if (lights.length > 0) {
        return { lights, error: null };
      } else {
        return { lights: [], error: `Failed to load any devices. All ${TUYA_CONFIG.DEVICE_IDS.length} devices failed to load.` };
      }
    } catch (error) {
      return { lights: [], error: `Exception while fetching devices: ${error}` };
    }
  }

  private async getDeviceInfo(token: string, deviceId: string): Promise<SmartLight | null> {
    try {
      const endpoint = `/v1.0/iot-03/devices/${deviceId}`;
      const url = `${TUYA_CONFIG.BASE_URL}${endpoint}`;

      const timestamp = Date.now().toString();
      const nonce = '';
      const method = 'GET';
      const contentHash = this.sha256('');
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

      if (response.status === 200) {
        const data = response.data;
        const success = data.success || false;

        if (success) {
          const result = data.result;
          if (result) {
            const name = result.name || 'Unknown Device';
            const online = result.online || false;

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
        }
      }

      return null;
    } catch (error) {
      console.error(`Exception: ${error}`);
      return null;
    }
  }

  async setDevicePower(deviceId: string, isOn: boolean): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      if (!token) return false;

      const commands = {
        commands: [
          {
            code: 'switch_led',
            value: isOn
          }
        ]
      };

      const endpoint = `/v1.0/iot-03/devices/${deviceId}/commands`;
      const url = `${TUYA_CONFIG.BASE_URL}${endpoint}`;
      const body = JSON.stringify(commands);

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

      if (response.status === 200) {
        return response.data.success || false;
      }

      return false;
    } catch (error) {
      console.error('Exception controlling device power:', error);
      return false;
    }
  }

  async setDeviceBrightness(deviceId: string, brightness: number): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      if (!token) return false;

      const tuyaBrightness = brightness <= 0 ? 10 : brightness >= 100 ? 1000 : Math.max(10, Math.min(1000, brightness * 10));

      const commands = {
        commands: [
          {
            code: 'bright_value_v2',
            value: tuyaBrightness
          }
        ]
      };

      const endpoint = `/v1.0/iot-03/devices/${deviceId}/commands`;
      const url = `${TUYA_CONFIG.BASE_URL}${endpoint}`;

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

      if (response.status === 200) {
        return response.data.success || false;
      }

      return false;
    } catch (error) {
      console.error('Exception controlling device brightness:', error);
      return false;
    }
  }

  async setDeviceColor(deviceId: string, colorHex: string): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      if (!token) return false;

      const hsv = this.hexToHsv(colorHex);
      const tuyaHsv = {
        h: hsv[0],
        s: Math.max(0, Math.min(1000, hsv[1] * 10)),
        v: Math.max(0, Math.min(1000, hsv[2] * 10))
      };

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

      if (response.status === 200) {
        return response.data.success || false;
      }

      return false;
    } catch (error) {
      console.error('Exception controlling device color:', error);
      return false;
    }
  }

  async flashLight(deviceId: string, duration: number = 5000): Promise<boolean> {
    try {
      await this.setDevicePower(deviceId, true);
      await this.setDeviceColor(deviceId, '#FF0000');
      await this.setDeviceBrightness(deviceId, 100);
      await new Promise(resolve => setTimeout(resolve, duration));
      await this.setDevicePower(deviceId, false);
      return true;
    } catch (error) {
      console.error(`Error flashing light: ${error}`);
      return false;
    }
  }
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
    hex = hex.replace('#', '');
    
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
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

