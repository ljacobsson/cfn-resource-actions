import { ExtensionContext, languages, commands, Disposable, workspace, window } from 'vscode';
import { CodelensProvider } from './CodelensProvider';
import { CloudFormation, SharedIniFileCredentials } from "aws-sdk";
import { StackResourceSummaries } from 'aws-sdk/clients/cloudformation';
import { DynamoDBActionProvider } from './actions/DynamoDBActionProvider';
import * as vscode from 'vscode';
import AWS = require('aws-sdk');
const opn = require('opn');
const ssoAuth = require("@mhlabs/aws-sso-client-auth");

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
    
    const config = vscode.workspace.getConfiguration('cfn-resource-actions');
    
    if (await config.get("sso.useSSO")) {
        await ssoAuth.configure({
            clientName: "evb-cli",
            startUrl: await config.get("sso.startUrl"),
            accountId: await config.get("sso.accountId"),
            region: await config.get("sso.region")
          });
          AWS.config.update({
            credentials: await ssoAuth.authenticate(await config.get("sso.role"))
          });
    }

    let stackName = null;
    if (await config.has("stackName")) {
        stackName = await config.get("stackName");
    } 
    
    if (!stackName) {
        stackName = await window.showInputBox({ prompt: "Enter stack name", placeHolder: "Please enter the name of the deployed stack" });
        await config.update("stackName", stackName);
    }
    const resources = await getStackResources(stackName as string);
    if (resources) {
        const codelensProvider = new CodelensProvider(resources.StackResourceSummaries as StackResourceSummaries);
        languages.registerCodeLensProvider(["json", "yml", "yaml", "template"], codelensProvider);

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