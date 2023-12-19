import * as vscode from 'vscode';
import {
	DocumentFilter,
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { ModelConfig, modelConfigs } from './utils/modelConfig';
import { homedir } from 'os';

// final completion 
interface CompletionResponse {
	model: string,
	created_at: string,
	response: string,
	done: boolean,
	// params below only exist on the last completion if STREAM
	total_duration?: number,
	load_duration?: number,
	prompt_eval_count?: number,
	prompt_eval_duration?: number,
	eval_count?: number,
	eval_duration?: number
}

let client: LanguageClient;

const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434'; // or vscode.workspace.getConfiguration("ollama_server")?

export function activate(context: vscode.ExtensionContext) {

	// say hello 
	let disposable = vscode.commands.registerCommand('walmart-copilot.sayHello', () => {
		vscode.window.showInformationMessage('Hello from walmart-copilot! #gocodecrazy');
	});
	context.subscriptions.push(disposable);
	
	// TODO: handleModelConfigChange(context);
	const config = vscode.workspace.getConfiguration("model");
	
	// TODO: figure out what this does??
	const binaryPath: string | null = config.get("lsp.binaryPath") as string | null;
	let command: string;
	if (binaryPath) {
		command = binaryPath;
	} else {
		const ext = process.platform === "win32" ? ".exe" : "";
		command = vscode.Uri.joinPath(context.extensionUri, "server", `llm-ls${ext}`).fsPath;
	}
	if (command.startsWith("~/")) {
		command = homedir() + command.slice("~".length);
	}

	// --inspect=6019: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	// let debugOptions = { execArgv: ['--nolazy', '--inspect=6029'] };

	const serverOptions: ServerOptions = {
		run: { command, transport: TransportKind.ipc },
		debug: {
			command,
			transport: TransportKind.ipc,
			// options: debugOptions // TODO: fix debug??
		}
	};

	const outputChannel = vscode.window.createOutputChannel('walmart copilot', { log: true });
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: "*" }],
		outputChannel,
	};
	client = new LanguageClient(
		'model',
		'walmart copilot',
		serverOptions,
		clientOptions
	);

	client.start();

	// have to initiate suggestions for now with no delay
	const provider: vscode.InlineCompletionItemProvider = {
		async provideInlineCompletionItems(document, position, context, token) {
			// const config = vscode.workspace.getConfiguration("model");
			const modelConfig = modelConfigs['starcoder']; // FOR NOW HARDCODE
			if (position.line < 0) {
				return;
			}
			const prompt = construct_prompt(position, document, modelConfig)
			const request_params = {
				model: modelConfig['modelID'],
				prompt: prompt,
				model_options: modelConfig['options'],
				stream: false
			};
			try {
				const response: CompletionResponse = await client.sendRequest(DEFAULT_OLLAMA_HOST, request_params);

				let code_items: vscode.InlineCompletionItem[] = [];
				// make this multiple responses for streaming
				const completed_code: vscode.InlineCompletionItem = {
					insertText: response.response,
					// range: new vscode.Range(position, position),
					// command: {
					// 	title: 'afterInsert',
					// 	command: 'model.afterInsert',
					// 	arguments: [response],
					// }
				};
				code_items.push(completed_code);
				return code_items;

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
	const documentFilter = config.get("documentFilter") as DocumentFilter | DocumentFilter[];
	vscode.languages.registerInlineCompletionItemProvider(documentFilter, provider);
}

// make the prompt
function construct_prompt(position: vscode.Position, document: vscode.TextDocument, modelConfig: ModelConfig) {
	
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
	const suffix_range = document.validateRange(raw_suffix_range)
	
	const prefix = document.getText(prefix_range);
	const suffix = document.getText(suffix_range);
	
	let prompt = FIM?.prefix + prefix + FIM?.suffix + suffix + FIM?.middle;
	return prompt;
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

