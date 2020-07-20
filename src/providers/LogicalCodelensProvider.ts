import * as vscode from 'vscode';
import { TemplateParser } from '../util/TemplateParser';
import { EventsActionProvider } from '../actions/EventsActionProvider';
import { DrawIoActionProvider } from '../actions/DrawIoActionProvider';
const fs = require("fs");
const path = require("path");
export class LogicalCodelensProvider implements vscode.CodeLensProvider {

    private codeLenses: vscode.CodeLens[] = [];
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    private actionArgs: { [index: string]: any } = {
        ...new EventsActionProvider().getLogicalActions(),
        ...new DrawIoActionProvider().getLogicalActions(),
    };

    constructor() {
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
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
                if (!text.includes("AWSTemplateFormatVersion")) {
                    return [];
                }
                const template = TemplateParser.parse(text);
                let matches;
                //
                //if (!TemplateParser.isJson) {
                try {
                    this.addStackCodeLens(document);
                } catch (err) {
                    console.log(err);
                }
                //}
                for (const resKey of Object.keys(template.Resources)) {
                    const resObj = template.Resources[resKey];
                    const regex = new RegExp(`([^a-zA-Z0-9]${resKey}[^a-zA-Z0-9])`, "g");
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
                            if (range && this.actionArgs[resObj.Type]) {
                                for (const item of this.actionArgs[resObj.Type](resObj)) {
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

    private addStackCodeLens(document: vscode.TextDocument) {
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 3));
        this.codeLenses.push(new vscode.CodeLens(range, {
            title: `Deploy`,
            tooltip: "Deploy using SAM CLI",
            command: "cfn-resource-actions.runShellCommand",
            arguments: [`sam deploy -t ${document.fileName}`]
        }));
        for(const arg of this.actionArgs["Global"](document)) {
            this.codeLenses.push(new vscode.CodeLens(range, arg));
        }        
        const rootPath = document.fileName.substring(0, document.fileName.lastIndexOf(path.sep));
        if (!fs.existsSync(path.join(rootPath, "samconfig.toml"))) {
            this.codeLenses.push(
                new vscode.CodeLens(range, {
                    title: `Deploy guided`,
                    tooltip: "Deploy using SAM CLI",
                    command: "cfn-resource-actions.runShellCommand",
                    arguments: [`sam deploy --guided -t ${document.fileName}`]
                }));
        }
    }

    public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
        if (vscode.workspace.getConfiguration("cfn-resource-actions").get("enableCodeLens", true)) {
            return codeLens;
        }
        return null;
    }
}