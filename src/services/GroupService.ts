import AsyncStorage from '@react-native-async-storage/async-storage';
import { MedicationGroup } from '../types';

const STORAGE_KEY = 'medication_groups';

class GroupService {
  private static instance: GroupService;

  private constructor() {}

  public static getInstance(): GroupService {
    if (!GroupService.instance) {
      GroupService.instance = new GroupService();
    }
    return GroupService.instance;
  }

  async saveGroups(groups: MedicationGroup[]): Promise<void> {
    try {
      const jsonString = JSON.stringify(groups);
      await AsyncStorage.setItem(STORAGE_KEY, jsonString);
      console.log('Groups saved:', groups.length, 'items');
    } catch (error) {
      console.error('Error saving groups:', error);
      throw error;
    }
  }

  async loadGroups(): Promise<MedicationGroup[]> {
    try {
      const jsonString = await AsyncStorage.getItem(STORAGE_KEY);
      if (!jsonString) {
        return [];
      }
      const groups = JSON.parse(jsonString) as MedicationGroup[];
      console.log('Groups loaded:', groups.length, 'items');
      return groups;
    } catch (error) {
      console.error('Error loading groups:', error);
      return [];
    }
  }

  async addGroup(group: MedicationGroup): Promise<void> {
    try {
      const groups = await this.loadGroups();
      groups.push(group);
      await this.saveGroups(groups);
      console.log('Group added:', group.name);
    } catch (error) {
      console.error('Error adding group:', error);
      throw error;
    }
  }

  async updateGroup(updatedGroup: MedicationGroup): Promise<void> {
    try {
      const groups = await this.loadGroups();
      const index = groups.findIndex(g => g.id === updatedGroup.id);
      if (index !== -1) {
        groups[index] = {
          ...updatedGroup,
          updatedAt: new Date().toISOString()
        };
        await this.saveGroups(groups);
        console.log('Group updated:', updatedGroup.name);
      } else {
        console.log('Group not found for update:', updatedGroup.name);
      }
    } catch (error) {
      console.error('Error updating group:', error);
      throw error;
    }
  }

  async deleteGroup(groupId: string): Promise<void> {
    try {
      const groups = await this.loadGroups();
      const filteredGroups = groups.filter(g => g.id !== groupId);
      await this.saveGroups(filteredGroups);
      console.log('Group deleted:', groupId);
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }

  async getGroup(groupId: string): Promise<MedicationGroup | null> {
    try {
      const groups = await this.loadGroups();
      return groups.find(g => g.id === groupId) || null;
    } catch (error) {
      console.error('Error getting group:', error);
      return null;
    }
  }
}

export default GroupService;

