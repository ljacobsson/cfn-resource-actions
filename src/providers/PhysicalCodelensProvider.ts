import * as vscode from 'vscode';
import { StackResourceSummaries, Stack, DetectStackDriftOutput } from 'aws-sdk/clients/cloudformation';
import { LambdaActionProvider } from '../actions/LambdaActionProvider';
import { DynamoDBActionProvider } from '../actions/DynamoDBActionProvider';
import { SNSActionProvider } from '../actions/SNSActionProvider';
import { SQSActionProvider } from '../actions/SQSActionProvider';
import { StepFunctionsActionProvider } from '../actions/StepFunctionsActionProvider';
import { EventsActionProvider } from '../actions/EventsActionProvider';
import AWS = require('aws-sdk');
import { CloudFormationUtil } from '../util/CloudFormationUtil';
import { Globals } from '../util/Globals';
import { XRayUtil } from '../util/XRayUtil';
import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';
import { SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION } from 'constants';
import { LambdaUtil } from '../util/LambdaUtil';
const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('cfn-resource-actions');

export class PhysicalCodelensProvider implements vscode.CodeLensProvider {

    private codeLenses: vscode.CodeLens[] = [];
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    private actionArgs: { [index: string]: any } = {
        ...new LambdaActionProvider().getPhysicalActions(),
        ...new DynamoDBActionProvider().getPhysicalActions(),
        ...new SNSActionProvider().getPhysicalActions(),
        ...new SQSActionProvider().getPhysicalActions(),
        ...new StepFunctionsActionProvider().getPhysicalActions(),
        ...new EventsActionProvider().getPhysicalActions(),
    };

    stackResources: StackResourceSummaries | undefined;
    stack: Stack | undefined;
    driftStatus: DetectStackDriftOutput | undefined;
    stackName: string | undefined;
    currentStackName: string = "";
    originalStackName: string | undefined;
    constructor() {
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
        setInterval(async () => {
            this.refresh();
        }, Globals.RefreshRate);

        vscode.commands.registerCommand("cfn-resource-actions.refresh", async (stack: any) => {
            await this.refresh();
        });

        vscode.commands.registerCommand("cfn-resource-actions.checkDrift", async (stack: any) => {
            await CloudFormationUtil.checkDrift(stack);
        });

        vscode.commands.registerCommand("cfn-resource-actions.uploadLambdaCode", async (stackName: string, template: string, filePath: string) => {
            await LambdaUtil.deployCode(stackName, template, filePath);
        });
    }

    private async refresh() {
        if (!this.stackName) {
            return;
        }
        const stacks = (await CloudFormationUtil.getStackInfo(this.stackName))?.Stacks;
        this.stack = stacks ? stacks[0] : undefined;
        this.stackResources = (await CloudFormationUtil.getStackResources(this.stackName))?.StackResourceSummaries;
        await XRayUtil.getStats(this.stackResources);
        this._onDidChangeCodeLenses.fire();
    }

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {

        if (
            vscode.workspace
                .getConfiguration("cfn-resource-actions")
                .get("enable", true)
        ) {
            try {
                this.codeLenses = [];

                const text = document.getText();
                if (!text.includes("AWSTemplateFormatVersion")) {
                    return [];
                }
                const filePath = path.join(path.dirname(document.uri.fsPath), "samconfig.toml");
                if (fs.existsSync(filePath)) {
                    const samConfig = ini.parse(fs.readFileSync(filePath, 'utf-8'));
                    const newStackName = samConfig.default.deploy.parameters.stack_name;
                    const newRegion = samConfig.default.deploy.parameters.region;
                    if (newStackName !== this.stackName || newRegion !== AWS.config.region) {
                        this.stackName = newStackName;
                        this.currentStackName = newStackName;
                        AWS.config.region = newRegion;
                        this.refresh();
                    }
                } else {
                    if (!this.originalStackName) {
                        let stackName;
                        if (config.get("stackNameIsSameAsWorkspaceFolderName")) {
                            stackName = vscode.workspace.rootPath?.split(path.sep)?.slice(-1)[0];
                        }

                        if (!stackName) {
                            if (await config.has("stackName")) {
                                stackName = await config.get("stackName");
                            }

                            if (!stackName) {
                                stackName = await vscode.window.showInputBox({ prompt: "Could not find samconfig.toml. Please enter stack name", placeHolder: "Please enter the name of the deployed stack" });
                                await config.update("stackName", stackName);
                            }
                        }
                        this.originalStackName = stackName;
                    }
                    this.stackName = this.originalStackName;
                }

                let matches;
                this.addStackCodeLens(document);
                if (!this.stackResources) {
                    return [];
                }
                for (const res of this.stackResources) {
                    const regex = new RegExp(`([^a-zA-Z0-9]${res.LogicalResourceId}[^a-zA-Z0-9])`, "g");
                    while ((matches = regex.exec(text)) !== null) {
                        const line = document.lineAt(document.positionAt(matches.index).line);
                        const indexOf = line.text.indexOf(matches[0]);
                        if (indexOf < 0) {
                            continue;
                        };
                        const position = new vscode.Position(line.lineNumber, indexOf);
                        const range = document.getWordRangeAtPosition(
                            position,
                            new RegExp(regex)
                        );
                        try {
                            const actionList: any[] = [];
                            if (range) {
                                actionList.push({
                                    title: `📋`,
                                    tooltip: "Copy resource ID to clipboard",
                                    command: "cfn-resource-actions.clipboard",
                                    arguments: [res.PhysicalResourceId]
                                }, ...(Object.keys(this.actionArgs).includes(res.ResourceType) ? this.actionArgs[res.ResourceType](res.PhysicalResourceId) as any[] : []));
                                for (const item of actionList) {
                                    this.codeLenses.push(new vscode.CodeLens(range, item));
                                }
                            }

                        } catch (err) {
                            console.log(err);
                        }
                    }
                }
                return this.codeLenses;
            } catch (err) {
                console.log(err);
            }
        }
        return [];
    }
    private addStackCodeLens(document: vscode.TextDocument) {
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 3));
        this.codeLenses.push(new vscode.CodeLens(range, {
            title: `⟳`,
            tooltip: "Refresh",
            command: "cfn-resource-actions.refresh",
            arguments: [this.stack?.StackName]
        }), new vscode.CodeLens(range, {
            title: `Stack status: ${this.stack?.StackStatus} ${this.stack?.StackStatusReason ? `: ${this.stack.StackStatusReason}` : ""}`,
            tooltip: "Open in AWS console",
            command: "cfn-resource-actions.openUrl",
            arguments: [`https://${AWS.config.region}.console.aws.amazon.com/cloudformation/home?region=${AWS.config.region}#/stacks/events?filteringText=${this.stack?.StackName}&stackId=${this.stack?.StackId}`]
        }),
            new vscode.CodeLens(range, {
                title: `Deploy function code`,
                tooltip: "Open in AWS console",
                command: "cfn-resource-actions.uploadLambdaCode",
                arguments: [this.stack?.StackName, document.getText(), path.dirname(document.uri.fsPath)]
            })
        );
        if (this.stack?.DriftInformation?.StackDriftStatus) {
            this.codeLenses.push(new vscode.CodeLens(range, {
                title: `Drift status: ${this.stack?.DriftInformation.StackDriftStatus}`,
                tooltip: "Drift information",
                command: "cfn-resource-actions.checkDrift",
                arguments: [this.stack?.StackName]
            }));
        }
    }


    public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
        if (vscode.workspace.getConfiguration("cfn-resource-actions").get("enable", true)) {
            return codeLens;
        }
        return null;
    }
}