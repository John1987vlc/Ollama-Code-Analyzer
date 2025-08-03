export interface ParsedWebviewContent {
    thinking: string;
    markdownContent: string;
    codeBlocks: { language: string; code: string }[];
    referencedFilesTitle?: string;
}

export interface UmlProgressState {
    processedFiles: { path: string; components: string }[];
    remainingFiles: number;
}