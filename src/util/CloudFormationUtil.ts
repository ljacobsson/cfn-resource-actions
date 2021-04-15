import * as vscode from 'vscode';
import AWS = require('aws-sdk');
const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('cfn-resource-actions');

export class CloudFormationUtil {
    static cloudFormation: AWS.CloudFormation;
    static suppressError: boolean;

    static async checkDrift(stackName: string) {
        vscode.window.showInformationMessage("Detecting drift...");
        const cloudFormation = this.cloudFormation || new AWS.CloudFormation();
        try {
            await cloudFormation.detectStackDrift({ StackName: stackName }).promise();
        } catch (err) {
            console.log(err);
        }
    }
    static async getStackInfo(stackName: string) {
        const cloudFormation = this.cloudFormation || new AWS.CloudFormation();
        try {
            const stackInfo = await cloudFormation.describeStacks({ StackName: stackName }).promise();
            return stackInfo;
        } catch (err) {
            console.log(err);
        }
    }

    static async getStackResources(stackName?: string) {
        stackName = stackName || await config.get("stackName");
        if (!stackName || !stackName.length) {
            return;
        }
        const cloudFormation = this.cloudFormation || new AWS.CloudFormation();
        
        try {
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
            if (!this.suppressError) {
                this.suppressError = true;
                await vscode.window.showErrorMessage(err.message);
                await vscode.window.showInformationMessage(`Failed loading stack '${stackName}'. You can enter its name in .vscode/settings.json`);
                await config.update("stackName", stackName);
                try {
                    await vscode.workspace.openTextDocument(`${vscode.workspace.rootPath}/.vscode/settings.json`);
                } catch (er) {
                    vscode.window.showErrorMessage(er.message);
                }
            }

        }
    }
}