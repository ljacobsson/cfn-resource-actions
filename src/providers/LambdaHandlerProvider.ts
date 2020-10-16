import * as vscode from 'vscode';
import * as path from 'path';
import { NodeJSParser } from './codeUriParsers/NodeJSParser';
import { StringUtil } from '../util/StringUtil';
import { ICodeUriParser } from './codeUriParsers/ICodeUriParser';
import { DotNetParser } from './codeUriParsers/DotNetParser';
import { PythonParser } from './codeUriParsers/PythonParser';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';

export class LambdaHandlerProvider implements vscode.DefinitionProvider {

    parse(document: vscode.TextDocument, position: vscode.Position): any {
        const runtimeMatches = new RegExp("Runtime*:*(.+)").exec(document.getText());
        const runtime = runtimeMatches ? StringUtil.cleanString(runtimeMatches[1] as string).split(/[0-9]/)[0] : "unknown";
        const codeUriMatches = new RegExp("CodeUri*:*(.+)").exec(document.getText()) as any;
        const codeUri = codeUriMatches ? StringUtil.cleanString(codeUriMatches[1] as string).split(/[0-9]/)[0].replace("./", "") : "";

        let isJson = StringUtil.isJson(document.getText());
        const regex = isJson ? new RegExp(`"Handler":*(.+)`, "g") : new RegExp(`Handler:(.+)`, "g");
        let matches;
        while ((matches = regex.exec(document.getText())) !== null) {

            const line = document.lineAt(document.positionAt(matches.index).line);
            const indexOf = line.text.indexOf(matches[1]);
            if (indexOf < 0) {
                continue;
            };
            const handlerPosition = new vscode.Position(line.lineNumber, indexOf);
            const range = document.getWordRangeAtPosition(
                position,
                new RegExp(":*(.+)")
            );
            if (range?.contains(handlerPosition)) {
                let parser: ICodeUriParser = new NodeJSParser();
                switch (runtime) {
                    case "nodejs": parser = new NodeJSParser(); break;
                    case "dotnetcore": parser = new DotNetParser(); break;
                    case "python": parser = new PythonParser(); break;
                }
                return parser.parse(matches[1], codeUri);
            }
        }

        return null;
    }

    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location | vscode.Location[] | null | undefined> {

        // assume all functions use the same runtime
        const parsed = this.parse(document, position);
        const linkText = parsed.linkedText;
        if (!linkText) {
            return null;
        }
        const workspace = vscode.workspace.getWorkspaceFolder(document.uri);
        const root = workspace ? workspace.uri : document.uri;
        
        const filePath = path.join(path.dirname(document.fileName), parsed.relativePath);
        if (!fs.existsSync(filePath)) {
            const answer = await vscode.window.showQuickPick([{
                label: `Cancel`,
                action: "cancel"
            },
            {
                label: `Create ${parsed.runtime} Lambda handler`,
                action: "create"
            }]);

            if (answer && answer.action === "create") {
                mkdirp.sync(path.dirname(filePath));
                fs.writeFileSync(`${filePath}`, parsed.lambda["generic"]);
            }
        }
        return new vscode.Location(
            root.with({
                path: filePath
            }),
            new vscode.Position(0, 0));
    }
}

