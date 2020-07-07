import * as vscode from 'vscode';
import { ICodeUriParser } from './ICodeUriParser';
import { StringUtil } from '../../util/StringUtil';

export class DotNetParser implements ICodeUriParser {

    parse(match: string): any {
        let uri = match.split("::")[1];
        const split = uri.split(".");
        const path = split.join("/");
        return `${path}.cs`;
    }

}
