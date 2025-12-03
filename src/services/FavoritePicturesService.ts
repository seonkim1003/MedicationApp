import AsyncStorage from '@react-native-async-storage/async-storage';
import { FavoritePicture } from '../types';

const STORAGE_KEY = 'favorite_pictures';

class FavoritePicturesService {
  private static instance: FavoritePicturesService;
  
  private constructor() {}
  
  public static getInstance(): FavoritePicturesService {
    if (!FavoritePicturesService.instance) {
      FavoritePicturesService.instance = new FavoritePicturesService();
    }
    return FavoritePicturesService.instance;
  }

  async savePictures(pictures: FavoritePicture[]): Promise<void> {
    try {
      const jsonString = JSON.stringify(pictures);
      await AsyncStorage.setItem(STORAGE_KEY, jsonString);
      console.log('Favorite pictures saved:', pictures.length, 'items');
    } catch (error) {
      console.error('Error saving favorite pictures:', error);
      throw error;
    }
  }

  async loadPictures(): Promise<FavoritePicture[]> {
    try {
      const jsonString = await AsyncStorage.getItem(STORAGE_KEY);
      if (!jsonString) {
        return [];
      }
      const pictures = JSON.parse(jsonString) as FavoritePicture[];
      const normalizedPictures: FavoritePicture[] = [];
      const seenIds = new Set<string>();
      let needsResave = false;

      pictures.forEach((picture) => {
        let id = picture.id?.toString();
        if (!id || seenIds.has(id)) {
          needsResave = true;
          id = this.generateUniqueId();
        }
        seenIds.add(id);
        normalizedPictures.push({
          ...picture,
          id,
        });
      });

      if (needsResave) {
        await this.savePictures(normalizedPictures);
      }

      console.log('Favorite pictures loaded:', normalizedPictures.length, 'items');
      return normalizedPictures;
    } catch (error) {
      console.error('Error loading favorite pictures:', error);
      return [];
    }
  }

  private generateUniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async addPicture(uri: string): Promise<FavoritePicture> {
    try {
      const pictures = await this.loadPictures();
      const newPicture: FavoritePicture = {
        id: this.generateUniqueId(),
        uri: uri,
        createdAt: new Date().toISOString(),
      };
      pictures.push(newPicture);
      await this.savePictures(pictures);
      console.log('Picture added to favorites');
      return newPicture;
    } catch (error) {
      console.error('Error adding picture:', error);
      throw error;
    }
  }

  async removePicture(pictureId: string): Promise<void> {
    try {
      const pictures = await this.loadPictures();
      const filteredPictures = pictures.filter(p => p.id !== pictureId);
      await this.savePictures(filteredPictures);
      console.log('Picture removed from favorites:', pictureId);
    } catch (error) {
      console.error('Error removing picture:', error);
      throw error;
    }
  }

  async getRandomPicture(): Promise<FavoritePicture | null> {
    try {
      const pictures = await this.loadPictures();
      if (pictures.length === 0) {
        return null;
      }
      const randomIndex = Math.floor(Math.random() * pictures.length);
      return pictures[randomIndex];
    } catch (error) {
      console.error('Error getting random picture:', error);
      return null;
    }
  }

  async getPictureCount(): Promise<number> {
    try {
      const pictures = await this.loadPictures();
      return pictures.length;
    } catch (error) {
      console.error('Error getting picture count:', error);
      return 0;
    }
  }
}

export default FavoritePicturesService;


