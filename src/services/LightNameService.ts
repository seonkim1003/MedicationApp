import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'light_custom_names';

class LightNameService {
  private static instance: LightNameService;
  private customNames: Map<string, string> = new Map();

  private constructor() {
    this.loadCustomNames();
  }

  public static getInstance(): LightNameService {
    if (!LightNameService.instance) {
      LightNameService.instance = new LightNameService();
    }
    return LightNameService.instance;
  }

  private async loadCustomNames(): Promise<void> {
    try {
      const jsonString = await AsyncStorage.getItem(STORAGE_KEY);
      if (jsonString) {
        const names = JSON.parse(jsonString) as Record<string, string>;
        this.customNames = new Map(Object.entries(names));
        console.log('Light custom names loaded:', this.customNames.size);
      }
    } catch (error) {
      console.error('Error loading light custom names:', error);
    }
  }

  private async saveCustomNames(): Promise<void> {
    try {
      const names = Object.fromEntries(this.customNames);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(names));
      console.log('Light custom names saved');
    } catch (error) {
      console.error('Error saving light custom names:', error);
    }
  }

  async setCustomName(lightId: string, customName: string): Promise<void> {
    try {
      if (customName.trim()) {
        this.customNames.set(lightId, customName.trim());
      } else {
        this.customNames.delete(lightId);
      }
      await this.saveCustomNames();
    } catch (error) {
      console.error('Error setting custom name:', error);
      throw error;
    }
  }

  getCustomName(lightId: string): string | null {
    return this.customNames.get(lightId) || null;
  }

  async getDisplayName(lightId: string, defaultName: string): Promise<string> {
    await this.loadCustomNames();
    return this.customNames.get(lightId) || defaultName;
  }

  async removeCustomName(lightId: string): Promise<void> {
    try {
      this.customNames.delete(lightId);
      await this.saveCustomNames();
    } catch (error) {
      console.error('Error removing custom name:', error);
      throw error;
    }
  }
}

export default LightNameService;

