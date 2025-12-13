export interface BibleBook {
  name: string;
  abbrev: string;
  chapters: number;
  testament: 'old' | 'new';
}

export interface ReadingPlan {
  id: string;
  name: string;
  books: string[];
  description: string;
  estimatedDays: number;
}

export interface ActivePlan {
  planId: string;
  startDate: string; // ISO Date
  isCompleted: boolean;
  completedDate?: string;
}

export interface UserProgress {
  user_email: string;
  user_name: string;
  chapters_read: string[];
  total_chapters: number;
  last_book: string;
  last_chapter: number;
  active_plans?: ActivePlan[]; // Novo campo
  id?: string;
}

export interface ChapterMetadata {
  id?: string;
  chapter_key: string;
  title: string;
  subtitle: string;
}

export interface Commentary {
  id?: string;
  book: string;
  chapter: number;
  verse: number;
  verse_key: string;
  commentary_text: string;
}

export interface DictionaryWord {
  original: string;
  transliteration: string;
  portuguese: string;
  polysemy: string;
  etymology: string;
  grammar: string;
}

export interface DictionaryEntry {
  id?: string;
  verse_key: string;
  book: string;
  chapter: number;
  verse: number;
  original_text: string;
  transliteration: string;
  key_words: DictionaryWord[];
}

export interface EBDContent {
  id?: string;
  study_key: string;
  book: string;
  chapter: number;
  title: string;
  outline: string[];
  student_content: string;
  teacher_content: string;
  last_generated_part?: number;
}

export interface Devotional {
  id?: string;
  date: string;
  title: string;
  reference: string;
  verse_text: string;
  body: string;
  prayer: string;
  is_published: boolean;
}