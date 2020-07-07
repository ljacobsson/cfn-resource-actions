import * as vscode from 'vscode';
import * as path from 'path';
import { NodeJSParser } from './codeUriParsers/NodeJSParser';
import { StringUtil } from '../util/StringUtil';
import { ICodeUriParser } from './codeUriParsers/ICodeUriParser';
import { DotNetParser } from './codeUriParsers/DotNetParser';
import { PythonParser } from './codeUriParsers/PythonParser';

export class LambdaHandlerProvider implements vscode.DefinitionProvider {

    parse(document: vscode.TextDocument, position: vscode.Position): any {
        const runtimeMatches = new RegExp("Runtime*:*(.+)").exec(document.getText());
        const runtime = runtimeMatches ? StringUtil.cleanString(runtimeMatches[1] as string).split(/[0-9]/)[0]: "unknown";

        const codeUriMatches = new RegExp("CodeUri*:*(.+)").exec(document.getText()) as any;
        const codeUri = codeUriMatches ? StringUtil.cleanString(codeUriMatches[1] as string).split(/[0-9]/)[0].replace("./", ""): "";

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
                switch(runtime) {
                    case "nodejs": parser = new NodeJSParser(); break;
                    case "dotnetcore": parser = new DotNetParser(); break;
                    case "python": parser = new PythonParser(); break;
                }
                return parser.parse(matches[1], codeUri);         
            }
        }

        return null;
    }

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition> {

        // assume all functions use the same runtime
        
        const linkText = this.parse(document, position);
        if (!linkText) {
            return null;
        }

        const workspace = vscode.workspace.getWorkspaceFolder(document.uri);
        const root = workspace ? workspace.uri : document.uri;

        return new vscode.Location(
            root.with({
                path: path.join(root.path, linkText)
            }),
            new vscode.Position(0, 0));
    }
}

