import AWS = require("aws-sdk");
import * as fs from "fs";
import * as  zipFolder from "zip-a-folder";
import { TemplateParser } from "./TemplateParser";
import { window } from "vscode";
import path = require("path");
import * as tempDir from "temp-dir"
export class LambdaUtil {

    static async deployCode(stack: string, templateText: string, filePath: string): Promise<any> {
        window.showInformationMessage("Starting Lambda code upload");

        const template = TemplateParser.parse(templateText)        ;
        const cloudformation = new AWS.CloudFormation();
        const lambda = new AWS.Lambda();
        const stackResourcesResponse = await cloudformation.listStackResources({ StackName: stack }).promise();
        let nextToken = stackResourcesResponse.NextToken;
        while (nextToken) {
            const more = await cloudformation.listStackResources({ StackName: stack, NextToken: nextToken }).promise();
            (stackResourcesResponse.StackResourceSummaries as any[]).push(...(more.StackResourceSummaries as any[]));
            nextToken = more.NextToken;
        }
        const stackResources = stackResourcesResponse.StackResourceSummaries;
        const functions = stackResources ? stackResources.filter(p => p.ResourceType === "AWS::Lambda::Function") : [];
        const templateFunctions = Object.keys(template.Resources).filter(p => template.Resources[p].Type === "AWS::Serverless::Function");
        const outputPath = templateFunctions.map(p => template.Resources[p].Properties.CodeUri)[0] || template.Globals.Function.CodeUri;
        const aliasMap = templateFunctions.filter(p => template.Resources[p].Properties.AutoPublishAlias).map(p => ({ Key: p.toString(), Alias: template.Resources[p].Properties.AutoPublishAlias, FunctionName: "" }));
        const zipFileName = path.join(tempDir, "cfn-resource-actions-artifact.zip");
        
        await zipFolder.zip(path.join(filePath, outputPath), zipFileName);

        const file = fs.readFileSync(zipFileName);

        const updates = [] as any[];
        for (const func of functions.filter(p => templateFunctions.includes(p.LogicalResourceId))) {
            if (aliasMap.map(p => p.Key).includes(func.LogicalResourceId)) {
                aliasMap.filter(p => p.Key === func.LogicalResourceId)[0].FunctionName = func.PhysicalResourceId ? func.PhysicalResourceId.toString() : "";
            }
            if (func.PhysicalResourceId) {
                const params = {
                    FunctionName: func.PhysicalResourceId.toString(),
                    Publish: true,
                    ZipFile: file
                };

                updates.push(lambda.updateFunctionCode(params).promise());
            }
        }

        await Promise.all(updates);
        fs.unlinkSync(zipFileName);
        for (const map of aliasMap) {
            if (map.FunctionName !== null) {
                const versions = await lambda
                    .listVersionsByFunction({ FunctionName: map.FunctionName })
                    .promise();
                if (versions && versions.Versions) {
                    await lambda
                        .updateAlias({
                            FunctionName: map.FunctionName,
                            Name: map.Alias,
                            FunctionVersion:
                                versions.Versions[versions.Versions.length - 1].Version
                        })
                        .promise();
                }
            }
        }
        window.showInformationMessage("Successfully uploaded Lambda code");
    }
}


