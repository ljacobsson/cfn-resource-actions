import { ExtensionContext, languages, commands, Disposable, workspace, window } from 'vscode';
import { PhysicalCodelensProvider as PhysicalCodelensProvider } from './providers/PhysicalCodelensProvider';
import { LambdaHandlerProvider } from './providers/LambdaHandlerProvider';
import { CloudFormation, STS } from "aws-sdk";
import { Globals } from "./util/Globals";
import { StackResourceSummaries } from 'aws-sdk/clients/cloudformation';
import * as vscode from 'vscode';
import AWS = require('aws-sdk');
import { IActionProvider } from './actions/IActionProvider';
import { TemplateParser } from './util/TemplateParser';
import { LogicalCodelensProvider } from './providers/LogicalCodelensProvider';
import { CloudFormationUtil } from './util/CloudFormationUtil';
const opn = require('opn');
const path = require('path');
const ssoAuth = require("@mhlabs/aws-sso-client-auth");
const clipboardy = require('clipboardy');

let disposables: Disposable[] = [];
const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('cfn-resource-actions');
export async function activate(context: ExtensionContext) {
    if (await config.get("sso.useSSO")) {
        try {
            await ssoAuth.configure({
                clientName: "cfn-resource-actions",
                startUrl: await config.get("sso.startUrl"),
                accountId: await config.get("sso.accountId"),
                region: await config.get("sso.region")
            });
            try {
                const cred = await ssoAuth.authenticate(await config.get("sso.role"));
                AWS.config.update({
                    credentials: cred,
                });
            } catch (err) {
                console.log(err);
                window.showErrorMessage(", mn,mn" + err);
            }
        } catch (error) {
            console.log(error);
        }
    }

    Globals.RefreshRate = await config.get("refreshRate") as number * 1000;

    const sts = new STS();
    try {
        Globals.AccountId = (await sts.getCallerIdentity().promise()).Account as string;
    } catch (err) {
        window.showErrorMessage(err);
    }
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

    languages.registerCodeLensProvider(['yaml', 'yml', 'template', 'json'], new LogicalCodelensProvider());
    const stackInfo = await CloudFormationUtil.getStackInfo(stackName as string);
    const resources = await CloudFormationUtil.getStackResources(stackName as string);
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
    commands.registerCommand("cfn-resource-actions.clipboard", (text: string) => {
        clipboardy.writeSync(text);
        vscode.window.showInformationMessage(`Copied '${text}' to the clipboard`);
    });

    //    if (resources && stackInfo?.Stacks) {
    const codelensProvider = new PhysicalCodelensProvider(resources?.StackResourceSummaries as StackResourceSummaries, stackInfo?.Stacks ? stackInfo?.Stacks[0] : undefined, stackName);
    languages.registerCodeLensProvider(["json", "yml", "yaml", "template"], codelensProvider);
    //    }

    IActionProvider.registerCommands();
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (disposables) {
        disposables.forEach(item => item.dispose());
    }
    disposables = [];
}