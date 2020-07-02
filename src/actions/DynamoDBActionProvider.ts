import { IActionProvider } from "./IActionProvider";
import { commands, window } from 'vscode';

import AWS = require("aws-sdk");

export class DynamoDBActionProvider implements IActionProvider {
    async registerCommands(): Promise<void> {
        const dynamodDb = new AWS.DynamoDB();
        const documentClient = new AWS.DynamoDB.DocumentClient();
        commands.registerCommand("cfn-resource-actions.dynamoDBQuery", async (tableName: string) => {
            const table = await dynamodDb.describeTable({ TableName: tableName }).promise();
            if (table.Table?.KeySchema) {
                const pk = table.Table?.KeySchema[0].AttributeName as string;
                let sk = null;
                if (table.Table?.KeySchema.length === 2) {
                    sk = table.Table?.KeySchema[1].AttributeName;
                }

                const pkValue = await window.showInputBox({ prompt: `Enter value for ${pk}`, placeHolder: `Enter value for ${pk}` });
                const skValue = await window.showInputBox({ prompt: `Enter value for ${sk}`, placeHolder: `Enter value for ${sk} (optional)` });
                const params = {
                    TableName: tableName,
                    KeyConditionExpression:
                        `${pk} = :pkValue` + (skValue && skValue.length > 0 ? ` and ${sk} = :skValue` : ""),
                    ExpressionAttributeValues: {
                        ":pkValue": pkValue,
                        ":skValue": skValue
                    }
                };
                if (!skValue && !skValue?.length) {
                    delete params.ExpressionAttributeValues[":skValue"];
                }
                const query = await documentClient.query(params).promise();
                if (query.Items) {
                    
                    const outputChannel = window.createOutputChannel(`Query on ${tableName}`);
                    for (const row of query.Items) {
                        outputChannel.appendLine(JSON.stringify(row, null, 2));
                    }
                }
            }
        });
    }

    public getActions() {
        return {
            "AWS::DynamoDB::Table": (arg: any) => {
                return [{
                    title: `💻`,
                    tooltip: "Go to AWS console for resource",
                    command: "cfn-resource-actions.openUrl",
                    arguments: [`https://${AWS.config.region}.console.aws.amazon.com/dynamodb/home?region=${AWS.config.region}#tables:selected=${arg};tab=overview`]
                }, {
                    title: `Query`,
                    tooltip: "Query table",
                    command: "cfn-resource-actions.dynamoDBQuery",
                    arguments: [arg]
                }];
            }
        };
    }
}