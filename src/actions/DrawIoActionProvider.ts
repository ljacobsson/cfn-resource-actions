import { IActionProvider } from "./IActionProvider";
import AWS = require("aws-sdk");
import { commands, window, TextDocument, workspace } from "vscode";
import { TemplateParser } from "../util/TemplateParser";
import { downloadAndUnzipVSCode } from "vscode-test";
const filterConfig = require("@mhlabs/cfn-diagram/resources/FilterConfig");
const mxGraph = require('@mhlabs/cfn-diagram/mxgraph/MxGenerator');
const fs = require("fs");

@IActionProvider.register
export class DrawIoActionProvider {
    async registerCommands(): Promise<void> {
        commands.registerCommand("cfn-resource-actions.drawIo", async (document: TextDocument) => {
            const template = TemplateParser.parse(document.getText());
            const resources = [...Object.keys(template.Resources)].sort();
            let types = [];
            for (const resource of resources) {
                types.push(template.Resources[resource].Type);
            }
            types = [...new Set(types)].sort();
            filterConfig.resourceTypesToInclude = types;
            filterConfig.resourceNamesToInclude = resources;
            const xml = mxGraph.renderTemplate(template);
            const fileName = `${document.fileName}.dio`;
            fs.writeFileSync(fileName, xml);
            window.showInformationMessage(`Your diagram has been generated: ${fileName}`);
            
        });
    }

    public getPhysicalActions() {
        return null;
    }

    public getLogicalActions() {
        return {
            "Global": (document: any) => {
                return [{
                    title: `Visualize`,
                    tooltip: "Visualize using draw.io",
                    command: "cfn-resource-actions.drawIo",
                    arguments: [document]
                }];
            }
        };
    }
}