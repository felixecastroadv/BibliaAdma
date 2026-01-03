
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
  password_pin?: string; 
  is_blocked?: boolean; 
  reset_requested?: boolean; 
  chapters_read: string[];
  total_chapters: number;
  last_book: string;
  last_chapter: number;
  active_plans?: ActivePlan[];
  ebd_read?: string[]; 
  total_ebd_read?: number; 
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

export interface PrayerRequest {
  id?: string;
  user_name: string;
  user_email: string;
  request_text: string;
  date: string; 
  prayer_count: number;
  category: 'saude' | 'familia' | 'espiritual' | 'financeiro' | 'outros';
}

export interface Announcement {
  id?: string;
  title: string;
  message: string;
  date: string;
  author: string;
  priority: 'alta' | 'normal';
}

export interface ContentReport {
  id?: string;
  type: 'commentary' | 'dictionary' | 'other';
  reference_text: string; 
  report_text: string;
  user_name?: string; 
  date: string;
  status: 'pending' | 'resolved';
}

export interface AppConfig {
    id: string; 
    theme: {
        primaryColor: string;
        secondaryColor: string;
        appName: string;
    };
    features: {
        enableRanking: boolean;
        enableDevotional: boolean;
        enablePlans: boolean;
        enableMessages: boolean;
    };
    auth: {
        requirePasswordLogin: boolean; 
        adminPassword?: string;
    };
}

export interface DynamicModule {
    id: string;
    type: 'quiz' | 'page' | 'link';
    title: string;
    description: string;
    iconName: string; 
    accessLevel: 'public' | 'admin' | 'login';
    data: any; 
}