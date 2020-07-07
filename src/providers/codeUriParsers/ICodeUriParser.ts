import * as vscode from 'vscode';

export interface ICodeUriParser {
    parse(match: string, codeUri?: string): string;
}