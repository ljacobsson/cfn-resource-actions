import * as vscode from 'vscode';
import { ICodeUriParser } from './ICodeUriParser';
import { StringUtil } from '../../util/StringUtil';

export class PythonParser implements ICodeUriParser {

    parse(match: string, codeUri: string): any {
        const path = match.split(".");
        path.pop();
        return (codeUri.length ? `${codeUri}/` : "") + path.join("/").replace(/\"/g, "").replace(/'/g, "").replace(/:/g, "").replace(".", "/").trim() + ".py";
    }
}