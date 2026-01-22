/**
 * Data persistence service
 * Abstracts localStorage operations with error handling and data validation
 */

import { Patient, Provider } from '../types';

const STORAGE_KEYS = {
  PATIENTS: 'msimbazi_patients',
  PROVIDERS: 'msimbazi_providers',
  AUTH_TOKEN: 'msimbazi_auth_token',
  USER_ROLE: 'msimbazi_user_role',
} as const;

/**
 * Generic storage operations
 */
class StorageService {
  /**
   * Saves data to localStorage with error handling
   */
  private setItem<T>(key: string, value: T): boolean {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error(`Failed to save ${key} to localStorage:`, error);
      return false;
    }
  }

  /**
   * Retrieves data from localStorage with error handling
   */
  private getItem<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Failed to read ${key} from localStorage:`, error);
      return defaultValue;
    }
  }

  /**
   * Removes item from localStorage
   */
  private removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove ${key} from localStorage:`, error);
    }
  }

  /**
   * Patient storage operations
   */
  savePatients(patients: Patient[]): boolean {
    return this.setItem(STORAGE_KEYS.PATIENTS, patients);
  }

  loadPatients(defaultValue: Patient[] = []): Patient[] {
    return this.getItem<Patient[]>(STORAGE_KEYS.PATIENTS, defaultValue);
  }

  /**
   * Provider storage operations
   */
  saveProviders(providers: Provider[]): boolean {
    return this.setItem(STORAGE_KEYS.PROVIDERS, providers);
  }

  loadProviders(defaultValue: Provider[] = []): Provider[] {
    return this.getItem<Provider[]>(STORAGE_KEYS.PROVIDERS, defaultValue);
  }

  /**
   * Authentication storage operations
   */
  saveAuthToken(token: string): boolean {
    return this.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  loadAuthToken(): string | null {
    return this.getItem<string | null>(STORAGE_KEYS.AUTH_TOKEN, null);
  }

  clearAuthToken(): void {
    this.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    this.removeItem(STORAGE_KEYS.USER_ROLE);
  }

  saveUserRole(role: string): boolean {
    return this.setItem(STORAGE_KEYS.USER_ROLE, role);
  }

  loadUserRole(): string | null {
    return this.getItem<string | null>(STORAGE_KEYS.USER_ROLE, null);
  }

  /**
   * Clears all application data
   */
  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      this.removeItem(key);
    });
  }

  /**
   * Exports data for backup
   */
  exportData(): string {
    try {
      const data = {
        patients: this.loadPatients([]),
        providers: this.loadProviders([]),
        exportedAt: new Date().toISOString(),
      };
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Failed to export data:', error);
      return '';
    }
  }

  /**
   * Imports data from backup
   */
  importData(jsonData: string): { success: boolean; error?: string } {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.patients && Array.isArray(data.patients)) {
        this.savePatients(data.patients);
      }
      
      if (data.providers && Array.isArray(data.providers)) {
        this.saveProviders(data.providers);
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid data format'
      };
    }
  }
}

export const storageService = new StorageService();
