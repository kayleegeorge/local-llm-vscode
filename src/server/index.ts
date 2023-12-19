
// TODO: make this a vscode extension config setting: vscode.workspace.getConfiguration("ollama_server") 
const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';

export interface CompletionRequest {
    model: string,
    prompt: string,
    options?: Record<string, any>,
    systemPrompt?: string
    stream?: boolean
}

// mid-way stream token response
export interface PartCompletionResponse {
	model: string,
	created_at: string,
	response: string,
	done: boolean
}

// final completion response
export interface FinalCompletionResponse {
	model: string,
	created_at: string,
	response: string,
	done: boolean,
	total_duration: number,
	load_duration: number,
	prompt_eval_count: number,
	prompt_eval_duration: number,
	eval_count: number,
	eval_duration: number
}

export type CompletionResponse = PartCompletionResponse | FinalCompletionResponse;
export interface Completions {
    completions: string[]
}

// Ollama stream
export const pingOllama = async (
    request: CompletionRequest,
  ): Promise<Completions> => {
    return new Promise(async (resolve, reject) => {
        try {
            const url = `${DEFAULT_OLLAMA_HOST}/api/generate`;
            const body = {
                'model': request.model,
                'prompt': request.prompt
            };
            
            const res = await fetch(url, {
                headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
                // 'Cache-Control': 'no-cache',
                // 'Pragma': 'no-cache',
                },
                method: 'POST',
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                reject('Network response was not ok');
                return;
            }
            
            const reader = res.body?.getReader();
            let results: Completions = { completions: [] };
        
            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break
            
                    const chunk = new TextDecoder().decode(value);
                    const parsedChunk: PartCompletionResponse = JSON.parse(chunk);
            
                    results.completions.push(parsedChunk.response);
                }
            }
            resolve(results);
        }
        catch (err) {
            reject(err);
        }
    });
};