import * as vscode from 'vscode';
import { ModelConfig, ModelMode, modelConfigs } from './utils/modelConfig';
import { CompletionRequest, CompletionResponse, Completions, pingOllama } from './server';
import { CancellationToken } from 'vscode';


const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434'; // or vscode.workspace.getConfiguration("ollama_server")?
const spawn_server = 'ollama serve';

export function activate(context: vscode.ExtensionContext) {

	// say hello 
	let disposable = vscode.commands.registerCommand('walmart-copilot.helloWorld', () => {
		vscode.window.showInformationMessage('Hello from walmart-copilot! #gocodecrazy');
	});
	context.subscriptions.push(disposable);

	// push insert 
	const afterInsert = vscode.commands.registerCommand('walmart-copilot.afterInsert', (response: Completions) => {
		console.log(response);
		return response.completions;
	});
	context.subscriptions.push(afterInsert);
	
	// test autocomplete 
	const outputChannel = vscode.window.createOutputChannel('walmart copilot', { log: true });
	let autocomplete = vscode.commands.registerCommand('walmart-copilot.autocomplete', async () => {
		const suggestion = await getCodeSuggestion();
		outputChannel.append(suggestion ?? '')
		console.log(suggestion)
	})
	context.subscriptions.push(autocomplete)
	
	// TODO: handleModelConfigChange(context);
	const config = vscode.workspace.getConfiguration("model");

	// TODO: have to initiate suggestions for now with no delay
	const provider: vscode.InlineCompletionItemProvider = {
		async provideInlineCompletionItems(document, position, context, token) {
			console.log('provideInlineCompletionItems triggered');

			const config = vscode.workspace.getConfiguration("model");
			const modelConfig = modelConfigs['starcoder']; // FOR NOW HARDCODE

			const requestDelay = config.get("requestDelay") as number;

			if (position.line < 0) {
				return;
			}

			if (requestDelay > 0){
				const cancelled = await delay(requestDelay, token);
				if (cancelled) return;
			}

			const request = construct_request(position, document, modelConfig);
			try {
				const responses: Completions = await pingOllama(request);

				let code_items: vscode.InlineCompletionItem[] = [];
				for (const completion of responses.completions) {
					code_items.push({
						insertText: completion, 
						range: new vscode.Range(position, position),
						command: {
							title: 'afterInsert',
							command: 'model.afterInsert',
							arguments: [responses],
						}
					});
				}
				console.log(code_items);
				return code_items; // why is it different for them?
			} catch (e) {
				const err_msg = (e as Error).message;
				if (err_msg.includes("is currently loading")) {
					vscode.window.showWarningMessage(err_msg);
				} else if (err_msg !== "Canceled") {
					vscode.window.showErrorMessage(err_msg);
				}
			}

		},
	};

	vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, provider);
}

// make the request
function construct_request(position: vscode.Position, document: vscode.TextDocument, modelConfig: ModelConfig): CompletionRequest {
	
	// const text_document = client.code2ProtocolConverter.asTextDocumentIdentifier(document);
	const max_context_window = modelConfig['contextWindow'];
	const model_mode = ModelMode.FIM; // TODO: change
	const FIM = modelConfig['fillInTheMiddle'];
	// const tokenizer_config = modelConfig['tokenizer'];

	const offset = document.offsetAt(position); // const cursorPosition = vscode.window.activeTextEditor?.selection.active;
	const start = Math.max(0, offset - max_context_window);
	const end = Math.min(document.getText().length, offset + max_context_window);

	const raw_prefix_range = new vscode.Range(document.positionAt(start), position);
	const prefix_range = document.validateRange(raw_prefix_range);

	const position_plus_one = document.validatePosition(document.positionAt(offset + 1));
	const raw_suffix_range = new vscode.Range(position_plus_one, document.positionAt(end));
	const suffix_range = document.validateRange(raw_suffix_range)
	
	const prefix = document.getText(prefix_range);
	const suffix = document.getText(suffix_range);
	
	let prompt = FIM?.prefix + prefix + FIM?.suffix + suffix + FIM?.middle;

	return {
		model: modelConfig['modelID'],
		prompt: prompt,
		options: modelConfig['options'],
		stream: false
	};
}

async function getCodeSuggestion() {
	const document = vscode.window.activeTextEditor?.document;
	if (!document) return;
	const position = vscode.window.activeTextEditor?.selection.active;
	if (!position) return;
	const modelConfig = modelConfigs['starcoder']; // FOR NOW HARDCODE 

	const request = construct_request(position, document, modelConfig);
		try {
			const responses: Completions = await pingOllama(request);

			let code_items = '';
			for (const completion of responses.completions) {
				code_items += completion;
			}
			console.log(code_items);
			return code_items; // why is it different for them?
		} catch (e) {
			const err_msg = (e as Error).message;
			if (err_msg.includes("is currently loading")) {
				vscode.window.showWarningMessage(err_msg);
			} else if (err_msg !== "Canceled") {
				vscode.window.showErrorMessage(err_msg);
			}
		}	
}

async function delay(milliseconds: number, token: vscode.CancellationToken): Promise<boolean> {
	/**
	 * Wait for a number of milliseconds, unless the token is cancelled.
	 * It is used to delay the request to the server, so that the user has time to type.
	 *
	 * @param milliseconds number of milliseconds to wait
	 * @param token cancellation token
	 * @returns a promise that resolves with false after N milliseconds, or true if the token is cancelled.
	 *
	 * @remarks This is a workaround for the lack of a debounce function in vscode.
	*/
    return new Promise<boolean>((resolve) => {
        const interval = setInterval(() => {
            if (token.isCancellationRequested) {
                clearInterval(interval);
                resolve(true)
            }
        }, 10); // Check every 10 milliseconds for cancellation

        setTimeout(() => {
            clearInterval(interval);
            resolve(token.isCancellationRequested)
        }, milliseconds);
    });
}

// This method is called when your extension is deactivated
export function deactivate() {}