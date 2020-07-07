import * as vscode from 'vscode';
import { StackResourceSummaries } from 'aws-sdk/clients/cloudformation';
import { LambdaActionProvider } from '../actions/LambdaActionProvider';
import { DynamoDBActionProvider } from '../actions/DynamoDBActionProvider';
import { SNSActionProvider } from '../actions/SNSActionProvider';
import { SQSActionProvider } from '../actions/SQSActionProvider';

export class CodelensProvider implements vscode.CodeLensProvider {

    private codeLenses: vscode.CodeLens[] = [];
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    private actionArgs: { [index: string]: any } = {
        ...new LambdaActionProvider().getActions(),
        ...new DynamoDBActionProvider().getActions(),
        ...new SNSActionProvider().getActions(),
        ...new SQSActionProvider().getActions(),
    };
    
    stackResources: StackResourceSummaries;

    constructor(stackResources: StackResourceSummaries) {
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
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
                let matches;
                //
                for (const res of this.stackResources) {
                    const regex = new RegExp(`([^a-zA-Z0-9]${res.LogicalResourceId}[^a-zA-Z0-9])`, "g");
                    while ((matches = regex.exec(text)) !== null) {
                        const line = document.lineAt(document.positionAt(matches.index).line);
                        const indexOf = line.text.indexOf(matches[0]);
                        if (indexOf < 0) {
                            continue;
                        };
                        const position = new vscode.Position(line.lineNumber, indexOf);
                        const range = document.getWordRangeAtPosition(
                            position,
                            new RegExp(regex)
                        );
                        try {
                            if (range && this.actionArgs[res.ResourceType]) {
                                for (const item of this.actionArgs[res.ResourceType](res.PhysicalResourceId)) {
                                    this.codeLenses.push(new vscode.CodeLens(range, item));
                                }
                            }
                        } catch (err) {
                            console.log(err);
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