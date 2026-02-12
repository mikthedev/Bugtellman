export type Severity = 'minor' | 'low' | 'medium' | 'high' | 'urgent';

/** technical = code/API issues for devs; manual = UI/broken links for non-tech QA */
export type Audience = 'technical' | 'manual';

export interface QAIssue {
  id: string;
  category: string;
  severity: Severity;
  audience?: Audience; // defaults to technical if missing
  title: string;
  description: string;
  /** QA-style first-person explanation */
  qaComment?: string;
  /** Step-by-step fix instructions */
  fix?: string;
  /** Why Bugtellman flagged this (Code Crimes - technical explanation) */
  whyFlagged?: string;
  /** Suggested corrected code (rendered in code block) */
  suggestedCode?: string;
  location?: string;
  snippet?: string;
  line?: number;
  selector?: string;
  url?: string;
  /** Screenshot URL for this issue (precise element or page) */
  screenshotUrl?: string;
  /** Page URL where issue exists (for element screenshots) */
  pageUrl?: string;
  /** CSS selector for element screenshot (Microlink screenshot.element) */
  screenshotSelector?: string;
  /** Device for screenshot (e.g. iPhone 12 for viewport issues) */
  screenshotDevice?: string;
}

export interface AnalysisResult {
  issues: QAIssue[];
  /** Screenshot of analyzed page (URL analysis only) */
  pageScreenshot?: string;
  /** Analyzed URL (for context) */
  analyzedUrl?: string;
  summary: {
    total: number;
    urgent: number;
    high: number;
    medium: number;
    low: number;
    minor: number;
  };
  stats: {
    totalPages: number;
    totalLinks: number;
    brokenLinks: number;
    totalImages: number;
    imagesWithoutAlt: number;
  };
}

export interface WebsiteFile {
  name: string;
  content: string;
  type: 'html' | 'css' | 'js';
}
