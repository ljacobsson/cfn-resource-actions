import * as vscode from 'vscode';
import { ICodeUriParser } from './ICodeUriParser';
import { StringUtil } from '../../util/StringUtil';

export class NodeJSParser implements ICodeUriParser {

    parse(match: string, codeUri: string): any {
        return (codeUri.length ? `${codeUri}/` : "") + match.split(".")[0].replace(/\"/g, "").replace(/'/g, "").replace(/:/g, "").trim() + ".js";
    }
}