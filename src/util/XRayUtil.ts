import * as vscode from 'vscode';
import AWS = require('aws-sdk');
import { StackResourceSummaries } from 'aws-sdk/clients/cloudformation';
import { XRay } from 'aws-sdk';
const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('cfn-resource-actions');

export class XRayUtil {
    static cloudFormation: AWS.CloudFormation;
    static CurrentStats: any = {};
    static async getStats(stackResources?: StackResourceSummaries | undefined) {
        const now = new Date();
        const xray = new AWS.XRay();
        if (!stackResources) {
            return;
        }
        const tempStats: any = {};
        for (const resource of stackResources.filter(p=>p.ResourceType === "AWS::Lambda::Function")) {
            const response = await xray
                .getTraceSummaries({
                    FilterExpression: `service(id(name: "${resource.PhysicalResourceId}", type: "AWS::Lambda::Function"))`,
                    StartTime: new Date(now.valueOf() - 600000),
                    EndTime: now,
                    Sampling: true,
                })
                .promise();
            let errors = 0;
            let durations = 0;
            let throttles = 0;
            if (response.TraceSummaries && response.TraceSummaries.length) {
                for (const summary of response.TraceSummaries) {
                    errors += (summary.HasFault || summary.HasError) ? 1 : 0;
                    durations += summary.Duration || 0;
                    throttles += summary.HasThrottle ? 1 : 0;
                }
                const count = response.TraceSummaries.length;
                tempStats[resource.PhysicalResourceId || ""] = {
                    ErrorRate: ((errors / count) * 100).toFixed(1),
                    AverageDuration: (durations / count).toFixed(3),
                    ThrottleRate: (throttles / count).toFixed(1),
                };
            }
        }

        XRayUtil.CurrentStats = tempStats;

    }
}