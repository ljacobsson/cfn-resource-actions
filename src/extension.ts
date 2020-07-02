import { ExtensionContext, languages, commands, Disposable, workspace, window } from 'vscode';
import { CodelensProvider } from './CodelensProvider';
import { CloudFormation, SharedIniFileCredentials } from "aws-sdk";
import { StackResourceSummaries } from 'aws-sdk/clients/cloudformation';
import { DynamoDBActionProvider } from './actions/DynamoDBActionProvider';
import * as vscode from 'vscode';
const opn = require('opn');

let disposables: Disposable[] = [];

async function getStackResources(stackName: string) {
    try {

        const cloudFormation = new CloudFormation(new SharedIniFileCredentials());
        const stackResourcesResponse = await cloudFormation
            .listStackResources({ StackName: stackName })
            .promise();
        let nextToken = stackResourcesResponse.NextToken;
        while (nextToken) {
            const more = await cloudFormation
                .listStackResources({ StackName: stackName, NextToken: nextToken })
                .promise();
            if (stackResourcesResponse && stackResourcesResponse.StackResourceSummaries && more) {
                stackResourcesResponse.StackResourceSummaries.push(...more.StackResourceSummaries as any);
            }
            nextToken = more.NextToken;
        }
        return stackResourcesResponse;
    } catch (err) {
        console.log(err);
    }
}

export async function activate(context: ExtensionContext) {
    const config = workspace.getConfiguration('cfn-resource-actions');
    let stackName = null;
    if (config.has("stackName")) {
        stackName = config.get("stackName");
    } else {
        stackName = await window.showInputBox({ prompt: "Enter stack name", placeHolder: "Please enter the name of the deployed stack" });
        config.update("stackName", stackName, vscode.ConfigurationTarget.WorkspaceFolder);
    }
    const resources = await getStackResources(stackName as string);
    if (resources) {
        const codelensProvider = new CodelensProvider(resources.StackResourceSummaries as StackResourceSummaries);
        languages.registerCodeLensProvider("*", codelensProvider);

        commands.registerCommand("cfn-resource-actions.enableCodeLens", () => {
            workspace.getConfiguration("cfn-resource-actions").update("enableCodeLens", true, true);
        });

        commands.registerCommand("cfn-resource-actions.disableCodeLens", () => {
            workspace.getConfiguration("cfn-resource-actions").update("enableCodeLens", false, true);
        });

        commands.registerCommand("cfn-resource-actions.codelensAction", (args: any[]) => {
            window.activeTerminal?.sendText("ls");
            window.showInformationMessage(`CodeLens action clicked with args=${JSON.stringify(args)} ${args.length}`);

        });
        commands.registerCommand("cfn-resource-actions.runShellCommand", (cmd: any) => {
            window.activeTerminal?.sendText(cmd);
        });
        commands.registerCommand("cfn-resource-actions.openUrl", (url: string) => {
            opn(url);
        });
        new DynamoDBActionProvider().registerCommands();
    }
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (disposables) {
        disposables.forEach(item => item.dispose());
    }
    disposables = [];
}