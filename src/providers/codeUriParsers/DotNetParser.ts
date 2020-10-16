import * as vscode from 'vscode';
import { ICodeUriParser } from './ICodeUriParser';
import { StringUtil } from '../../util/StringUtil';
import * as fs from 'fs';
import * as path from 'path';

export class DotNetParser implements ICodeUriParser {

    parse(match: string): any {
        const matchSplit = match.split("::");
        let uri = matchSplit[1];
        let handlerName = matchSplit[2];
        const split = uri.split(".");
        const filePath = split.join("/");
        const lambdaDefinitions = {} as any;
        const basePath = path.join(__dirname, "..", "..", "..", "templates", "dotnet");
        
        const className = split.pop() as string;
        const namespaceName = split.join(".");
        for (const file of fs.readdirSync(basePath)) {
            const id = file.replace(".cs", "");
            lambdaDefinitions[id] = fs.readFileSync(path.join(basePath, file), "utf-8").replace("NAMESPACENAME", namespaceName).replace("CLASSNAME", className).replace("HANDLERNAME", handlerName);
        }
        return {
            linkedText: `${filePath}.cs`,
            relativePath: `${filePath.replace(`${matchSplit[0].trim().replace("\"", "")}/`, "")}.cs`,
            runtime: "dotnet",
            lambda: lambdaDefinitions
        };
    }

}
