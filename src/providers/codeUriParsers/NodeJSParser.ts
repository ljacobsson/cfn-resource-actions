import { ICodeUriParser } from './ICodeUriParser';
import * as fs from 'fs';
import * as path from 'path';
export class NodeJSParser implements ICodeUriParser {

    parse(match: string, codeUri: string): any {
        const handlerName = match.split(".")[1];
        const link = (codeUri.length ? `${codeUri}/` : "") + match.split(".")[0].replace(/\"/g, "").replace(/'/g, "").replace(/:/g, "").trim() + ".js";
        const lambdaDefinitions = {} as any;
        const basePath = path.join(__dirname, "..", "..", "..", "templates", "nodejs");
        for (const file of fs.readdirSync(basePath)) {
            const id = file.replace(".js", "");
            lambdaDefinitions[id] = fs.readFileSync(path.join(basePath, file), "utf-8").replace("HANDLERNAME", handlerName);
        }
        return {
            linkedText: link,
            relativePath: link,
            runtime: "nodejs",
            lambda: lambdaDefinitions
        };
    }
}