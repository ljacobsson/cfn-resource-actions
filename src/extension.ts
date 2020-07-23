import { ExtensionContext, languages, commands, Disposable, workspace, window } from 'vscode';
import { PhysicalCodelensProvider as PhysicalCodelensProvider } from './providers/PhysicalCodelensProvider';
import { LambdaHandlerProvider } from './providers/LambdaHandlerProvider';
import { CloudFormation, STS } from "aws-sdk";
import { Globals } from "./util/Globals";
import { StackResourceSummaries } from 'aws-sdk/clients/cloudformation';
import * as vscode from 'vscode';
import AWS = require('aws-sdk');
import { IActionProvider } from './actions/IActionProvider';
import { LogicalCodelensProvider } from './providers/LogicalCodelensProvider';
import { CloudFormationUtil } from './util/CloudFormationUtil';
const opn = require('opn');
const path = require('path');
const ssoAuth = require("@mhlabs/aws-sso-client-auth");
const clipboardy = require('clipboardy');
const sharedIniFileLoader = require("@aws-sdk/shared-ini-file-loader");


let disposables: Disposable[] = [];
const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('cfn-resource-actions');
const onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

export async function activate(context: ExtensionContext) {
    try {
        await authenticate();
    } catch (err) {
        await window.showErrorMessage(err);
    }

    Globals.RefreshRate = await config.get("refreshRate") as number * 1000;

    const sts = new STS();
    try {
        const stsResponse = await sts.getCallerIdentity().promise();
        Globals.AccountId = stsResponse.Account as string;
    } catch (err) {
        await window.showErrorMessage(err);
    }
    Globals.OutputChannel = window.createOutputChannel("CloudFormation Resource Actions");

    let stackName: string | null | undefined = null;
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
    commands.registerCommand("cfn-resource-actions.enableCodeLens", () => {
        workspace.getConfiguration("cfn-resource-actions").update("enableCodeLens", true, true);
    });

    commands.registerCommand("cfn-resource-actions.disableCodeLens", () => {
        workspace.getConfiguration("cfn-resource-actions").update("enableCodeLens", false, true);
    });

    commands.registerCommand("cfn-resource-actions.awsProfile", async (cmd: any) => {
        const configFiles = await sharedIniFileLoader.loadSharedConfigFiles();
        const profile = await vscode.window.showQuickPick(Object.keys(configFiles.configFile));
        await config.update("AWSProfile", profile);
        await authenticate(profile);
        CloudFormationUtil.cloudFormation = new CloudFormation();
        await commands.executeCommand("cfn-resource-actions.refresh", stackName as string);
        window.showInformationMessage(`Switched to profile: ${profile}`);
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
    try {
        const stackInfo = await CloudFormationUtil.getStackInfo(stackName as string);
        const resources = await CloudFormationUtil.getStackResources(stackName as string);

        //    if (resources && stackInfo?.Stacks) {
        const codelensProvider = new PhysicalCodelensProvider(resources?.StackResourceSummaries as StackResourceSummaries, stackInfo?.Stacks ? stackInfo?.Stacks[0] : undefined, stackName as string);
        languages.registerCodeLensProvider(["json", "yml", "yaml", "template"], codelensProvider);
        //    }
    } catch (err) {
        window.showErrorMessage(err);
    }

    IActionProvider.registerCommands();
}

async function authenticate(profile?: any) {
    try {
        profile = profile || await config.get("AWSProfile");
        const authConfig = await ssoAuth.requestAuth("cfn-resource-actions", profile);
        if (authConfig) {
            AWS.config.update({
                credentials: authConfig.credentials,
                region: authConfig.region
            });
        } else {
            AWS.config.update({
                credentials: null,
                region: authConfig.region
            });
        }
    }
    catch (err) {
        await window.showWarningMessage(err);
        console.log(err);
    }
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (disposables) {
        disposables.forEach(item => item.dispose());
    }
    disposables = [];
}