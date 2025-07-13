// src/services/PromptingService.ts
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

interface PromptTemplate {
    role: string;
    instructions: string[];
    output_format?: {
        title: string;
        format: any;
    };
}

export class PromptingService {
    private promptTemplates: Record<string, PromptTemplate> = {};

    constructor() {
        this.loadPrompts();
    }

    private async loadPrompts(): Promise<void> {
        const filePath = path.resolve(__dirname, '..', 'prompts', 'prompts-base.json');
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            this.promptTemplates = JSON.parse(fileContent);
        } catch (error) {
            vscode.window.showErrorMessage('Error crítico: No se pudieron cargar los prompts desde prompts-base.json. Asegúrate de que el archivo existe y es un JSON válido.');
            console.error(error);
        }
    }

    private buildPrompt(templateKey: keyof typeof this.promptTemplates, replacements: Record<string, any>): string {
        const template = this.promptTemplates[templateKey];
        
        // [CORRECCIÓN] Añadir salvaguarda contra prompts no cargados
        if (!template || !template.instructions) {
            throw new Error(`La plantilla de prompt para "${String(templateKey)}" no se encontró o está corrupta. Revisa prompts-base.json.`);
        }

        let prompt = `${template.role}\n\n`;
        prompt += `${template.instructions.join('\n')}\n\n`;

        if (template.output_format) {
            prompt += `${template.output_format.title}\n`;
            prompt += `\`\`\`json\n${JSON.stringify(template.output_format.format, null, 2)}\n\`\`\`\n\n`;
        }

        // Aplicar los reemplazos de variables
        for (const key in replacements) {
            if (typeof replacements[key] === 'string') {
                 prompt = prompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), replacements[key]);
            }
        }
        
        // Añadir el código o la instrucción del usuario al final
        if(replacements.code) {
            prompt += `--- \nCode to Analyze (${replacements.language}):\n\`\`\`${replacements.language}\n${replacements.code}\n\`\`\``
        } else if (replacements.files) {
            // Manejar múltiples archivos para el diagrama UML
            prompt += `--- \nProject Files to Analyze:\n\n`;
            for (const file of replacements.files) {
                prompt += `// FILE: ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
            }
        }

        if(replacements.instruction) {
             prompt += `--- \nUSER INSTRUCTION:\n"${replacements.instruction}"\n---\n\nCODE SNIPPET (${replacements.language}):`
        }


        return prompt;
    }

    private getLanguageName(languageId: string): string {
        const languageMap: { [key: string]: string } = {
            'csharp': 'C#', 'javascript': 'JavaScript', 'typescript': 'TypeScript',
            'python': 'Python', 'java': 'Java', 'cpp': 'C++', 'c': 'C', 'sql': 'SQL',
        };
        return languageMap[languageId] || languageId;
    }

    public async getAnalysisPrompt(code: string, languageId: string): Promise<string> {
        const languageName = this.getLanguageName(languageId);
        return this.buildPrompt('analysis', { languageName, language: languageId, code });
    }

    public async getConceptualRefactorPrompt(code: string, languageId: string): Promise<string> {
        return this.buildPrompt('conceptual_refactor', { language: languageId, code });
    }
    
    public async getRefactorPrompt(code: string, languageId: string): Promise<string> {
        return this.buildPrompt('refactor', { language: languageId, code });
    }

    public async getGenerationPrompt(instruction: string, languageId: string): Promise<string> {
        const languageName = this.getLanguageName(languageId);
        return this.buildPrompt('generation', { language: languageName, instruction: instruction });
    }
    
    public async getExplainPrompt(code: string, languageId: string): Promise<string> {
        return this.buildPrompt('explain', { language: languageId, code });
    }

    public async getUnitTestPrompt(code: string, languageId: string): Promise<string> {
        return this.buildPrompt('unit_test', { language: languageId, code });
    }

    public async getStandardsPrompt(code: string, languageId: string): Promise<string> {
        return this.buildPrompt('standards', { language: languageId, code });
    }

    public async getDuplicateDetectionPrompt(code: string, languageId: string): Promise<string> {
        return this.buildPrompt('duplicate_detection', { language: languageId, code });
    }

   public async getUmlGenerationPrompt(file: { path: string, content: string }, contextSummary: string): Promise<string> {
        return this.buildPrompt('uml_generation', { file, contextSummary });
    }
}