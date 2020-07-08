import { ExtensionContext, languages, commands, Disposable, workspace, window } from 'vscode';
import { CodelensProvider } from './providers/CodelensProvider';
import { LambdaHandlerProvider } from './providers/LambdaHandlerProvider';
import { CloudFormation, STS } from "aws-sdk";
import { Globals } from "./util/Globals";
import { StackResourceSummaries } from 'aws-sdk/clients/cloudformation';
import * as vscode from 'vscode';
import AWS = require('aws-sdk');
import { IActionProvider } from './actions/IActionProvider';
const opn = require('opn');
const path = require('path');
const ssoAuth = require("@mhlabs/aws-sso-client-auth");

let disposables: Disposable[] = [];
const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('cfn-resource-actions');
async function getStackResources(stackName: string) {
    try {
        const cloudFormation = new CloudFormation();
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
        vscode.window.showErrorMessage(err.message);
        vscode.window.showInformationMessage(`Failed loading stack '${stackName}'. You can enter its name in .vscode/settings.json`);
        await config.update("stackName", stackName);
        try {
            await vscode.workspace.openTextDocument(`${vscode.workspace.rootPath}/.vscode/settings.json`);
        } catch (er) {
            vscode.window.showErrorMessage(er.message);

        }

    }
}
export async function activate(context: ExtensionContext) {
    if (await config.get("sso.useSSO")) {
        try {
            await ssoAuth.configure({
                clientName: "cfn-resource-actions",
                startUrl: await config.get("sso.startUrl"),
                accountId: await config.get("sso.accountId"),
                region: await config.get("sso.region")
            });
            const cred = await ssoAuth.authenticate(await config.get("sso.role"));
            AWS.config.update({
                credentials: cred,
            });
        } catch (error) {
            console.log(error);
        }
    }

    const sts = new STS();
    Globals.AccountId = (await sts.getCallerIdentity().promise()).Account as string;
    Globals.OutputChannel = window.createOutputChannel("CloudFormation Resource Actions");

    let stackName = null;
    if (config.get("stackNameIsSameAsWorkspaceFolderName")) {
        stackName = workspace.rootPath?.split(path.sep)?.slice(-1)[0];
    }

    if (!stackName) {
        if (await config.has("stackName")) {
            stackName = await config.get("stackName");
        }

        if (!stackName) {
            stackName = await window.showInputBox({ prompt: "Enter stack name", placeHolder: "Please enter the name of the deployed stack" });
            await config.update("stackName", stackName);
        }
    }
    
    languages.registerDefinitionProvider(['yaml', 'yml', 'template', 'json'], new LambdaHandlerProvider());

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

        commands.registerCommand("cfn-resource-actions.runShellCommand", (cmd: any) => {
            window.activeTerminal?.sendText(cmd);
        });
        commands.registerCommand("cfn-resource-actions.openUrl", (url: string) => {
            opn(url);
        });

        IActionProvider.registerCommands();
    }
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (disposables) {
        disposables.forEach(item => item.dispose());
    }
    disposables = [];
}