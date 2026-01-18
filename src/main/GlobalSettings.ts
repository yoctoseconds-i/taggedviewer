import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

export interface GlobalSettingsData {
  recentLibraries: string[]
  lastOpenLibrary: string | null
}

const DEFAULT_SETTINGS: GlobalSettingsData = {
  recentLibraries: [],
  lastOpenLibrary: null,
}

export class GlobalSettings {
  private path: string
  private data: GlobalSettingsData

  constructor() {
    this.path = join(app.getPath('userData'), 'global-settings.json')
    this.data = this.load()
  }

  private load(): GlobalSettingsData {
    try {
      if (existsSync(this.path)) {
        return JSON.parse(readFileSync(this.path, 'utf8'))
      }
    } catch (e) {
      console.error('Failed to load global settings', e)
    }
    return { ...DEFAULT_SETTINGS }
  }

  private save() {
    try {
      writeFileSync(this.path, JSON.stringify(this.data, null, 2))
    } catch (e) {
      console.error('Failed to save global settings', e)
    }
  }

  get recentLibraries(): string[] {
    return this.data.recentLibraries
  }

  get lastOpenLibrary(): string | null {
    return this.data.lastOpenLibrary
  }

  addRecentLibrary(path: string) {
    if (!path) return
    // Remove if exists to move to top
    this.data.recentLibraries = this.data.recentLibraries.filter((p) => p !== path)
    this.data.recentLibraries.unshift(path)
    // Keep max 10
    if (this.data.recentLibraries.length > 10) {
      this.data.recentLibraries.length = 10
    }
    this.data.lastOpenLibrary = path
    this.save()
  }

  setLastOpenLibrary(path: string | null) {
    this.data.lastOpenLibrary = path
    this.save()
  }
}

export const globalSettings = new GlobalSettings()
