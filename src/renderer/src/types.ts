export interface Image {
  id: number
  filepath: string
  hash?: string
  scanned_at: string
  processed?: boolean
}

export interface Tag {
  id: number
  name: string
  count?: number
  is_favorite?: boolean
  is_hidden?: boolean
}

export interface TagGroup {
  id: number
  name: string
  tags: Tag[]
}

export interface ImageTag {
  image_id: number
  tag_id: number
  score: number
}

export interface Settings {
  threadCount: number
  language?: string
  libraryPath?: string
}
