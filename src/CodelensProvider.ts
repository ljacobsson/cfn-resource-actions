import * as vscode from 'vscode';
import { TemplateParser } from './TemplateParser';
import { StackResourceSummaries } from 'aws-sdk/clients/cloudformation';
import AWS = require('aws-sdk');
import { LambdaActionProvider } from './actions/LambdaActionProvider';
import { DynamoDBActionProvider } from './actions/DynamoDBActionProvider';

export class CodelensProvider implements vscode.CodeLensProvider {

    private codeLenses: vscode.CodeLens[] = [];
    private parser: TemplateParser;
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    private actionArgs: { [index: string]: any } = {
        ...new LambdaActionProvider().getActions(),
        ...new DynamoDBActionProvider().getActions()
    };
    stackResources: StackResourceSummaries;

    constructor(stackResources: StackResourceSummaries) {
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
        this.parser = new TemplateParser();
        this.stackResources = stackResources;
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        if (
            vscode.workspace
                .getConfiguration("cfn-resource-actions")
                .get("enableCodeLens", true)
        ) {
            try {
                this.codeLenses = [];
                const text = document.getText();
                const resources = this.parser.parse(text) as any[];
                let matches;
                //
                for (const res of resources) {
                    const regex = new RegExp(`([^a-zA-Z0-9]${res.name}[^a-zA-Z0-9])`, "g");
                    while ((matches = regex.exec(text)) !== null) {
                        const line = document.lineAt(document.positionAt(matches.index).line);
                        const indexOf = line.text.indexOf(matches[0]);
                        const position = new vscode.Position(line.lineNumber, indexOf);
                        const range = document.getWordRangeAtPosition(
                            position,
                            new RegExp(regex)
                        );
                        if (range && this.actionArgs[res.type]) {
                            const resource = this.stackResources.filter(p => p.LogicalResourceId === res.name)[0];
                            for (const item of this.actionArgs[res.type](resource.PhysicalResourceId)) {
                                this.codeLenses.push(new vscode.CodeLens(range, item));
                            }
                        }
                    }
                }
                return this.codeLenses;
            } catch (err) {
                console.log(err);
            }
        }
        return [];
    }
    public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
        if (vscode.workspace.getConfiguration("cfn-resource-actions").get("enableCodeLens", true)) {
            return codeLens;
        }
        return null;
    }
}