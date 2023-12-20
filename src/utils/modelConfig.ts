
/**
 * REFERENCE
 * https://github.com/huggingface/llm-vscode/blob/master/src/configTemplates.ts
 **/

/**
 * DOCS
 * 
 * https://github.com/huggingface/blog/blob/main/starcoder.md
 * - tech assistant mode
 * 
 */

/**
 * FEATURES:
 * - tech assisstant 
 * - code generation & fill in the middle
 */

export enum ModelMode {
    FIM = 'fillInTheMiddle',
    TA = 'techAssisstant'
}

enum Model {
    starcoder = "starcoder", 
    mixtral = "mixtral",
    codellama = "codellama",
    wizardcoder = "wizardcoder", 
    deepseek = "deepseek-coder", 
    magicoder = "magicoder", 

    // "phind-codellama", 
    // "codeup", 
    // "openhermes2.5-mistral", 
    // "open-orca-platypus2", 
    custom = "custom"
}

interface TokenizerRepoConfig {
    repository: string;
}


interface FillInTheMiddle {
    prefix: string,
    middle: string,
    suffix: string
}


// MODES : 
// - fill in the middle / code completion (ollama run codellama:7b-code)
// - ask questions (ollama run codellama:7b-instruct) // instruct is just used for natural language
// - code review (prompt with 'find bug')
// - test (prompt with 'write test')

export interface ModelConfig {
    modelID: string;
    contextWindow: number;
    fillInTheMiddle?: FillInTheMiddle;
    tokenizer?: TokenizerRepoConfig;
    options?: Record<string, any>
}

// 7B 
const StarCoderConfig: ModelConfig = {
    modelID: "starcoder",
    fillInTheMiddle: {
        prefix: "<fim_prefix>",
        middle: "<fim_middle>",
        suffix: "<fim_suffix>"
    },
    options: {
        temperature: 0.2,
        stop: ["<|endoftext|>"],
        top_p: 0.95,
        do_sample: true,
        max_new_tokens: 60
    },
    contextWindow: 8192,
    // tokenizer: {
    //     repository: "bigcode/starcoder",
    // }
}

const CodeLlama13BConfig: ModelConfig = {
    modelID: "codellama/CodeLlama-13b-hf",
    fillInTheMiddle: {
        prefix: "<PRE> ",
        middle: "<MID>",
        suffix: " <SUF>"
    },
    contextWindow: 4096,
    tokenizer: {
        repository: "codellama/CodeLlama-13b-hf",
    },
    options: {
        temperature: 0.2,
        stop: ["<EOT>"],
        top_p: 0.95,
        do_sample: true,
        max_new_tokens: 60
    }
}

export const modelConfigs = {
    "starcoder": StarCoderConfig,
    "codellama": CodeLlama13BConfig,
}