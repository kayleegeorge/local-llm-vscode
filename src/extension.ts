import * as vscode from 'vscode';
import { ModelConfig, ModelMode, modelConfigs } from './utils/modelConfig';
import { CompletionRequest, Completions, pingOllama } from './server';

const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434'; // or vscode.workspace.getConfiguration("ollama_server")?
const spawn_server = 'ollama serve';

export function activate(context: vscode.ExtensionContext) {

	// say hello 
	let disposable = vscode.commands.registerCommand('walmart-copilot.helloWorld', () => {
		vscode.window.showInformationMessage('Hello from walmart-copilot! #gocodecrazy');
	});
	context.subscriptions.push(disposable);

	// vscode.commands.registerCommand('walmart-copilot.command1', async (...args) => {
	// 	vscode.window.showInformationMessage('command1: ' + JSON.stringify(args));
	// });

	// test autocomplete 
	const outputChannel = vscode.window.createOutputChannel('walmart copilot', { log: true });
	let autocomplete = vscode.commands.registerCommand('walmart-copilot.autocomplete', async () => {
		const response = await getCodeSuggestion();
		if (!response) return
		const suggestion = response.items[0]; // first one
		outputChannel.append(suggestion.insertText ?? '');
		outputChannel.show();
	})
	context.subscriptions.push(autocomplete);
	
	
	// TODO: handleModelConfigChange(context);
	const config = vscode.workspace.getConfiguration("model");

	// TODO: have to initiate suggestions for now with no delay
	const provider: vscode.InlineCompletionItemProvider = {
		async provideInlineCompletionItems(document, position, context, token) {
			outputChannel.append('provideInlineCompletionItems triggered');

			const config = vscode.workspace.getConfiguration("model");
			const model_mode = ModelMode.FIM; // TODO: change

			const autoSuggest = false;
			const modelConfig = modelConfigs['starcoder']; // FOR NOW HARDCODE
			const requestDelay = 150; // default

			// no autotrigger
			if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic && !autoSuggest) {
				outputChannel.append('canceling because autosuggest disabled');
				return;
			}

			if (position.line < 0) {
				return;
			}
			if (requestDelay > 0){
				const cancelled = await delay(requestDelay, token);
				if (cancelled){
					return;
				}
			}

			// construct the request
			let request;
			if (model_mode === ModelMode.FIM) {
				request = construct_FIM_request(position, document, modelConfig);
			} else {
				request = construct_TA_request(position, document, modelConfig);
			}
			if (!request) return

			// query the model
			try {
				const response: Completions = await pingOllama(request);

				let items = [];
				for (const completion of response.completions) {
					items.push({
						insertText: completion.code_complete, 
						range: new vscode.Range(position, position),
						command: {
							title: 'autocomplete',
							command: 'walmart-copilot.autocomplete',
							arguments: [response],
						}
					});
				}
				return { items };
			} catch (e) {
				const err_msg = (e as Error).message;
				console.log('error:', e);
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

// create a request based on FIM prompt structure
function construct_FIM_request(position: vscode.Position, document: vscode.TextDocument, modelConfig: ModelConfig): CompletionRequest {
	
	// const text_document = client.code2ProtocolConverter.asTextDocumentIdentifier(document);
	const max_context_window = modelConfig['contextWindow'];
	const FIM = modelConfig['fillInTheMiddle'];
	// const tokenizer_config = modelConfig['tokenizer'];

	const offset = document.offsetAt(position); // const cursorPosition = vscode.window.activeTextEditor?.selection.active;
	const start = Math.max(0, offset - max_context_window);
	const end = Math.min(document.getText().length, offset + max_context_window);

	const raw_prefix_range = new vscode.Range(document.positionAt(start), position);
	const prefix_range = document.validateRange(raw_prefix_range);

	const position_plus_one = document.validatePosition(document.positionAt(offset + 1));
	const raw_suffix_range = new vscode.Range(position_plus_one, document.positionAt(end));
	const suffix_range = document.validateRange(raw_suffix_range);
	
	const prefix = document.getText(prefix_range);
	const suffix = document.getText(suffix_range);
	
	let prompt = FIM?.prefix + prefix + FIM?.suffix + suffix + FIM?.middle;

	return {
		model: modelConfig['modelID'],
		prompt: prompt,
		options: modelConfig['options'],
		stream: false // false for now
	};
}

/**
 * ask the model something when query is selected 
 */
function construct_TA_request(position: vscode.Position, document: vscode.TextDocument, modelConfig: ModelConfig): CompletionRequest | undefined {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return

	const selection = editor.selection;
	let query;
	if (selection && !selection.isEmpty) {
		const selectionRange = new vscode.Range(selection.start.line, selection.start.character, selection.end.line, selection.end.character);
		query = editor.document.getText(selectionRange);
	}
	let prompt = 'You are an expert programmer that writes simple, concise code and explanations.' + query;
	
	return {
		model: modelConfig['modelID'],
		prompt: prompt,
		options: modelConfig['options'],
		stream: false
	};	
}


// FOR TESTING PURPOSES TO SEE AUTOCOMPLETE
async function getCodeSuggestion() {
	const document = vscode.window.activeTextEditor?.document;
	if (!document) return;
	const position = vscode.window.activeTextEditor?.selection.active;
	if (!position) return;
	const modelConfig = modelConfigs['starcoder']; // FOR NOW HARDCODE

	const request = construct_FIM_request(position, document, modelConfig);
		try {
			const response: Completions = await pingOllama(request);

				let items = [];
				for (const completion of response.completions) {
					items.push({
						insertText: completion.code_complete, 
						range: new vscode.Range(position, position),
						command: {
							title: 'autocomplete',
							command: 'walmart-copilot.autocomplete',
							arguments: [response],
						}
					});
				}	
				return { items };
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
