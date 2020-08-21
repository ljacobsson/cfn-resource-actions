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

    constructor(stackResources: StackResourceSummaries, stack: Stack | undefined, stackName: string) {
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
        setInterval(async () => {
            this.refresh(stackName);
        }, Globals.RefreshRate);
        this.stackResources = stackResources;
        this.stack = stack;

        vscode.commands.registerCommand("cfn-resource-actions.refresh", async (stack: any) => {
            await this.refresh(stack);
        });

        vscode.commands.registerCommand("cfn-resource-actions.checkDrift", async (stack: any) => {
            await CloudFormationUtil.checkDrift(stack);
        });
    }

    private async refresh(stackName: string) {        
        const stacks = (await CloudFormationUtil.getStackInfo(stackName))?.Stacks;
        this.stack = stacks ? stacks[0] : undefined;
        this.stackResources = (await CloudFormationUtil.getStackResources(stackName))?.StackResourceSummaries;
        this._onDidChangeCodeLenses.fire();
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
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
        }));
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