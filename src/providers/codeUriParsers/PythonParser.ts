import { ICodeUriParser } from './ICodeUriParser';
import * as fs from 'fs';
import * as path from 'path';

export class PythonParser implements ICodeUriParser {

    parse(match: string, codeUri: string): any {
        const filePath = match.split(".");
        const handlerName = filePath.pop() as string;
        const lambdaDefinitions = {} as any;
        
        const basePath = path.join(__dirname, "..", "..", "..", "templates", "python");
        for (const file of fs.readdirSync(basePath)) {
            const id = file.replace(".py", "");
            lambdaDefinitions[id] = fs.readFileSync(path.join(basePath, file), "utf-8").replace("HANDLERNAME", handlerName);
        }
        const handlerPath = (codeUri.length ? `${codeUri}/` : "") + filePath.join("/").replace(/\"/g, "").replace(/'/g, "").replace(/:/g, "").replace(".", "/").trim() + ".py"
        return {
            linkedText: handlerPath,
            relativePath: handlerPath,
            runtime: "python",
            lambda: lambdaDefinitions
        };
    }
}